(() => {
  'use strict';
  if (window.__recallPracticeV16) return;
  const core = window.recallCore;
  if (!core) return;
  window.__recallPracticeV16 = true;

  const VERSION = '16.0';
  const state = () => core.getState();
  const DECKS = core.DECKS;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9äöüß\s']/gi,' ').replace(/\s+/g,' ').trim();

  const INTERVIEW_DB = 'recallInterviewV1';
  const INTERVIEW_STORE = 'answers';
  const QUESTIONS = [
    {id:'intro', q:'Tell me about yourself.', keywords:['data','analyst','tax','experience','automation'], chunks:['I have been working with…','Currently, I work as…','One of my main strengths is…']},
    {id:'project', q:"Tell me about a project you're proud of.", keywords:['project','data','automation','manual','result','team'], chunks:['One project I’m really proud of is…','The main challenge was…','As a result, we…']},
    {id:'strengths', q:'What are your main strengths as a data analyst?', keywords:['business','data','technical','problem','solution'], chunks:['One of my main strengths is…','I can understand a business problem and…','I combine business knowledge with…']},
    {id:'approach', q:'How do you approach a new business problem?', keywords:['understand','process','data','source','validate','solution'], chunks:['I usually start by…','Then I identify…','After that, I would…']},
    {id:'challenge', q:'Tell me about a challenge you faced in a project.', keywords:['challenge','problem','business','rules','users','validate'], chunks:['The main challenge was…','First, I tried to understand…','I worked directly with…']},
    {id:'international', q:'Why are you looking for an international opportunity?', keywords:['international','opportunity','experience','learn','career'], chunks:['I am looking for…','I want to apply my experience in…','I am open to learning…']},
    {id:'quality', q:'How do you ensure data quality?', keywords:['source','validate','quality','inconsistencies','business'], chunks:['The first step is to validate…','I would check the quality of…','I validate the results with…']},
    {id:'impact', q:'Tell me about an automation that created measurable impact.', keywords:['automation','manual','hours','result','process','team'], chunks:['This automation saves…','The result was…','The automation also reduced…']},
    {id:'tools', q:'What tools do you use in your work?', keywords:['sql','snowflake','qlik','python','data'], chunks:['I mainly work with…','I use SQL to…','I use Qlik Sense to…']},
    {id:'questions', q:'Do you have any questions for us?', keywords:['role','team','challenges','success','months'], chunks:['Could you tell me more about this role?','What are the main challenges of this position?','How is success measured in this role?']}
  ];

  let interviewIndex = 0;
  let interviewRecorder = null;
  let interviewStream = null;
  let interviewChunks = [];
  let interviewRecognition = null;
  let interviewTranscript = '';
  let interviewAudioUrl = null;

  function save(){ core.save(); }
  function cards(deckId){ return state().cards?.[deckId] || []; }
  function logsFor(card){ return (state().reviewLog || []).filter(x => x.id === card.id).slice(-16); }
  function totalLapses(card){ return Number(card.schedules?.recognition?.lapses||0) + Number(card.schedules?.production?.lapses||0); }
  function totalReps(card){ return Number(card.schedules?.recognition?.reps||0) + Number(card.schedules?.production?.reps||0); }
  function isBuried(card){ return Boolean(card.buriedUntilDay && core.dayKey() < card.buriedUntilDay); }

  function weakScore(card){
    const logs = logsFor(card);
    const again = logs.filter(x => x.rating === 'again').length;
    const hard = logs.filter(x => x.rating === 'hard').length;
    const prod = card.schedules?.production || {};
    const rec = card.schedules?.recognition || {};
    let score = totalLapses(card) * 6 + again * 4 + hard * 2;
    if (Number(prod.reps||0) === 0) score += 3;
    if (Number(prod.interval||0) <= 3) score += 2;
    if (Number(rec.interval||0) <= 3) score += 1;
    if (totalReps(card) <= 2) score += 1;
    return score;
  }

  function recalcWeakTags(deckId, limit = 20){
    const eligible = cards(deckId).filter(c => !c.suspended && !isBuried(c));
    const ranked = [...eligible].sort((a,b) => weakScore(b) - weakScore(a) || totalLapses(b) - totalLapses(a) || Number(a.created||0) - Number(b.created||0));
    const count = Math.min(limit, ranked.length);
    const chosen = new Set(ranked.slice(0,count).map(c => c.id));
    for (const c of cards(deckId)) {
      const tags = Array.isArray(c.tags) ? c.tags.filter(t => t !== 'WeakSpot') : [];
      if (chosen.has(c.id)) tags.push('WeakSpot');
      c.tags = [...new Set(tags)];
    }
    save();
    return count;
  }

  function isChunk(card, deckId){
    const tags = new Set(card.tags || []);
    const wc = normalize(card.front).split(' ').filter(Boolean).length;
    if (deckId === 'en') return wc <= 10 && (tags.has('Communication') || tags.has('Idioms'));
    return wc <= 8 && (tags.has('Communication') || tags.has('Greetings') || tags.has('Directions'));
  }

  function refreshChunkTags(deckId){
    let count = 0;
    for (const c of cards(deckId)) {
      const tags = Array.isArray(c.tags) ? c.tags.filter(t => t !== 'Chunks') : [];
      if (isChunk(c,deckId)) { tags.push('Chunks'); count++; }
      c.tags = [...new Set(tags)];
    }
    save();
    return count;
  }

  function styles(){
    if (document.getElementById('rf16Style')) return;
    const s = document.createElement('style');
    s.id = 'rf16Style';
    s.textContent = `
      .rf16-presets{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 12px}.rf16-preset{border:1px solid var(--line);background:var(--surface2);color:var(--ink);border-radius:13px;padding:11px 8px;font-size:11px;font-weight:850;min-height:58px}.rf16-preset b{display:block;font-size:13px;margin-bottom:3px;color:var(--primary)}
      .rf16-diff{margin-top:9px;padding:9px 10px;border-radius:11px;background:var(--surface);border:1px solid var(--line);font-size:11px;line-height:1.65}.rf16-diff-row{margin-top:5px}.rf16-word{display:inline-block;padding:1px 4px;border-radius:5px;margin:1px}.rf16-ok{background:#e7f7ef;color:#116c49}.rf16-miss{background:#ffe8ea;color:#9e3040;text-decoration:line-through}.rf16-extra{background:#fff2d9;color:#875600}.rf16-neutral{background:var(--surface2);color:var(--muted)}
      html[data-recall-theme="dark"] .rf16-ok{background:#193a2d;color:#9be4bf}html[data-recall-theme="dark"] .rf16-miss{background:#4a242a;color:#ffb3bd}html[data-recall-theme="dark"] .rf16-extra{background:#49381d;color:#ffd38a}
      .rf16-question{background:var(--surface2);border-radius:18px;padding:20px;margin:12px 0;text-align:center}.rf16-question small{display:block;color:var(--muted);font-weight:800}.rf16-question strong{display:block;font-size:23px;line-height:1.3;color:var(--accent);margin:10px 0}.rf16-interview-controls{display:flex;gap:8px;flex-wrap:wrap}.rf16-interview-controls button{flex:1 1 135px}.rf16-feedback{margin-top:12px;display:grid;gap:8px}.rf16-feedback>div{background:var(--surface2);border-radius:12px;padding:10px;font-size:12px;line-height:1.45}.rf16-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}.rf16-chip{background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:4px 7px;font-size:10px;color:var(--muted);font-weight:800}
      @media(max-width:430px){.rf16-presets{grid-template-columns:1fr}.rf16-question strong{font-size:20px}}
    `;
    document.head.appendChild(s);
  }

  function setSessionConfig({deckId, source, tag, mode='production', size='20'}){
    const deck = document.getElementById('rf3Deck');
    const type = document.getElementById('rf3Type');
    const sourceEl = document.getElementById('rf3Source');
    const modeEl = document.getElementById('rf3Mode');
    const sizeEl = document.getElementById('rf3Size');
    const tagEl = document.getElementById('rf3Tag');
    if (!deck || !type || !sourceEl || !modeEl || !sizeEl || !tagEl) return false;
    deck.value = deckId; type.value = 'cram'; sourceEl.value = source; modeEl.value = mode; sizeEl.value = size; tagEl.value = tag || '';
    document.getElementById('rf3StartSession')?.click();
    return true;
  }

  function startWeakSpots(){
    const deckId = document.getElementById('rf3Deck')?.value || core.selectedDeck();
    const n = recalcWeakTags(deckId,20);
    const msg = document.getElementById('rf3SessionMsg');
    if (!n) { if (msg) msg.textContent = 'Ainda não há cards suficientes para montar Weak spots.'; return; }
    setSessionConfig({deckId,source:'tag',tag:'WeakSpot',mode:'production',size:'20'});
  }

  function startChunks(){
    const deckId = document.getElementById('rf3Deck')?.value || core.selectedDeck();
    const n = refreshChunkTags(deckId);
    const msg = document.getElementById('rf3SessionMsg');
    if (!n) { if (msg) msg.textContent = 'Não encontrei chunks nesse deck ainda.'; return; }
    setSessionConfig({deckId,source:'tag',tag:'Chunks',mode:'production',size:'20'});
  }

  function addSessionPresets(){
    const view = document.getElementById('view-rf3-session');
    const grid = view?.querySelector('.rf3-session-grid');
    if (!view || !grid || document.getElementById('rf16Presets')) return Boolean(document.getElementById('rf16Presets'));
    const wrap = document.createElement('div');
    wrap.id = 'rf16Presets'; wrap.className = 'rf16-presets';
    wrap.innerHTML = `
      <button class="rf16-preset" id="rf16Weak"><b>⚠ Weak spots</b>20 pontos mais fracos</button>
      <button class="rf16-preset" id="rf16Chunks"><b>🧩 Chunks</b>produção rápida</button>
      <button class="rf16-preset" id="rf16Interview"><b>🎤 Interview</b>simulação livre</button>`;
    grid.insertAdjacentElement('beforebegin',wrap);
    document.getElementById('rf16Weak').onclick = startWeakSpots;
    document.getElementById('rf16Chunks').onclick = startChunks;
    document.getElementById('rf16Interview').onclick = openInterview;
    return true;
  }

  function wordTokens(text){ return (String(text||'').match(/[A-Za-zÀ-ÖØ-öø-ÿÄÖÜäöüß0-9'’−-]+/g) || []); }
  function normToken(t){ return normalize(t).replace(/\s/g,''); }
  function alignWords(expected, actual){
    const a = wordTokens(expected), b = wordTokens(actual), m=a.length, n=b.length;
    const dp = Array.from({length:m+1},()=>Array(n+1).fill(0));
    for(let i=0;i<=m;i++)dp[i][0]=i; for(let j=0;j<=n;j++)dp[0][j]=j;
    for(let i=1;i<=m;i++) for(let j=1;j<=n;j++) {
      const same = normToken(a[i-1]) === normToken(b[j-1]);
      dp[i][j] = Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(same?0:1));
    }
    const ops=[]; let i=m,j=n;
    while(i>0||j>0){
      if(i>0&&j>0&&normToken(a[i-1])===normToken(b[j-1])&&dp[i][j]===dp[i-1][j-1]){ops.push({t:'ok',e:a[i-1],a:b[j-1]});i--;j--;continue;}
      if(i>0&&j>0&&dp[i][j]===dp[i-1][j-1]+1){ops.push({t:'sub',e:a[i-1],a:b[j-1]});i--;j--;continue;}
      if(i>0&&dp[i][j]===dp[i-1][j]+1){ops.push({t:'del',e:a[i-1],a:''});i--;continue;}
      if(j>0){ops.push({t:'ins',e:'',a:b[j-1]});j--;continue;}
    }
    return ops.reverse();
  }

  function decorateSpeechDiff(){
    const box = document.getElementById('rf3RecordBox');
    const card = core.current()?.card;
    if (!box || !card) return;
    const transcript = String(card.lastSpeechTranscript || '').trim();
    if (!transcript) { box.querySelector('#rf16SpeechDiff')?.remove(); return; }
    const sig = `${card.id}|${transcript}`;
    let out = box.querySelector('#rf16SpeechDiff');
    if (out?.dataset.sig === sig) return;
    const ops = alignWords(card.front, transcript);
    const expected = ops.filter(o=>o.e).map(o=>`<span class="rf16-word ${o.t==='ok'?'rf16-ok':'rf16-miss'}">${esc(o.e)}</span>`).join(' ');
    const heard = ops.filter(o=>o.a).map(o=>`<span class="rf16-word ${o.t==='ok'?'rf16-ok':'rf16-extra'}">${esc(o.a)}</span>`).join(' ');
    if (!out) { out=document.createElement('div');out.id='rf16SpeechDiff';out.className='rf16-diff';box.appendChild(out); }
    out.dataset.sig=sig;
    out.innerHTML=`<b>Comparação palavra por palavra</b><div class="rf16-diff-row"><span class="rf3-muted">Esperado</span><br>${expected||'<span class="rf16-neutral">—</span>'}</div><div class="rf16-diff-row"><span class="rf3-muted">Reconhecido</span><br>${heard||'<span class="rf16-neutral">—</span>'}</div><div class="rf3-muted" style="margin-top:6px">Verde = reconhecido · vermelho = faltou/trocou · amarelo = palavra diferente ou extra.</div>`;
  }

  function watchSpeechDiff(){
    const target = document.getElementById('view-review');
    if (!target || target.dataset.rf16Watch === '1') return;
    target.dataset.rf16Watch='1';
    new MutationObserver(()=>requestAnimationFrame(decorateSpeechDiff)).observe(target,{childList:true,subtree:true,characterData:true});
    decorateSpeechDiff();
  }

  function openInterviewDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(INTERVIEW_DB,1);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(INTERVIEW_STORE))db.createObjectStore(INTERVIEW_STORE,{keyPath:'id'});};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
  }
  async function saveInterviewAnswer(q,blob,transcript){
    try{const db=await openInterviewDb();await new Promise((resolve,reject)=>{const tx=db.transaction(INTERVIEW_STORE,'readwrite');tx.objectStore(INTERVIEW_STORE).put({id:q.id,blob,transcript,updatedAt:Date.now()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}catch{}
  }
  async function loadInterviewAnswer(q){
    try{const db=await openInterviewDb();const val=await new Promise((resolve,reject)=>{const tx=db.transaction(INTERVIEW_STORE,'readonly');const r=tx.objectStore(INTERVIEW_STORE).get(q.id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});db.close();return val;}catch{return null;}
  }

  function ensureInterviewView(){
    const main=document.querySelector('main.app');
    if(!main || document.getElementById('view-rf16-interview')) return;
    const v=document.createElement('section');v.id='view-rf16-interview';v.className='view';
    v.innerHTML=`<div class="section"><div class="rf2-head"><h2>🎤 Interview Simulator</h2><button id="rf16IntBack" class="secondary-btn">← Sessão</button></div><p>Responda livremente. A gravação fica apenas neste iPhone e não altera o SRS.</p><div class="rf16-question"><small id="rf16IntPos">1/${QUESTIONS.length}</small><strong id="rf16IntQuestion"></strong><button id="rf16IntHear" class="rf3-btn">▶ Ouvir pergunta</button></div><div class="rf16-interview-controls"><button id="rf16IntRecord" class="rf3-btn primary">🎙 Responder</button><button id="rf16IntPlay" class="rf3-btn" disabled>▶ Minha resposta</button></div><div id="rf16IntStatus" class="msg"></div><div id="rf16IntFeedback" class="rf16-feedback"></div><div class="rf16-interview-controls" style="margin-top:12px"><button id="rf16IntPrev" class="rf3-btn">← Anterior</button><button id="rf16IntNext" class="rf3-btn primary">Próxima →</button></div></div>`;
    main.appendChild(v);
    document.getElementById('rf16IntBack').onclick=()=>{stopInterviewRecording(true);core.showView('rf3-session');};
    document.getElementById('rf16IntHear').onclick=()=>{try{speechSynthesis.cancel();}catch{}core.speakText(QUESTIONS[interviewIndex].q,'en',1);};
    document.getElementById('rf16IntRecord').onclick=()=>interviewRecorder?stopInterviewRecording(false):startInterviewRecording();
    document.getElementById('rf16IntPlay').onclick=playInterviewAnswer;
    document.getElementById('rf16IntPrev').onclick=()=>{if(interviewRecorder)return;interviewIndex=(interviewIndex-1+QUESTIONS.length)%QUESTIONS.length;renderInterview();};
    document.getElementById('rf16IntNext').onclick=()=>{if(interviewRecorder)return;interviewIndex=(interviewIndex+1)%QUESTIONS.length;renderInterview();};
  }

  async function renderInterview(){
    ensureInterviewView();
    const q=QUESTIONS[interviewIndex];
    document.getElementById('rf16IntPos').textContent=`${interviewIndex+1}/${QUESTIONS.length}`;
    document.getElementById('rf16IntQuestion').textContent=q.q;
    document.getElementById('rf16IntStatus').textContent='';
    const rec=await loadInterviewAnswer(q);
    const play=document.getElementById('rf16IntPlay');if(play)play.disabled=!rec?.blob;
    renderInterviewFeedback(q,rec?.transcript||'');
  }

  function renderInterviewFeedback(q, transcript){
    const el=document.getElementById('rf16IntFeedback');if(!el)return;
    if(!transcript){el.innerHTML=`<div><b>Depois da resposta</b><br><span class="rf3-muted">Se o reconhecimento de fala estiver disponível, o Recall mostrará os pontos cobertos e chunks úteis para fortalecer sua resposta.</span></div>`;return;}
    const text=normalize(transcript);const hits=q.keywords.filter(k=>text.includes(normalize(k)));const missing=q.keywords.filter(k=>!text.includes(normalize(k)));const words=wordTokens(transcript).length;
    el.innerHTML=`<div><b>Transcrição</b><br>${esc(transcript)}<div class="rf3-muted" style="margin-top:5px">${words} palavras</div></div><div><b>Pontos identificados</b><div class="rf16-chips">${(hits.length?hits:['nenhum dos pontos sugeridos']).map(x=>`<span class="rf16-chip">${esc(x)}</span>`).join('')}</div>${missing.length?`<div class="rf3-muted" style="margin-top:7px">Você pode considerar também: ${missing.map(esc).join(', ')}.</div>`:''}</div><div><b>Chunks úteis</b><div class="rf16-chips">${q.chunks.map(x=>`<span class="rf16-chip">${esc(x)}</span>`).join('')}</div></div>`;
  }

  async function startInterviewRecording(){
    if(!navigator.mediaDevices?.getUserMedia){alert('Gravação não disponível neste navegador.');return;}
    try{
      interviewStream=await navigator.mediaDevices.getUserMedia({audio:true});interviewChunks=[];interviewTranscript='';
      const mime=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(x=>MediaRecorder.isTypeSupported?.(x))||'';
      interviewRecorder=new MediaRecorder(interviewStream,mime?{mimeType:mime}:undefined);interviewRecorder.ondataavailable=e=>{if(e.data?.size)interviewChunks.push(e.data);};interviewRecorder.start();
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(SR){try{interviewRecognition=new SR();interviewRecognition.lang='en-US';interviewRecognition.interimResults=false;interviewRecognition.continuous=true;interviewRecognition.onresult=e=>{interviewTranscript=Array.from(e.results).map(r=>r[0]?.transcript||'').join(' ').trim();};interviewRecognition.start();}catch{interviewRecognition=null;}}
      const b=document.getElementById('rf16IntRecord');if(b){b.textContent='■ Parar';b.classList.add('primary');}document.getElementById('rf16IntStatus').textContent='Gravando sua resposta…';
    }catch{alert('Não consegui acessar o microfone. Verifique a permissão do Safari/Recall.');cleanupInterview();}
  }

  async function stopInterviewRecording(silent=false){
    if(!interviewRecorder){cleanupInterview();return;}
    const mr=interviewRecorder,q=QUESTIONS[interviewIndex];
    const blob=await new Promise(resolve=>{mr.onstop=()=>resolve(new Blob(interviewChunks,{type:mr.mimeType||'audio/mp4'}));try{mr.stop();}catch{resolve(new Blob(interviewChunks));}});
    try{interviewRecognition?.stop();}catch{}
    await new Promise(r=>setTimeout(r,250));const transcript=interviewTranscript.trim();
    if(blob.size&&!silent)await saveInterviewAnswer(q,blob,transcript);
    cleanupInterview();const b=document.getElementById('rf16IntRecord');if(b)b.textContent='🎙 Responder';
    if(!silent){document.getElementById('rf16IntStatus').textContent=transcript?'Resposta salva localmente.':'Resposta salva. A transcrição não ficou disponível neste aparelho.';await renderInterview();}
  }
  function cleanupInterview(){try{interviewStream?.getTracks().forEach(t=>t.stop());}catch{}interviewRecorder=null;interviewStream=null;interviewChunks=[];interviewRecognition=null;interviewTranscript='';}
  async function playInterviewAnswer(){const q=QUESTIONS[interviewIndex],rec=await loadInterviewAnswer(q);if(!rec?.blob)return;if(interviewAudioUrl)URL.revokeObjectURL(interviewAudioUrl);interviewAudioUrl=URL.createObjectURL(rec.blob);const a=new Audio(interviewAudioUrl);a.play().catch(()=>{});}

  function openInterview(){ensureInterviewView();core.showView('rf16-interview');renderInterview();}

  function setVersion(){document.querySelectorAll('.rf3-version').forEach(el=>el.textContent=`Recall v${VERSION}`);}

  function init(){
    styles();
    refreshChunkTags('en');refreshChunkTags('de');recalcWeakTags('en',20);recalcWeakTags('de',20);
    ensureInterviewView();addSessionPresets();watchSpeechDiff();setVersion();
    let tries=0;const t=setInterval(()=>{tries++;addSessionPresets();watchSpeechDiff();setVersion();if(tries>16)clearInterval(t);},350);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
