(() => {
  'use strict';
  if (window.__recallHandsfreeSmartV19) return;
  const core = window.recallCore;
  if (!core) return;
  window.__recallHandsfreeSmartV19 = true;

  const DECKS = core.DECKS;
  const state = () => core.getState();
  const PREF_KEY = 'recallHandsfreeSmartV19';
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  let running = false;
  let token = 0;
  let wake = null;
  let player = null;

  function loadPrefs(){
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; }
    catch { return {}; }
  }
  function savePrefs(p){
    try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch {}
  }
  function updatePrefs(){
    const p = loadPrefs();
    for (const id of ['rf2HfDeck','rf2HfSource','rf19HfSize','rf19HfOrder','rf19HfLoop','rf2HfMode','rf2HfPause','rf2HfRepeats']) {
      const el = document.getElementById(id); if (el) p[id] = el.value;
    }
    const pt = document.getElementById('rf2HfPt'); if (pt) p.rf2HfPt = pt.checked;
    const tag = document.getElementById('rf19HfTag'); if (tag) p.rf19HfTag = tag.value;
    savePrefs(p);
  }

  function allCards(deckId){
    return (state().cards?.[deckId] || []).filter(c => !c.suspended);
  }
  function cardLogs(card){
    return (state().reviewLog || []).filter(r => r.id === card.id);
  }
  function reps(card){
    return Number(card.schedules?.recognition?.reps || 0) + Number(card.schedules?.production?.reps || 0);
  }
  function lapses(card){
    return Number(card.schedules?.recognition?.lapses || 0) + Number(card.schedules?.production?.lapses || 0);
  }
  function difficultyScore(card){
    const history = cardLogs(card);
    if (!history.length && !reps(card)) return -Infinity;
    const recent = history.slice(-12);
    let score = lapses(card) * 4;
    for (const r of recent) {
      if (r.rating === 'again') score += 5;
      else if (r.rating === 'hard') score += 2;
      if (r.direction === 'production' && (r.rating === 'again' || r.rating === 'hard')) score += 1;
    }
    const last = recent[recent.length - 1];
    if (last?.rating === 'again') score += 3;
    else if (last?.rating === 'hard') score += 1;
    return score;
  }
  function weakCards(deckId){
    return allCards(deckId)
      .map(card => ({card, score:difficultyScore(card)}))
      .filter(x => Number.isFinite(x.score) && x.score > 0)
      .sort((a,b) => b.score - a.score || Number(a.card.created||0) - Number(b.card.created||0))
      .map(x => x.card);
  }
  function recentMissCards(deckId){
    const allowed = new Set(allCards(deckId).map(c => c.id));
    const out = [], seen = new Set();
    const cutoff = Date.now() - 30 * 86400000;
    const logs = [...(state().reviewLog || [])].reverse();
    for (const r of logs) {
      if (r.deckId !== deckId || !allowed.has(r.id) || seen.has(r.id)) continue;
      if (Number(r.ts || 0) < cutoff) continue;
      if (r.rating !== 'again' && r.rating !== 'hard') continue;
      const card = allCards(deckId).find(c => c.id === r.id);
      if (card) { seen.add(r.id); out.push(card); }
    }
    return out;
  }
  function dueCards(deckId){
    const out = [], seen = new Set();
    for (const x of core.dueNow(deckId)) {
      if (!x.card.suspended && !seen.has(x.card.id)) { seen.add(x.card.id); out.push(x.card); }
    }
    return out;
  }
  function sourceCards(deckId, source, tag){
    if (source === 'weak') return weakCards(deckId);
    if (source === 'recent') return recentMissCards(deckId);
    if (source === 'favorites') return allCards(deckId).filter(c => c.favorite);
    if (source === 'tag') {
      const q = String(tag || '').trim().toLowerCase();
      return q ? allCards(deckId).filter(c => (c.tags || []).some(t => String(t).toLowerCase() === q)) : [];
    }
    if (source === 'all') return allCards(deckId);
    return dueCards(deckId);
  }
  function shuffle(arr){
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function cursorKey(deckId, source){ return `${deckId}|${source}`; }
  function buildQueue(deckId, source, tag, order, size){
    let cards = sourceCards(deckId, source, tag);
    if (order === 'random') cards = shuffle(cards);
    else if (order === 'hard') cards = [...cards].sort((a,b) => difficultyScore(b) - difficultyScore(a) || Number(a.created||0) - Number(b.created||0));
    else {
      cards = [...cards].sort((a,b) => Number(a.created||0) - Number(b.created||0));
      const p = loadPrefs(), cursors = p.cursors || {}, start = Number(cursors[cursorKey(deckId, source)] || 0);
      if (cards.length) {
        const k = ((start % cards.length) + cards.length) % cards.length;
        cards = cards.slice(k).concat(cards.slice(0,k));
      }
    }
    if (size > 0) cards = cards.slice(0, size);
    return cards;
  }

  function audioId(card, deckId){
    const x = String(card?.remoteId || '');
    return new RegExp(`^${deckId}-\\d+$`).test(x) ? x : null;
  }
  function audioPath(card, deckId){
    const rid = audioId(card, deckId);
    return rid ? `./audio/${deckId}/${encodeURIComponent(rid)}.caf` : null;
  }
  function ensurePlayer(){
    if (player) return player;
    player = document.createElement('audio');
    player.id = 'rf19HandsPlayer';
    player.preload = 'auto';
    player.setAttribute('playsinline','');
    player.style.display = 'none';
    document.body.appendChild(player);
    return player;
  }
  function waitAudio(el){
    return new Promise((resolve,reject) => {
      let done = false;
      const finish = ok => {
        if (done) return; done = true;
        el.onended = null; el.onerror = null; el.onabort = null;
        ok ? resolve() : reject(new Error('audio'));
      };
      el.onended = () => finish(true);
      el.onerror = () => finish(false);
      el.onabort = () => finish(false);
      setTimeout(() => finish(true), 12000);
    });
  }
  async function playTarget(card, deckId){
    const path = audioPath(card, deckId);
    if (path) {
      try {
        const el = ensurePlayer();
        try { el.pause(); } catch {}
        el.src = path; el.currentTime = 0; el.playbackRate = 1;
        const ended = waitAudio(el);
        await el.play(); await ended; return;
      } catch {}
    }
    try { core.speakText(card.front, deckId, 1); } catch {}
    await sleep(Math.max(1800, Math.min(6500, String(card.front || '').length * 72)));
  }
  async function speakPt(text){
    if (!('speechSynthesis' in window)) { await sleep(1500); return; }
    try {
      speechSynthesis.cancel();
      await new Promise(resolve => {
        const u = new SpeechSynthesisUtterance(text); u.lang='pt-BR'; u.rate=1;
        let done=false; const finish=()=>{if(done)return;done=true;resolve();};
        u.onend=finish;u.onerror=finish;speechSynthesis.speak(u);
        setTimeout(finish,Math.max(3500,Math.min(9000,String(text||'').length*85)));
      });
    } catch {}
  }

  function stopHands(){
    running = false; token++;
    try { player?.pause(); } catch {}
    try { document.getElementById('rf14SharedAudio')?.pause(); } catch {}
    try { speechSynthesis.cancel(); } catch {}
    try { wake?.release(); } catch {}
    wake = null;
    const hint=document.getElementById('rf2HfHint'); if(hint) hint.textContent='Parado.';
  }
  function persistContinueCursor(deckId, source, step){
    const p=loadPrefs(); p.cursors ||= {}; const k=cursorKey(deckId, source);
    p.cursors[k] = Number(p.cursors[k] || 0) + step; savePrefs(p);
  }
  function renderCard(card, deckId, mode, pos, total, round, loopLabel){
    const lang=document.getElementById('rf2HfLang'), phrase=document.getElementById('rf2HfPhrase'), hint=document.getElementById('rf2HfHint');
    if(lang) lang.textContent=`${DECKS[deckId].flag} ${DECKS[deckId].name} · ${pos+1}/${total} · volta ${round}/${loopLabel}`;
    if(mode==='production'){
      if(phrase) phrase.textContent=card.back;
      if(hint) hint.textContent='Traduza em voz alta. Depois você ouvirá a resposta correta.';
    }else{
      if(phrase) phrase.textContent=card.front;
      if(hint) hint.textContent='Ouça e repita em voz alta durante a pausa.';
    }
  }
  async function startHands(){
    stopHands(); updatePrefs();
    const deckId=document.getElementById('rf2HfDeck')?.value||'en';
    const source=document.getElementById('rf2HfSource')?.value||'due';
    const tag=document.getElementById('rf19HfTag')?.value||'';
    const order=document.getElementById('rf19HfOrder')?.value||'random';
    const size=Math.max(0,Number(document.getElementById('rf19HfSize')?.value||20));
    const loopValue=document.getElementById('rf19HfLoop')?.value||'infinite';
    const maxRounds=loopValue==='infinite'?Infinity:Math.max(1,Number(loopValue)||1);
    const mode=document.getElementById('rf2HfMode')?.value||'recognition';
    const pause=Math.max(0,Number(document.getElementById('rf2HfPause')?.value||5))*1000;
    const repeats=Math.max(1,Number(document.getElementById('rf2HfRepeats')?.value||2));
    const speakTranslation=Boolean(document.getElementById('rf2HfPt')?.checked);

    let queue=buildQueue(deckId,source,tag,order,size);
    const phrase=document.getElementById('rf2HfPhrase');
    if(!queue.length){
      if(phrase) phrase.textContent=source==='weak'?'Nenhuma frase difícil com histórico suficiente ainda.':'Nenhuma frase nesta seleção.';
      return;
    }

    running=true; const my=++token; let round=1;
    try { wake=await navigator.wakeLock?.request('screen'); } catch {}
    ensurePlayer();

    while(running && my===token && round<=maxRounds){
      if(round>1 && order==='random') queue=shuffle(queue);
      for(let i=0;i<queue.length && running && my===token;i++){
        const card=queue[i];
        renderCard(card,deckId,mode,i,queue.length,round,maxRounds===Infinity?'∞':String(maxRounds));
        if(mode==='production'){
          await speakPt(card.back);
          if(!running||my!==token)break;
          await sleep(pause);
          for(let n=0;n<repeats&&running&&my===token;n++){
            await playTarget(card,deckId); if(n<repeats-1)await sleep(450);
          }
        }else{
          for(let n=0;n<repeats&&running&&my===token;n++){
            await playTarget(card,deckId); if(n<repeats-1)await sleep(450);
          }
          if(speakTranslation&&running&&my===token){await speakPt(card.back);await sleep(350);}
          if(running&&my===token)await sleep(pause);
        }
        if(order==='continue') persistContinueCursor(deckId,source,1);
      }
      round++;
    }
    if(running && my===token){
      running=false;
      const hint=document.getElementById('rf2HfHint'); if(hint) hint.textContent='Sessão concluída.';
      try { wake?.release(); } catch {} wake=null;
    }
  }

  function availableCount(){
    const deckId=document.getElementById('rf2HfDeck')?.value||'en';
    const source=document.getElementById('rf2HfSource')?.value||'due';
    const tag=document.getElementById('rf19HfTag')?.value||'';
    return sourceCards(deckId,source,tag).length;
  }
  function updateUi(){
    const src=document.getElementById('rf2HfSource')?.value||'due';
    const tagWrap=document.getElementById('rf19HfTagWrap'); if(tagWrap) tagWrap.style.display=src==='tag'?'':'none';
    const mode=document.getElementById('rf2HfMode')?.value||'recognition';
    const pt=document.getElementById('rf19PtToggle'); if(pt) pt.style.display=mode==='production'?'none':'';
    const count=document.getElementById('rf19HfCount'); if(count) count.textContent=`${availableCount()} frase(s) disponíveis nesta seleção.`;
    updatePrefs();
  }

  function installHandsView(){
    const view=document.getElementById('view-rf2-hands');
    if(!view || view.dataset.rf19Smart==='1') return false;
    view.dataset.rf19Smart='1';
    const p=loadPrefs();
    view.innerHTML=`<div class="section"><div class="rf2-head"><h2>🎧 Hands-free</h2><button class="secondary-btn" id="rf2HandsBack">← Sessão</button></div><p>Treino contínuo para carro ou academia. Não altera o SRS.</p><div class="rf19-hf-grid"><label>Deck<select id="rf2HfDeck" class="setting"><option value="en">🇺🇸 English</option><option value="de">🇩🇪 Deutsch</option></select></label><label>Frases<select id="rf2HfSource" class="setting"><option value="due">Revisões de hoje</option><option value="weak">Mais difíceis / Weak Spots</option><option value="recent">Difícil ou Não lembrei recentemente</option><option value="favorites">Favoritas</option><option value="tag">Tag / tema</option><option value="all">Todas as frases</option></select></label><label id="rf19HfTagWrap">Tag<input id="rf19HfTag" class="setting" placeholder="Interview"></label><label>Quantidade<select id="rf19HfSize" class="setting"><option value="5">5 frases</option><option value="10">10 frases</option><option value="20" selected>20 frases</option><option value="0">Todas</option></select></label><label>Ordem<select id="rf19HfOrder" class="setting"><option value="random" selected>🔀 Aleatória</option><option value="hard">⚠️ Mais difíceis primeiro</option><option value="continue">▶ Continuar de onde parei</option></select></label><label>Loop<select id="rf19HfLoop" class="setting"><option value="infinite" selected>♾ Contínuo</option><option value="1">1 volta</option><option value="2">2 voltas</option><option value="3">3 voltas</option></select></label><label>Modo<select id="rf2HfMode" class="setting"><option value="recognition">👁 Compreensão</option><option value="production">🗣 Produção</option></select></label><label>Pausa<select id="rf2HfPause" class="setting"><option value="3">3 s</option><option value="5" selected>5 s</option><option value="7">7 s</option><option value="10">10 s</option></select></label><label>Repetir áudio<select id="rf2HfRepeats" class="setting"><option value="1">1x</option><option value="2" selected>2x</option><option value="3">3x</option></select></label></div><div id="rf19PtToggle" class="toggle" style="margin-top:10px"><span>Falar tradução em português</span><input id="rf2HfPt" type="checkbox"></div><div id="rf19HfCount" class="rf2-muted" style="margin-top:9px"></div><div class="rf2-hfnow"><span id="rf2HfLang" class="rf2-muted">Pronto</span><strong id="rf2HfPhrase">Toque em iniciar</strong><span id="rf2HfHint" class="rf2-muted"></span></div><div class="rf2-controls"><button class="rf2-primary" id="rf2HfStart">▶ Iniciar</button><button class="rf2-secondary" id="rf2HfStop">■ Parar</button></div></div>`;

    const defaults={rf2HfDeck:'en',rf2HfSource:'due',rf19HfSize:'20',rf19HfOrder:'random',rf19HfLoop:'infinite',rf2HfMode:'recognition',rf2HfPause:'5',rf2HfRepeats:'2'};
    for(const [id,def] of Object.entries(defaults)){
      const el=document.getElementById(id); const val=p[id] ?? def;
      if(el && [...el.options].some(o=>o.value===String(val))) el.value=String(val);
    }
    if(document.getElementById('rf2HfPt')) document.getElementById('rf2HfPt').checked=Boolean(p.rf2HfPt);
    if(document.getElementById('rf19HfTag')) document.getElementById('rf19HfTag').value=String(p.rf19HfTag||'');

    const capture=(id,fn)=>document.getElementById(id)?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();fn();},true);
    capture('rf2HfStart',startHands); capture('rf2HfStop',stopHands);
    capture('rf2HandsBack',()=>{stopHands(); if(document.getElementById('view-rf3-session'))core.showView('rf3-session');else core.showView('decks');});
    view.querySelectorAll('select,input').forEach(el=>el.addEventListener('change',updateUi));
    document.getElementById('rf19HfTag')?.addEventListener('input',updateUi);
    updateUi();
    return true;
  }

  function placeInsideSession(){
    const session=document.querySelector('#view-rf3-session .section');
    const button=document.getElementById('rf2HandsBtn');
    if(!session || !button) return false;
    let holder=document.getElementById('rf19HandsSessionEntry');
    if(!holder){
      holder=document.createElement('div'); holder.id='rf19HandsSessionEntry'; holder.className='rf19-session-hands';
      holder.innerHTML='<div><b>🎧 Hands-free</b><small>Crie uma sessão por dificuldade, ordem, quantidade e loop.</small></div>';
      const grid=session.querySelector('.rf3-session-grid');
      if(grid) grid.insertAdjacentElement('beforebegin',holder); else session.appendChild(holder);
    }
    if(button.parentElement!==holder) holder.appendChild(button);
    button.textContent='Configurar';
    button.onclick=()=>{installHandsView();core.showView('rf2-hands');};
    return true;
  }

  function styles(){
    if(document.getElementById('rf19HandsStyle'))return;
    const st=document.createElement('style');st.id='rf19HandsStyle';st.textContent=`
      #view-decks #rf2HandsBtn{display:none!important}
      .rf19-hf-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:10px}.rf19-hf-grid label{font-size:11px;color:var(--muted);font-weight:800}.rf19-hf-grid select,.rf19-hf-grid input{margin-top:5px;width:100%;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:12px;padding:11px}
      .rf19-session-hands{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--surface2);border:1px solid var(--line);border-radius:13px;padding:10px 11px;margin:0 0 11px}.rf19-session-hands b{display:block;font-size:12px;color:var(--ink)}.rf19-session-hands small{display:block;font-size:9.5px;color:var(--muted);margin-top:3px;line-height:1.3}.rf19-session-hands #rf2HandsBtn{display:block!important;min-height:36px;flex:0 0 auto}
      @media(max-width:430px){.rf19-hf-grid{grid-template-columns:1fr}.rf19-session-hands{align-items:flex-start}.rf19-session-hands #rf2HandsBtn{min-height:38px}}
    `;document.head.appendChild(st);
  }

  function init(){
    styles(); installHandsView(); placeInsideSession();
    document.addEventListener('click',e=>{
      if(e.target?.closest?.('#rf3SessionBtn')) setTimeout(placeInsideSession,30);
    },true);
    const obs=new MutationObserver(()=>{installHandsView();placeInsideSession();});
    obs.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
