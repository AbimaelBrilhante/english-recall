(() => {
  'use strict';
  if (window.__recallSpeakingLabBeta) return;
  const core = window.recallCore;
  if (!core) return;
  window.__recallSpeakingLabBeta = true;

  const DB_NAME = 'recallSpeakingLabBetaV1';
  const DB_VERSION = 1;
  const ATTEMPTS = 'attempts';
  const SETTINGS = 'settings';
  const CONTENT_URL = './speaking-lab/sentence-builder-en.json';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  let exercises = [];
  let index = 0;
  let recorder = null;
  let stream = null;
  let chunks = [];
  let recognition = null;
  let transcript = '';
  let recordStartedAt = 0;
  let recordTimer = null;
  let currentBlob = null;
  let currentAudioUrl = null;
  let currentAttemptId = null;
  let speaking = false;

  function openDb(){
    return new Promise((resolve,reject)=>{
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(ATTEMPTS)) db.createObjectStore(ATTEMPTS,{keyPath:'id'});
        if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS,{keyPath:'key'});
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function put(store,value){
    const db = await openDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(store,'readwrite');
      tx.objectStore(store).put(value);
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error);
    });
    db.close();
  }

  async function all(store){
    const db=await openDb();
    const out=await new Promise((resolve,reject)=>{
      const tx=db.transaction(store,'readonly');
      const req=tx.objectStore(store).getAll();
      req.onsuccess=()=>resolve(req.result||[]);
      req.onerror=()=>reject(req.error);
    });
    db.close();
    return out;
  }

  async function clearBetaData(){
    if(!confirm('Excluir gravações e histórico somente do Speaking Lab Beta? O Recall principal não será alterado.')) return;
    const db=await openDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction([ATTEMPTS,SETTINGS],'readwrite');
      tx.objectStore(ATTEMPTS).clear();
      tx.objectStore(SETTINGS).clear();
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error);
    });
    db.close();
    updateHubStats();
    alert('Dados do Speaking Lab Beta excluídos.');
  }

  function injectStyles(){
    if(document.getElementById('slBetaStyle')) return;
    const st=document.createElement('style');
    st.id='slBetaStyle';
    st.textContent=`
      .sl-home-entry{border:1px solid color-mix(in srgb,var(--primary) 34%,var(--line));background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 16%,var(--surface)),var(--surface));border-radius:22px;padding:16px 17px;margin:0 0 20px;display:flex;align-items:center;gap:14px;cursor:pointer;box-shadow:0 10px 30px rgba(46,42,120,.08)}
      .sl-home-icon{width:56px;height:56px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(145deg,#5d50d8,#7a8dff);color:#fff;font-size:27px;box-shadow:0 8px 22px rgba(83,76,210,.28);flex:0 0 auto}.sl-home-copy{min-width:0;flex:1}.sl-home-copy b{display:block;font-size:18px;letter-spacing:-.02em;color:var(--ink)}.sl-home-copy span{display:block;color:var(--muted);font-size:11px;margin-top:4px;line-height:1.35}.sl-home-arrow{font-size:24px;color:var(--primary2);font-weight:800}.sl-beta-pill{display:inline-flex;align-items:center;border:1px solid color-mix(in srgb,var(--primary) 35%,var(--line));background:color-mix(in srgb,var(--primary) 12%,var(--surface));color:var(--primary2);font-size:9px;font-weight:900;border-radius:999px;padding:4px 7px;margin-left:6px;vertical-align:middle}
      .sl-shell{max-width:620px;margin:0 auto}.sl-top{display:flex;align-items:center;gap:10px;margin-bottom:15px}.sl-back{width:42px;height:42px;border:1px solid var(--line);border-radius:13px;background:var(--surface);color:var(--ink);font-size:20px}.sl-title{flex:1}.sl-title h2{font-size:24px;margin:0;color:var(--ink);letter-spacing:-.03em}.sl-title p{margin:4px 0 0;color:var(--muted);font-size:11px}.sl-hub-hero{border:1px solid var(--line);background:linear-gradient(145deg,color-mix(in srgb,var(--primary) 12%,var(--surface)),var(--surface));border-radius:22px;padding:17px;margin-bottom:12px}.sl-hub-hero b{font-size:21px}.sl-hub-hero p{font-size:12px;color:var(--muted);margin:5px 0 12px}.sl-mini-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sl-mini-stat{background:var(--surface2);border-radius:13px;padding:10px}.sl-mini-stat b{display:block;font-size:20px;color:var(--ink)}.sl-mini-stat span{font-size:9.5px;color:var(--muted)}
      .sl-mode-list{display:grid;gap:10px}.sl-mode{width:100%;display:flex;align-items:center;gap:12px;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:19px;padding:14px;text-align:left}.sl-mode:not([disabled]):active{transform:scale(.99)}.sl-mode-icon{width:48px;height:48px;border-radius:16px;display:grid;place-items:center;font-size:23px;background:var(--surface2);flex:0 0 auto}.sl-mode:nth-child(1) .sl-mode-icon{background:color-mix(in srgb,#675bf0 18%,var(--surface2));color:#756aff}.sl-mode:nth-child(2) .sl-mode-icon{background:color-mix(in srgb,#16bfa3 16%,var(--surface2));color:#13a88f}.sl-mode:nth-child(3) .sl-mode-icon{background:color-mix(in srgb,#f28a3e 16%,var(--surface2));color:#d9772f}.sl-mode:nth-child(4) .sl-mode-icon{background:color-mix(in srgb,#3b82f6 16%,var(--surface2));color:#3b82f6}.sl-mode-copy{flex:1;min-width:0}.sl-mode-copy b{display:block;font-size:16px}.sl-mode-copy span{display:block;color:var(--muted);font-size:10.5px;margin-top:4px}.sl-mode-time{font-size:9px;font-weight:850;color:var(--primary2);background:var(--surface2);border-radius:999px;padding:5px 7px}.sl-mode[disabled]{opacity:.55}.sl-mode[disabled] .sl-mode-time{color:var(--muted)}.sl-beta-tools{display:flex;gap:8px;margin-top:12px}.sl-beta-tools button{flex:1;border:1px solid var(--line);background:var(--surface);color:var(--muted);min-height:42px;border-radius:12px;font-size:10px;font-weight:800}
      .sl-progress-line{height:6px;background:var(--surface2);border-radius:999px;overflow:hidden;margin:7px 0 14px}.sl-progress-line i{display:block;height:100%;background:linear-gradient(90deg,var(--primary),#7e8dff);border-radius:999px}.sl-builder-meta{display:flex;align-items:center;gap:7px}.sl-level,.sl-kind{font-size:9px;font-weight:900;padding:4px 7px;border-radius:999px;background:var(--surface2);color:var(--primary2)}.sl-position{margin-left:auto;font-size:10px;color:var(--muted);font-weight:800}
      .sl-prompt-card,.sl-record-card,.sl-result-card{border:1px solid var(--line);background:var(--surface);border-radius:20px;padding:15px;margin-bottom:11px}.sl-audio-orb{width:74px;height:74px;margin:2px auto 8px;border:1px solid color-mix(in srgb,var(--primary) 55%,var(--line));border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--primary) 12%,var(--surface));font-size:28px;color:var(--primary2)}.sl-prompt-card{text-align:center}.sl-prompt-card>small{color:var(--muted);font-size:10px}.sl-reveal{width:100%;margin-top:10px;border:1px solid var(--line);border-radius:12px;background:var(--surface2);color:var(--ink);min-height:40px;font-size:10.5px;font-weight:800}.sl-hidden-text{display:none;margin-top:10px;padding:10px;border-radius:11px;background:var(--surface2);color:var(--muted);font-size:12px;line-height:1.45;text-align:left}.sl-hidden-text.open{display:block}
      .sl-record-card{text-align:center}.sl-mic{width:100px;height:100px;border:0;border-radius:50%;background:linear-gradient(145deg,#6254e8,#7a8dff);color:white;font-size:42px;box-shadow:0 0 0 8px color-mix(in srgb,var(--primary) 10%,transparent),0 12px 30px rgba(76,69,190,.28)}.sl-recording .sl-mic{animation:slPulse 1.35s ease-in-out infinite;background:linear-gradient(145deg,#ef476f,#ff7b95)}@keyframes slPulse{50%{box-shadow:0 0 0 15px rgba(239,71,111,.09),0 12px 30px rgba(239,71,111,.24)}}.sl-record-state{margin-top:12px;font-size:10px;font-weight:900;letter-spacing:.09em;color:var(--muted)}.sl-record-time{font-size:19px;color:var(--ink);font-weight:850;margin-top:3px}.sl-record-help{font-size:9.5px;color:var(--muted);margin-top:7px;line-height:1.4}
      .sl-result-head{display:flex;align-items:center;gap:7px;color:#18a873;font-weight:900;font-size:12px}.sl-result-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}.sl-result-actions button,.sl-bottom button{min-height:44px;border-radius:12px;font-weight:850}.sl-outline{border:1px solid var(--line);background:var(--surface);color:var(--ink)}.sl-primary{border:0;background:linear-gradient(135deg,#6254e8,#7d8dff);color:white}.sl-feedback{margin-top:10px;padding:10px 11px;border-radius:12px;background:var(--surface2);text-align:left;font-size:10.5px;line-height:1.45;color:var(--muted)}.sl-feedback b{color:var(--ink)}.sl-fold{margin-top:8px;border:1px solid var(--line);border-radius:11px;overflow:hidden}.sl-fold button{width:100%;min-height:38px;border:0;background:var(--surface2);color:var(--muted);font-size:10px;text-align:left;padding:0 11px;font-weight:800}.sl-fold div{display:none;padding:10px 11px;font-size:11px;line-height:1.4;color:var(--ink);text-align:left}.sl-fold.open div{display:block}.sl-self{margin-top:11px;text-align:left}.sl-self>span{display:block;font-size:10px;color:var(--muted);margin-bottom:6px}.sl-self-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.sl-self-grid button{min-height:39px;border:1px solid var(--line);background:var(--surface2);color:var(--ink);border-radius:11px;font-size:9.5px;font-weight:800}.sl-self-grid button.on{border-color:var(--primary2);background:color-mix(in srgb,var(--primary) 14%,var(--surface2));color:var(--primary2)}.sl-bottom{display:grid;grid-template-columns:1fr 1.25fr;gap:8px;margin:12px 0 22px}.sl-note{font-size:9px;color:var(--muted);line-height:1.45;text-align:center;margin-top:7px}.sl-unavailable{text-align:center;padding:26px 16px;color:var(--muted);font-size:11px}
      @media(max-width:430px){.sl-home-entry{padding:14px}.sl-home-icon{width:50px;height:50px}.sl-result-actions{grid-template-columns:1fr}.sl-title h2{font-size:22px}.sl-mic{width:92px;height:92px}}
    `;
    document.head.appendChild(st);
  }

  function ensureViews(){
    const main=document.querySelector('main.app');
    if(!main) return false;
    if(!document.getElementById('view-speaking-lab')){
      const hub=document.createElement('section');
      hub.id='view-speaking-lab';hub.className='view';
      hub.innerHTML=`<div class="sl-shell"><div class="sl-top"><button class="sl-back" id="slHubBack">‹</button><div class="sl-title"><h2>Speaking Lab <span class="sl-beta-pill">BETA</span></h2><p>Fale. Ouça. Ajuste. · treinos de 5–15 minutos</p></div></div><div class="sl-hub-hero"><b>Inglês profissional, sem decorar respostas</b><p>Treinos curtos para construir frases com mais rapidez e responder entrevistas com mais naturalidade.</p><div class="sl-mini-stats"><div class="sl-mini-stat"><b id="slAttempts">0</b><span>tentativas no beta</span></div><div class="sl-mini-stat"><b id="slMinutes">0 min</b><span>tempo falado</span></div></div></div><div class="sl-mode-list"><button class="sl-mode" id="slOpenBuilder"><span class="sl-mode-icon">🎙</span><span class="sl-mode-copy"><b>Sentence Builder</b><span>Construa frases B1 → B2 falando</span></span><span class="sl-mode-time">3–5 min</span></button><button class="sl-mode" disabled><span class="sl-mode-icon">⏱</span><span class="sl-mode-copy"><b>60-Second Challenge</b><span>Fluência sob pressão · próxima etapa</span></span><span class="sl-mode-time">em breve</span></button><button class="sl-mode" disabled><span class="sl-mode-icon">🛟</span><span class="sl-mode-copy"><b>Error Rescue</b><span>Corrija padrões recorrentes · próxima etapa</span></span><span class="sl-mode-time">em breve</span></button><button class="sl-mode" disabled><span class="sl-mode-icon">💼</span><span class="sl-mode-copy"><b>Interview Follow-up</b><span>3–5 perguntas conectadas · próxima etapa</span></span><span class="sl-mode-time">em breve</span></button></div><div class="sl-beta-tools"><button id="slRefreshStats">↻ Atualizar histórico</button><button id="slClearBeta">Excluir dados do beta</button></div></div>`;
      main.appendChild(hub);
      document.getElementById('slHubBack').onclick=()=>core.showView('decks');
      document.getElementById('slOpenBuilder').onclick=openBuilder;
      document.getElementById('slRefreshStats').onclick=updateHubStats;
      document.getElementById('slClearBeta').onclick=clearBetaData;
    }
    if(!document.getElementById('view-speaking-builder')){
      const v=document.createElement('section');
      v.id='view-speaking-builder';v.className='view';
      v.innerHTML='<div class="sl-shell"><div class="sl-top"><button class="sl-back" id="slBuilderBack">‹</button><div class="sl-title"><h2>Sentence Builder</h2><p id="slBuilderSub">Voice-first · B1 → B2</p></div></div><div id="slBuilderBody"></div></div>';
      main.appendChild(v);
      document.getElementById('slBuilderBack').onclick=()=>{stopMedia();core.showView('speaking-lab');updateHubStats();};
    }
    return true;
  }

  function ensureHomeEntry(){
    const home=document.getElementById('rv20Home');
    if(!home || document.getElementById('slHomeEntry')) return Boolean(document.getElementById('slHomeEntry'));
    const titles=[...home.querySelectorAll('.rv20-section-title')];
    const actions=titles.find(x=>(x.textContent||'').includes('Ações rápidas'));
    if(!actions) return false;
    const entry=document.createElement('section');
    entry.id='slHomeEntry';entry.className='sl-home-entry';entry.tabIndex=0;
    entry.innerHTML='<div class="sl-home-icon">🎙</div><div class="sl-home-copy"><b>Speaking Lab <span class="sl-beta-pill">BETA</span></b><span>Treino oral B1 → B2 para entrevistas internacionais · 5–15 min</span></div><div class="sl-home-arrow">›</div>';
    actions.insertAdjacentElement('beforebegin',entry);
    const open=()=>{ensureViews();core.showView('speaking-lab');updateHubStats();};
    entry.onclick=open;entry.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};
    return true;
  }

  async function loadContent(){
    if(exercises.length) return exercises;
    try{
      const r=await fetch(`${CONTENT_URL}?v=${Date.now()}`,{cache:'no-store'});
      if(!r.ok) throw new Error('content');
      const data=await r.json();
      exercises=Array.isArray(data.exercises)?data.exercises:[];
    }catch{ exercises=[]; }
    return exercises;
  }

  function currentExercise(){ return exercises[index] || null; }
  function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();}
  function words(s){return norm(s).split(' ').filter(Boolean);}
  function distance(a,b){const m=a.length,n=b.length,dp=Array.from({length:m+1},()=>Array(n+1).fill(0));for(let i=0;i<=m;i++)dp[i][0]=i;for(let j=0;j<=n;j++)dp[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return dp[m][n];}
  function similarity(a,b){const x=words(a),y=words(b);if(!x.length||!y.length)return 0;return 1-distance(x,y)/Math.max(x.length,y.length);}

  function evaluate(ex,heard){
    if(!heard) return {kind:'none',html:'<b>Resposta gravada.</b> A transcrição automática não ficou disponível. Ouça sua gravação, compare com a resposta-modelo e faça a autoavaliação.'};
    if(ex.openEnded){
      const n=norm(heard);const hits=(ex.focus||[]).filter(x=>n.includes(norm(x)));
      return {kind:'estimate',html:`<b>Transcrição disponível.</b> O Recall encontrou ${hits.length} de ${ex.focus?.length||0} elementos sugeridos para este exercício${hits.length?`: ${hits.map(esc).join(', ')}`:''}. Isso não é uma nota de speaking nem uma avaliação de pronúncia.`};
    }
    const refs=(ex.accepted?.length?ex.accepted:[ex.model]);
    const best=Math.max(...refs.map(x=>similarity(x,heard)),0);
    if(best>=.86)return {kind:'close',html:'<b>Muito próxima da referência.</b> A transcrição capturou praticamente a mesma estrutura da resposta esperada. Isso não mede pronúncia.'};
    if(best>=.66)return {kind:'partial',html:'<b>Boa direção.</b> A transcrição ficou próxima da referência, mas há diferenças de estrutura ou palavras. Compare com o modelo antes de avançar.'};
    return {kind:'different',html:'<b>Vale comparar com o modelo.</b> A transcrição ficou diferente das respostas de referência. Pode ser uma resposta alternativa válida ou uma oportunidade de ajuste — o beta não presume erro sem análise semântica.'};
  }

  function cancelSpeech(){
    try{speechSynthesis.cancel();}catch{}
    try{window.recallNativeSpeech?.cancel?.();}catch{}
  }

  function speakOne(text,lang){
    return new Promise(resolve=>{
      if(!text){resolve();return;}
      const u=new SpeechSynthesisUtterance(text);u.lang=lang||'en-US';u.rate=lang?.startsWith('pt')?.98:.94;
      let done=false;const finish=()=>{if(done)return;done=true;resolve();};u.onend=finish;u.onerror=finish;
      try{
        if(/^pt/i.test(u.lang)) speechSynthesis.speak(u);
        else if(window.recallNativeSpeech?.speak){window.recallNativeSpeech.resume?.();window.recallNativeSpeech.speak(u);}
        else speechSynthesis.speak(u);
      }catch{finish();}
      setTimeout(finish,Math.max(4500,Math.min(12000,text.length*95)));
    });
  }

  async function playPrompt(){
    const ex=currentExercise();if(!ex||speaking)return;
    speaking=true;cancelSpeech();
    const orb=document.getElementById('slPromptOrb');if(orb)orb.textContent='🔊';
    for(const seg of (ex.promptSegments||[])){await speakOne(seg.text,seg.lang);await sleep(180);}
    speaking=false;
  }

  async function playModel(){
    const ex=currentExercise();if(!ex)return;
    cancelSpeech();
    await speakOne(ex.model,'en-US');
  }

  function timeText(ms){const s=Math.max(0,Math.round(ms/1000));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
  function updateTimer(){const el=document.getElementById('slRecordTime');if(el&&recordStartedAt)el.textContent=timeText(Date.now()-recordStartedAt);}

  async function startMedia(){
    if(recorder){await stopMedia(false);return;}
    if(!navigator.mediaDevices?.getUserMedia){alert('Este navegador não disponibilizou gravação de áudio.');return;}
    const ex=currentExercise();if(!ex)return;
    cancelSpeech();
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:true});
      chunks=[];transcript='';recordStartedAt=Date.now();
      const mime=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(x=>MediaRecorder.isTypeSupported?.(x))||'';
      recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
      recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
      recorder.start();
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(SR){
        try{
          recognition=new SR();recognition.lang='en-US';recognition.interimResults=false;recognition.continuous=true;
          recognition.onresult=e=>{transcript=Array.from(e.results).map(r=>r[0]?.transcript||'').join(' ').trim();};
          recognition.start();
        }catch{recognition=null;}
      }
      document.getElementById('slRecordCard')?.classList.add('sl-recording');
      const state=document.getElementById('slRecordState');if(state)state.textContent='RESPONDENDO…';
      const mic=document.getElementById('slMic');if(mic)mic.textContent='■';
      recordTimer=setInterval(updateTimer,250);updateTimer();
    }catch{
      cleanupMedia();alert('Não consegui acessar o microfone. Verifique a permissão do Safari/Recall Beta.');
    }
  }

  async function stopMedia(silent=false){
    if(!recorder){cleanupMedia();return;}
    const mr=recorder;const started=recordStartedAt;const ex=currentExercise();
    const blob=await new Promise(resolve=>{mr.onstop=()=>resolve(new Blob(chunks,{type:mr.mimeType||'audio/mp4'}));try{mr.stop();}catch{resolve(new Blob(chunks));}});
    try{recognition?.stop();}catch{}
    await sleep(320);
    const heard=transcript.trim();const duration=Math.max(0,Date.now()-started);
    cleanupMedia(false);
    if(!ex||!blob.size){if(!silent)renderBuilder();return;}
    currentBlob=blob;
    if(currentAudioUrl)URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl=URL.createObjectURL(blob);
    currentAttemptId=`${ex.id}|${Date.now()}`;
    await put(ATTEMPTS,{id:currentAttemptId,exerciseId:ex.id,level:ex.level,type:ex.type,ts:Date.now(),durationMs:duration,transcript:heard,blob,selfRating:null});
    if(!silent)renderBuilder({completed:true,duration,heard});
  }

  function cleanupMedia(resetStarted=true){
    try{stream?.getTracks().forEach(t=>t.stop());}catch{}
    try{recognition?.abort?.();}catch{}
    recorder=null;stream=null;chunks=[];recognition=null;transcript='';
    if(recordTimer)clearInterval(recordTimer);recordTimer=null;
    if(resetStarted)recordStartedAt=0;
  }

  function playMine(){
    if(!currentAudioUrl)return;
    const a=new Audio(currentAudioUrl);a.play().catch(()=>{});
  }

  async function setSelfRating(value,btn){
    document.querySelectorAll('[data-sl-self]').forEach(x=>x.classList.toggle('on',x===btn));
    if(!currentAttemptId)return;
    const rows=await all(ATTEMPTS);const row=rows.find(x=>x.id===currentAttemptId);if(!row)return;row.selfRating=value;await put(ATTEMPTS,row);
  }

  function toggleFold(btn){btn.parentElement?.classList.toggle('open');}

  function renderBuilder(result=null){
    const ex=currentExercise(),body=document.getElementById('slBuilderBody');if(!body)return;
    if(!ex){body.innerHTML='<div class="sl-unavailable">Não consegui carregar os exercícios do beta.</div>';return;}
    const pct=Math.round((index+1)/exercises.length*100);
    const completed=Boolean(result?.completed);
    const feedback=completed?evaluate(ex,result.heard):null;
    body.innerHTML=`<div class="sl-builder-meta"><span class="sl-level">${esc(ex.level)}</span><span class="sl-kind">${esc(ex.label)}</span><span class="sl-position">${index+1}/${exercises.length}</span></div><div class="sl-progress-line"><i style="width:${pct}%"></i></div><div class="sl-prompt-card"><button class="sl-audio-orb" id="slPromptOrb" type="button">🔊</button><small>Toque para repetir a instrução</small><button class="sl-reveal" id="slShowPrompt" type="button">⌄ Mostrar instrução</button><div class="sl-hidden-text" id="slPromptText">${esc(ex.promptText)}</div></div><div class="sl-record-card ${recorder?'sl-recording':''}" id="slRecordCard"><button class="sl-mic" id="slMic" type="button">${recorder?'■':'🎙'}</button><div class="sl-record-state" id="slRecordState">${recorder?'RESPONDENDO…':completed?'RESPOSTA SALVA':'TOQUE E RESPONDA EM INGLÊS'}</div><div class="sl-record-time" id="slRecordTime">${completed?timeText(result.duration):'00:00'}</div><div class="sl-record-help">Nada precisa ser digitado. A transcrição é opcional e depende do navegador.</div></div>${completed?`<div class="sl-result-card"><div class="sl-result-head">✓ Resposta salva localmente</div><div class="sl-result-actions"><button class="sl-outline" id="slPlayMine">▶ Minha resposta</button><button class="sl-primary" id="slPlayModel">▶ Resposta-modelo</button></div><div class="sl-feedback">${feedback.html}</div>${result.heard?`<div class="sl-fold"><button type="button">▣ Mostrar transcrição</button><div>${esc(result.heard)}</div></div>`:''}<div class="sl-fold"><button type="button">▣ Mostrar resposta escrita</button><div>${esc(ex.model)}</div></div><div class="sl-self"><span>Como saiu? · autoavaliação</span><div class="sl-self-grid"><button data-sl-self="stuck">😣 Travei</button><button data-sl-self="effort">😐 Com esforço</button><button data-sl-self="natural">🙂 Natural</button></div></div><div class="sl-note">Correspondência textual, quando exibida, usa apenas a transcrição. Não é uma nota de pronúncia.</div></div><div class="sl-bottom"><button class="sl-outline" id="slRepeat">↻ Repetir</button><button class="sl-primary" id="slNext">Próximo →</button></div>`:''}`;
    document.getElementById('slPromptOrb').onclick=playPrompt;
    document.getElementById('slShowPrompt').onclick=()=>document.getElementById('slPromptText').classList.toggle('open');
    document.getElementById('slMic').onclick=()=>recorder?stopMedia(false):startMedia();
    document.querySelectorAll('.sl-fold>button').forEach(b=>b.onclick=()=>toggleFold(b));
    if(completed){
      document.getElementById('slPlayMine').onclick=playMine;
      document.getElementById('slPlayModel').onclick=playModel;
      document.querySelectorAll('[data-sl-self]').forEach(b=>b.onclick=()=>setSelfRating(b.dataset.slSelf,b));
      document.getElementById('slRepeat').onclick=()=>{currentBlob=null;currentAttemptId=null;renderBuilder();playPrompt();};
      document.getElementById('slNext').onclick=()=>{currentBlob=null;currentAttemptId=null;index=(index+1)%exercises.length;renderBuilder();playPrompt();};
    }
  }

  async function openBuilder(){
    await loadContent();
    index=0;currentBlob=null;currentAttemptId=null;
    core.showView('speaking-builder');
    renderBuilder();
    playPrompt();
  }

  async function updateHubStats(){
    try{
      const rows=await all(ATTEMPTS);const ms=rows.reduce((n,x)=>n+Number(x.durationMs||0),0);
      const a=document.getElementById('slAttempts'),m=document.getElementById('slMinutes');
      if(a)a.textContent=String(rows.length);if(m)m.textContent=`${Math.round(ms/60000)} min`;
    }catch{}
  }

  function stopMedia(){
    if(recorder){try{recorder.stop();}catch{}}
    cleanupMedia();
  }

  injectStyles();ensureViews();ensureHomeEntry();
  const mo=new MutationObserver(()=>{ensureViews();ensureHomeEntry();});
  mo.observe(document.body,{childList:true,subtree:true});
  let tries=0;const timer=setInterval(()=>{ensureViews();ensureHomeEntry();if(++tries>60)clearInterval(timer);},250);
})();