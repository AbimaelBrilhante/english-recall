(() => {
  'use strict';
  if (window.__recallAdvancedV3) return;
  const core = window.recallCore;
  if (!core) return;
  window.__recallAdvancedV3 = true;

  const VERSION = '13.0';
  const BACKUP_KEY = 'recallAutoBackupsV1';
  const AUDIO_HEALTH_KEY = 'recallAudioHealthV2';
  const RECORD_DB = 'recallRecordingsV1';
  const RECORD_STORE = 'recordings';
  const DECKS = core.DECKS;
  const state = () => core.getState();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  let activePlan = null;
  let cram = null;
  let mediaRecorder = null;
  let mediaStream = null;
  let mediaChunks = [];
  let speechRecognition = null;
  let liveTranscript = '';
  let recordingTarget = null;
  let latestRecordingUrl = null;

  function save(){ core.save(); }
  function tomorrowKey(){ const d=new Date(); d.setDate(d.getDate()+1); return core.dayKey(d); }
  function isBuried(card){ return Boolean(card.buriedUntilDay && core.dayKey() < card.buriedUntilDay); }
  function totalLapses(card){ return Number(card.schedules?.recognition?.lapses||0)+Number(card.schedules?.production?.lapses||0); }
  function totalReps(card){ return Number(card.schedules?.recognition?.reps||0)+Number(card.schedules?.production?.reps||0); }
  function isLeech(card){
    const logs=(state().reviewLog||[]).filter(r=>r.id===card.id).slice(-10);
    const again=logs.filter(r=>r.rating==='again').length, hard=logs.filter(r=>r.rating==='hard').length;
    return totalLapses(card)>=3 || (again>=2 && again+hard>=4);
  }
  function mastery(card){
    const r=card.schedules?.recognition||{}, p=card.schedules?.production||{};
    const reps=totalReps(card), lapses=totalLapses(card);
    if(!reps) return {level:0,label:'Novo',icon:'○'};
    if(Number(r.interval||0)>=35 && Number(p.interval||0)>=15 && Number(p.reps||0)>=2 && lapses<=2) return {level:3,label:'Dominado',icon:'◆'};
    if((Number(r.interval||0)>=15 || Number(p.interval||0)>=7) && reps>=5 && lapses<=3) return {level:2,label:'Firme',icon:'●'};
    return {level:1,label:'Aprendendo',icon:'◐'};
  }

  function ensureState(){
    const s=state();
    s.settings ||= {};
    s.settings.session ||= {size:20,source:'due',mode:'smart',type:'srs'};
    for(const id of Object.keys(DECKS)) for(const c of (s.cards[id]||[])) {
      if(typeof c.note!=='string') c.note='';
      if(typeof c.buriedUntilDay!=='string') c.buriedUntilDay='';
    }
    save();
  }

  function styles(){
    if(document.getElementById('rf3Style')) return;
    const s=document.createElement('style'); s.id='rf3Style'; s.textContent=`
      .rf3-btn{min-height:38px;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:11px;padding:0 11px;font-weight:800;font-size:12px}
      .rf3-btn.primary{background:var(--primary);color:#fff;border-color:var(--primary)}
      .rf3-row{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.rf3-muted{font-size:11px;color:var(--muted)}
      .rf3-master{display:inline-flex;align-items:center;gap:4px;border-radius:999px;background:var(--surface2);color:var(--muted);padding:4px 8px;font-size:10px;font-weight:850;margin:6px 5px 0 0}
      .rf3-master[data-level="3"]{background:#e8f7ef;color:#11714b}.rf3-master[data-level="2"]{background:#eef3ff;color:#294e8f}.rf3-master[data-level="1"]{background:#fff5df;color:#8a5c00}
      html[data-recall-theme="dark"] .rf3-master[data-level="3"]{background:#18392c;color:#8ee0b9}html[data-recall-theme="dark"] .rf3-master[data-level="2"]{background:#242f49;color:#b9c9ff}html[data-recall-theme="dark"] .rf3-master[data-level="1"]{background:#47371d;color:#ffd795}
      .rf3-note{margin-top:7px;padding:8px 10px;border-left:3px solid var(--primary2);background:var(--surface2);border-radius:9px;color:var(--muted);font-size:11px;line-height:1.35}
      .rf3-review-tools{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.rf3-review-tools button{flex:1 1 120px}
      .rf3-record{margin-top:10px;border:1px solid var(--line);border-radius:14px;padding:10px;background:var(--surface2)}.rf3-record-status{font-size:11px;color:var(--muted);line-height:1.4;margin-top:7px}
      .rf3-session-chip{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--surface2);border-radius:13px;padding:8px 10px;margin-bottom:10px;font-size:11px;color:var(--muted)}
      .rf3-session-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.rf3-session-grid label{font-size:11px;color:var(--muted);font-weight:800}.rf3-session-grid select,.rf3-session-grid input{margin-top:5px;width:100%;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:12px;padding:11px}
      .rf3-cram-card{min-height:330px;border-radius:20px;background:var(--surface);border:1px solid var(--line);padding:24px;display:flex;flex-direction:column;justify-content:center;text-align:center}.rf3-cram-card .front{font-size:28px;line-height:1.2;font-weight:850;color:var(--accent)}.rf3-cram-card .back{font-size:20px;line-height:1.35;color:var(--ink);margin-top:18px}.rf3-cram-card .back.hidden{display:none}
      .rf3-problem-filter{margin-bottom:9px}.rf3-problem-filter select{width:100%;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:12px;padding:10px}
      .rf3-recommended{display:inline-flex;margin:8px 0 0;background:#fff3d8;color:#8a5a00;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:900}html[data-recall-theme="dark"] .rf3-recommended{background:#49391f;color:#ffd48d}
      .rf3-backups{display:grid;gap:8px;margin-top:10px}.rf3-backup{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--surface2);border-radius:12px;padding:9px 10px}.rf3-backup span{font-size:11px;color:var(--muted)}
      .rf3-version{text-align:center;color:var(--muted);font-size:10px;padding:16px 0 4px;opacity:.8}
      @media(max-width:430px){.rf3-session-grid{grid-template-columns:1fr}.rf3-cram-card .front{font-size:24px}}
    `; document.head.appendChild(s);
  }

  function openRecordDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(RECORD_DB,1);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(RECORD_STORE))db.createObjectStore(RECORD_STORE,{keyPath:'key'});};
      req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
    });
  }
  async function putRecording(deckId,card,blob,transcript='',score=null){
    const db=await openRecordDb(); const key=`${deckId}|${card.id}`;
    await new Promise((resolve,reject)=>{const tx=db.transaction(RECORD_STORE,'readwrite');tx.objectStore(RECORD_STORE).put({key,deckId,cardId:card.id,blob,transcript,score,updatedAt:Date.now()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
    db.close();
  }
  async function getRecording(deckId,card){
    try{const db=await openRecordDb();const key=`${deckId}|${card.id}`;const val=await new Promise((resolve,reject)=>{const tx=db.transaction(RECORD_STORE,'readonly');const q=tx.objectStore(RECORD_STORE).get(key);q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>reject(q.error);});db.close();return val;}catch{return null;}
  }
  function normalizeWords(text,lang){return String(text||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9äöüß\s']/gi,' ').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);}
  function wordDistance(a,b){const m=a.length,n=b.length,dp=Array.from({length:m+1},()=>Array(n+1).fill(0));for(let i=0;i<=m;i++)dp[i][0]=i;for(let j=0;j<=n;j++)dp[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return dp[m][n];}
  function speechScore(expected,actual,lang){const a=normalizeWords(expected,lang),b=normalizeWords(actual,lang);if(!a.length||!b.length)return null;return Math.max(0,Math.round((1-wordDistance(a,b)/Math.max(a.length,b.length))*100));}

  async function startRecording(card=core.current()?.card,deckId=core.selectedDeck()){
    if(!card)return;
    if(mediaRecorder){await stopRecording();return;}
    if(!navigator.mediaDevices?.getUserMedia){alert('Gravação não disponível neste navegador.');return;}
    try{
      mediaStream=await navigator.mediaDevices.getUserMedia({audio:true});
      mediaChunks=[];liveTranscript='';recordingTarget={deckId,card};
      const mime=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(x=>MediaRecorder.isTypeSupported?.(x))||'';
      mediaRecorder=new MediaRecorder(mediaStream,mime?{mimeType:mime}:undefined);
      mediaRecorder.ondataavailable=e=>{if(e.data?.size)mediaChunks.push(e.data);};
      mediaRecorder.start();
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(SR){try{speechRecognition=new SR();speechRecognition.lang=DECKS[deckId].lang;speechRecognition.interimResults=false;speechRecognition.continuous=false;speechRecognition.onresult=e=>{liveTranscript=Array.from(e.results).map(r=>r[0]?.transcript||'').join(' ').trim();};speechRecognition.start();}catch{speechRecognition=null;}}
      renderRecordBox(card,deckId,'Gravando… toque novamente para parar.');
    }catch(e){alert('Não consegui acessar o microfone. Verifique a permissão do Safari/Recall.');cleanupMedia();}
  }
  async function stopRecording(){
    if(!mediaRecorder)return;
    const mr=mediaRecorder;const target=recordingTarget;
    const blob=await new Promise(resolve=>{mr.onstop=()=>resolve(new Blob(mediaChunks,{type:mr.mimeType||'audio/mp4'}));try{mr.stop();}catch{resolve(new Blob(mediaChunks));}});
    try{speechRecognition?.stop();}catch{}
    await sleep(250);
    const transcript=liveTranscript.trim(); const score=target?speechScore(target.card.front,transcript,DECKS[target.deckId].lang):null;
    if(target&&blob.size){await putRecording(target.deckId,target.card,blob,transcript,score);target.card.lastSpeechTranscript=transcript;target.card.lastSpeechScore=score;target.card.lastSpeechAt=Date.now();save();}
    cleanupMedia(); if(target)renderRecordBox(target.card,target.deckId);
  }
  function cleanupMedia(){try{mediaStream?.getTracks().forEach(t=>t.stop());}catch{}mediaRecorder=null;mediaStream=null;mediaChunks=[];speechRecognition=null;recordingTarget=null;}
  async function playMyRecording(card,deckId){const rec=await getRecording(deckId,card);if(!rec?.blob){alert('Ainda não há gravação para esta frase.');return;}if(latestRecordingUrl)URL.revokeObjectURL(latestRecordingUrl);latestRecordingUrl=URL.createObjectURL(rec.blob);const a=new Audio(latestRecordingUrl);a.play().catch(()=>{});}

  function ensureRecordBox(){
    const panel=document.querySelector('#view-review .panel');if(!panel)return null;
    let box=document.getElementById('rf3RecordBox');if(box)return box;
    box=document.createElement('div');box.id='rf3RecordBox';box.className='rf3-record';
    const rating=document.getElementById('rating');panel.insertBefore(box,rating);return box;
  }
  async function renderRecordBox(card=core.current()?.card,deckId=core.selectedDeck(),status=''){
    const box=ensureRecordBox();if(!box)return;
    if(!card){box.style.display='none';return;}box.style.display='';
    const rec=await getRecording(deckId,card);const score=card.lastSpeechScore??rec?.score;const transcript=card.lastSpeechTranscript||rec?.transcript||'';
    box.innerHTML=`<div class="rf3-row" style="margin-top:0"><button id="rf3RecBtn" class="rf3-btn ${mediaRecorder?'primary':''}">${mediaRecorder?'■ Parar':'🎙 Responder'}</button><button id="rf3PlayMine" class="rf3-btn" ${rec?'':'disabled'}>▶ Minha gravação</button></div><div class="rf3-record-status">${status|| (transcript?`Transcrição: “${esc(transcript)}”${Number.isFinite(Number(score))?` · correspondência <b>${score}%</b>`:''}`:'A gravação fica somente neste iPhone. A comparação automática depende do reconhecimento de fala disponível no Safari.')}</div>`;
    document.getElementById('rf3RecBtn').onclick=()=>mediaRecorder?stopRecording():startRecording(card,deckId);
    document.getElementById('rf3PlayMine').onclick=()=>playMyRecording(card,deckId);
  }

  const candidatesBeforeV3=core.getCandidateItems();
  core.setCandidateItems(function(deckId=core.selectedDeck(),cutoff=Date.now(),mode=core.selectedMode(deckId)){
    let items=candidatesBeforeV3(deckId,cutoff,mode).filter(x=>!isBuried(x.card));
    if(activePlan?.active && activePlan.deckId===deckId){items=items.filter(x=>activePlan.allowedIds.has(x.card.id));}
    return items;
  });

  function filterSource(items,source,tag){
    if(source==='favorites')return items.filter(x=>x.card.favorite);
    if(source==='difficult')return items.filter(x=>isLeech(x.card));
    if(source==='tag')return items.filter(x=>(x.card.tags||[]).includes(tag));
    return items;
  }
  function sourceCards(deckId,source,tag){let cards=(state().cards[deckId]||[]).filter(c=>!c.suspended&&!isBuried(c));if(source==='favorites')cards=cards.filter(c=>c.favorite);else if(source==='difficult')cards=cards.filter(isLeech);else if(source==='tag')cards=cards.filter(c=>(c.tags||[]).includes(tag));return cards;}

  function ensureSessionViews(){
    const main=document.querySelector('main.app');if(!main)return;
    if(!document.getElementById('view-rf3-session')){
      const v=document.createElement('section');v.id='view-rf3-session';v.className='view';v.innerHTML=`<div class="section"><div class="rf2-head"><h2>🎛 Sessão personalizada</h2><button id="rf3SessionBack" class="secondary-btn">← Decks</button></div><p>Escolha tamanho e foco. No modo Cram, nada altera o SRS.</p><div class="rf3-session-grid"><label>Deck<select id="rf3Deck"><option value="en">🇺🇸 English</option><option value="de">🇩🇪 Deutsch</option></select></label><label>Tipo<select id="rf3Type"><option value="srs">Revisão SRS</option><option value="cram">Revisão livre (Cram)</option></select></label><label>Tamanho<select id="rf3Size"><option value="10">10 cards</option><option value="20" selected>20 cards</option><option value="0">Todos</option></select></label><label>Fonte<select id="rf3Source"><option value="due">Pendentes de hoje</option><option value="favorites">Favoritos</option><option value="difficult">Difíceis</option><option value="tag">Uma tag</option><option value="all">Todas as frases</option></select></label><label>Modo<select id="rf3Mode"><option value="smart">🧠 Misto</option><option value="recognition">👁 Compreensão</option><option value="production">🗣 Produção</option></select></label><label>Tag<input id="rf3Tag" placeholder="Interview"></label></div><button id="rf3StartSession" class="primary-btn" style="margin-top:12px;width:100%">Iniciar sessão</button><div id="rf3SessionMsg" class="msg"></div></div>`;main.appendChild(v);
      document.getElementById('rf3SessionBack').onclick=()=>core.showView('decks');document.getElementById('rf3StartSession').onclick=startConfiguredSession;
    }
    if(!document.getElementById('view-rf3-cram')){
      const v=document.createElement('section');v.id='view-rf3-cram';v.className='view';v.innerHTML=`<div class="section"><div class="rf2-head"><h2>Revisão livre</h2><button id="rf3CramBack" class="secondary-btn">← Decks</button></div><div id="rf3CramPos" class="rf3-muted"></div><div id="rf3CramCard" class="rf3-cram-card"><div class="front"></div><div class="back hidden"></div></div><div class="rf3-row"><button id="rf3CramFlip" class="rf3-btn primary">Virar</button><button id="rf3CramAudio" class="rf3-btn">▶ Ouvir</button><button id="rf3Cram3x" class="rf3-btn">🔁 3x</button></div><div class="rf3-row"><button id="rf3CramPrev" class="rf3-btn">← Anterior</button><button id="rf3CramNote" class="rf3-btn">📝 Nota</button><button id="rf3CramNext" class="rf3-btn primary">Próximo →</button></div></div>`;main.appendChild(v);
      document.getElementById('rf3CramBack').onclick=()=>{cram=null;core.showView('decks');};document.getElementById('rf3CramFlip').onclick=()=>{if(cram){cram.revealed=!cram.revealed;renderCram();}};document.getElementById('rf3CramNext').onclick=()=>{if(cram){cram.index=(cram.index+1)%cram.cards.length;cram.revealed=false;renderCram();}};document.getElementById('rf3CramPrev').onclick=()=>{if(cram){cram.index=(cram.index-1+cram.cards.length)%cram.cards.length;cram.revealed=false;renderCram();}};document.getElementById('rf3CramAudio').onclick=()=>{if(cram)core.speakText(cram.cards[cram.index].front,cram.deckId,1);};document.getElementById('rf3Cram3x').onclick=()=>{if(cram)playThree(cram.cards[cram.index],cram.deckId);};document.getElementById('rf3CramNote').onclick=()=>{if(cram)editNote(cram.cards[cram.index]);};
    }
  }
  function startConfiguredSession(){
    const deckId=document.getElementById('rf3Deck').value,type=document.getElementById('rf3Type').value,source=document.getElementById('rf3Source').value,mode=document.getElementById('rf3Mode').value,tag=document.getElementById('rf3Tag').value.trim(),size=Number(document.getElementById('rf3Size').value)||0;
    state().settings.session={deckId,type,source,mode,tag,size};save();
    if(type==='cram'){
      let cards=source==='due'?[...new Map(candidatesBeforeV3(deckId,Date.now(),mode).map(x=>[x.card.id,x.card])).values()]:sourceCards(deckId,source,tag);
      if(size>0)cards=cards.slice(0,size);if(!cards.length){document.getElementById('rf3SessionMsg').textContent='Nenhum card encontrado para essa seleção.';return;}cram={deckId,cards,index:0,revealed:false};core.showView('rf3-cram');renderCram();return;
    }
    state().settings.selectedDeck=deckId;state().settings.modeByDeck[deckId]=mode;save();
    let items=candidatesBeforeV3(deckId,Date.now(),mode);if(source!=='due'&&source!=='all')items=filterSource(items,source,tag);const ids=[];const seen=new Set();for(const x of items){if(!seen.has(x.card.id)){seen.add(x.card.id);ids.push(x.card.id);}if(size>0&&ids.length>=size)break;}
    if(!ids.length){document.getElementById('rf3SessionMsg').textContent='Nenhuma revisão pendente encontrada.';return;}
    activePlan={active:true,deckId,allowedIds:new Set(ids),size:ids.length};core.startSession?.(deckId);showSessionChip();
  }
  function renderCram(){if(!cram?.cards.length)return;const c=cram.cards[cram.index],m=mastery(c);document.getElementById('rf3CramPos').textContent=`${DECKS[cram.deckId].flag} ${cram.index+1}/${cram.cards.length} · ${m.label}`;document.querySelector('#rf3CramCard .front').textContent=c.front;const b=document.querySelector('#rf3CramCard .back');b.textContent=c.back+(c.note?`\n\n📝 ${c.note}`:'');b.classList.toggle('hidden',!cram.revealed);}
  function showSessionChip(){
    const wrap=document.querySelector('#view-review .progress-wrap');if(!wrap)return;let chip=document.getElementById('rf3SessionChip');if(!activePlan?.active){chip?.remove();return;}if(!chip){chip=document.createElement('div');chip.id='rf3SessionChip';chip.className='rf3-session-chip';wrap.insertAdjacentElement('afterend',chip);}chip.innerHTML=`<span>Sessão personalizada · ${activePlan.size} cards</span><button id="rf3EndSession" class="rf3-btn">Encerrar</button>`;document.getElementById('rf3EndSession').onclick=()=>{activePlan=null;core.clearCurrentItem();chip.remove();core.showView('decks');core.render();};
  }

  function editNote(card){const x=prompt('Nota pessoal para esta frase:',card.note||'');if(x===null)return;card.note=x.trim();save();enhanceReview();core.renderLibrary();}
  function buryCurrent(){const item=core.current();if(!item)return;item.card.buriedUntilDay=tomorrowKey();save();core.clearCurrentItem();core.render();}
  function audioPath(card,deckId){const rid=String(card.remoteId||'');return new RegExp(`^${deckId}-\\d+$`).test(rid)?`./audio/${deckId}/${encodeURIComponent(rid)}.caf`:null;}
  async function playOne(card,deckId){const p=audioPath(card,deckId);if(p){try{await new Promise((res,rej)=>{const a=new Audio(`${p}?r3=${Date.now()}`);a.onended=res;a.onerror=rej;a.play().catch(rej);});return;}catch{}}core.speakText(card.front,deckId,1);await sleep(Math.max(1600,Math.min(6000,card.front.length*70)));}
  async function playThree(card=core.current()?.card,deckId=core.selectedDeck()){if(!card)return;for(let i=0;i<3;i++){await playOne(card,deckId);if(i<2)await sleep(350);}}
  function ensureReviewExtras(){
    const panel=document.querySelector('#view-review .panel');if(!panel)return;
    let tools=document.getElementById('rf3ReviewTools');if(!tools){tools=document.createElement('div');tools.id='rf3ReviewTools';tools.className='rf3-review-tools';tools.innerHTML='<button id="rf3Bury" class="rf3-btn">🛏 Amanhã</button><button id="rf3Note" class="rf3-btn">📝 Nota</button><button id="rf3Audio3" class="rf3-btn">🔁 Áudio 3x</button>';const audio=document.getElementById('audioRow');audio.insertAdjacentElement('afterend',tools);document.getElementById('rf3Bury').onclick=buryCurrent;document.getElementById('rf3Note').onclick=()=>{const c=core.current()?.card;if(c)editNote(c);};document.getElementById('rf3Audio3').onclick=()=>playThree();}
    let masteryEl=document.getElementById('rf3CurrentMastery');if(!masteryEl){masteryEl=document.createElement('span');masteryEl.id='rf3CurrentMastery';masteryEl.className='rf3-master';document.getElementById('studyBadge')?.insertAdjacentElement('afterend',masteryEl);}
    let note=document.getElementById('rf3CurrentNote');if(!note){note=document.createElement('div');note.id='rf3CurrentNote';note.className='rf3-note';document.getElementById('promptHint')?.insertAdjacentElement('afterend',note);}
  }
  function enhanceReview(){ensureReviewExtras();showSessionChip();const item=core.current();const me=document.getElementById('rf3CurrentMastery'),note=document.getElementById('rf3CurrentNote');if(!item){if(me)me.style.display='none';if(note)note.style.display='none';renderRecordBox();return;}const m=mastery(item.card);if(me){me.style.display='inline-flex';me.dataset.level=String(m.level);me.textContent=`${m.icon} ${m.label}`;}if(note){note.style.display=item.card.note?'':'none';note.textContent=item.card.note?`📝 ${item.card.note}`:'';}renderRecordBox(item.card,core.selectedDeck());}

  function audioHealth(card,deckId){const p=audioPath(card,deckId);if(!p)return'unknown';try{const c=JSON.parse(localStorage.getItem(AUDIO_HEALTH_KEY)||'{}');const x=c[p];return !x?'unknown':x.ok?'ok':'missing';}catch{return'unknown';}}
  function ensureProblemFilter(){const base=document.getElementById('rf2Filters');if(!base||document.getElementById('rf3ProblemFilter'))return;const d=document.createElement('div');d.id='rf3ProblemFilter';d.className='rf3-problem-filter';d.innerHTML='<select id="rf3ProblemSelect"><option value="all">Todos os cards</option><option value="neverProd">Nunca produzidos</option><option value="noAudio">Sem áudio</option><option value="buried">Enterrados até amanhã</option><option value="lapses">Mais esquecidos primeiro</option><option value="mastery">Menos dominados primeiro</option></select>';base.insertAdjacentElement('afterend',d);document.getElementById('rf3ProblemSelect').onchange=()=>core.renderLibrary();}
  function enhanceLibrary(){
    ensureProblemFilter();const deckId=$('libraryDeck').value||core.selectedDeck(),cards=state().cards[deckId]||[],mode=document.getElementById('rf3ProblemSelect')?.value||'all';const list=document.getElementById('list');if(!list)return;
    const rows=[...list.querySelectorAll('.item')];
    for(const row of rows){const front=row.querySelector('.en')?.textContent||'',back=row.querySelector('.pt')?.textContent||'',card=cards.find(c=>c.front===front&&c.back===back);if(!card)continue;row.querySelector('.rf3-extra')?.remove();const m=mastery(card),ex=document.createElement('div');ex.className='rf3-extra';ex.innerHTML=`<span class="rf3-master" data-level="${m.level}">${m.icon} ${m.label}</span>${isBuried(card)?'<span class="rf3-master">🛏 Amanhã</span>':''}${card.note?`<div class="rf3-note">📝 ${esc(card.note)}</div>`:''}<div class="rf3-row"><button class="rf3-btn" data-rf3="note">📝 Nota</button>${isBuried(card)?'<button class="rf3-btn" data-rf3="unbury">↩ Desenterrar</button>':''}</div>`;row.appendChild(ex);ex.querySelector('[data-rf3="note"]').onclick=()=>editNote(card);ex.querySelector('[data-rf3="unbury"]')?.addEventListener('click',()=>{card.buriedUntilDay='';save();core.renderLibrary();});
      let visible=true;if(mode==='neverProd')visible=Number(card.schedules?.production?.reps||0)===0;else if(mode==='noAudio')visible=audioHealth(card,deckId)==='missing';else if(mode==='buried')visible=isBuried(card);if(mode!=='lapses'&&mode!=='mastery'&&mode!=='all')row.style.display=visible?'':'none';
    }
    if(mode==='lapses')rows.sort((a,b)=>{const ca=cards.find(c=>c.front===(a.querySelector('.en')?.textContent||'')),cb=cards.find(c=>c.front===(b.querySelector('.en')?.textContent||''));return totalLapses(cb||{})-totalLapses(ca||{});}).forEach(r=>list.appendChild(r));
    if(mode==='mastery')rows.sort((a,b)=>{const ca=cards.find(c=>c.front===(a.querySelector('.en')?.textContent||'')),cb=cards.find(c=>c.front===(b.querySelector('.en')?.textContent||''));return mastery(ca||{}).level-mastery(cb||{}).level;}).forEach(r=>list.appendChild(r));
  }

  function decorateDecks(){const cards=[...document.querySelectorAll('#deckGrid .deck-card')];if(!cards.length)return;const due={en:core.dueNow('en').length,de:core.dueNow('de').length};const rec=due.en===0&&due.de===0?null:(due.en>=due.de?'en':'de');for(const el of cards){const title=el.querySelector('.deck-title')?.textContent?.toLowerCase()||'',id=title.includes('deutsch')?'de':title.includes('english')?'en':null;el.querySelector('.rf3-recommended')?.remove();if(id===rec){const b=document.createElement('span');b.className='rf3-recommended';b.textContent=`⭐ Recomendado agora · ${due[id]} pendentes`;el.querySelector('.deck-mode')?.insertAdjacentElement('afterend',b);const action=el.querySelector('.deck-action');if(action)action.textContent='Continuar →';}}}
  function ensureSessionButton(){const row=document.querySelector('#view-decks .sync-row');if(!row||document.getElementById('rf3SessionBtn'))return;const b=document.createElement('button');b.id='rf3SessionBtn';b.className='rf2-topbtn';b.type='button';b.textContent='🎛 Sessão';b.onclick=()=>{ensureSessionViews();core.showView('rf3-session');};row.appendChild(b);}

  function backupList(){try{return JSON.parse(localStorage.getItem(BACKUP_KEY)||'[]');}catch{return[];}}
  function stateSignature(){const s=state();return `${(s.reviewLog||[]).length}|${Object.values(s.cards||{}).reduce((n,a)=>n+(a?.length||0),0)}|${Math.max(0,...(s.reviewLog||[]).map(x=>Number(x.ts)||0))}`;}
  function maybeAutoBackup(force=false){
    const list=backupList(),now=Date.now(),sig=stateSignature(),last=list[0];if(!force&&last&&now-last.ts<6*3600000&&last.sig===sig)return;const snapshot=JSON.stringify(state());list.unshift({ts:now,sig,data:snapshot});localStorage.setItem(BACKUP_KEY,JSON.stringify(list.slice(0,5)));renderBackupUi();
  }
  function restoreBackup(i){const list=backupList(),b=list[i];if(!b||!confirm('Restaurar este backup automático? O estado atual será substituído.'))return;try{const x=JSON.parse(b.data),s=state();for(const k of Object.keys(s))delete s[k];Object.assign(s,x);save();core.clearCurrentItem();core.render();alert('Backup restaurado.');}catch{alert('Não foi possível restaurar este backup.');}}
  function ensureBackupUi(){const add=document.getElementById('view-add');if(!add||document.getElementById('rf3BackupPanel'))return;const sec=document.createElement('div');sec.id='rf3BackupPanel';sec.className='section';sec.innerHTML='<h2>Backups automáticos</h2><p>Até 5 snapshots locais do progresso. As gravações de voz não entram nesses backups.</p><div id="rf3BackupList" class="rf3-backups"></div>';add.appendChild(sec);}
  function renderBackupUi(){ensureBackupUi();const box=document.getElementById('rf3BackupList');if(!box)return;const list=backupList();box.innerHTML=list.length?list.map((b,i)=>`<div class="rf3-backup"><span>${new Date(b.ts).toLocaleString('pt-BR')}</span><button class="rf3-btn" data-i="${i}">Restaurar</button></div>`).join(''):'<div class="rf3-muted">O primeiro backup será criado automaticamente.</div>';box.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>restoreBackup(Number(b.dataset.i)));}

  function ensureVersion(){if(document.getElementById('rf3Version'))return;const v=document.createElement('div');v.id='rf3Version';v.className='rf3-version';v.textContent=`Recall v${VERSION}`;document.querySelector('main.app')?.appendChild(v);}

  const baseReview=core.getRenderReview();core.setRenderReview(function(){const r=baseReview();enhanceReview();return r;});
  const baseLib=core.getRenderLibrary();core.setRenderLibrary(function(){const r=baseLib();enhanceLibrary();return r;});
  const baseRender=core.getRender();core.setRender(function(){const r=baseRender();ensureSessionButton();decorateDecks();showSessionChip();return r;});

  document.getElementById('deckGrid')?.addEventListener('click',()=>{if(activePlan){activePlan=null;showSessionChip();}},true);
  document.querySelector('.nav')?.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&b.dataset.view!=='review'&&activePlan){activePlan=null;showSessionChip();}},true);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')maybeAutoBackup(false);});
  setInterval(()=>maybeAutoBackup(false),5*60*1000);

  ensureState();styles();ensureSessionViews();ensureSessionButton();ensureBackupUi();renderBackupUi();ensureVersion();decorateDecks();enhanceReview();maybeAutoBackup(false);
})();
