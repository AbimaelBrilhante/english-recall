(() => {
  'use strict';
  if (window.__recallHandsfreeProductionV192) return;
  const core = window.recallCore;
  if (!core) return;
  window.__recallHandsfreeProductionV192 = true;

  const PREF_KEY = 'recallHandsfreeSmartV191';
  const state = () => core.getState();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let running = false;
  let token = 0;
  let audio = null;
  let wake = null;

  function loadPrefs(){
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; }
    catch { return {}; }
  }
  function totalReps(card){
    return Number(card.schedules?.recognition?.reps || 0) + Number(card.schedules?.production?.reps || 0);
  }
  function totalLapses(card){
    return Number(card.schedules?.recognition?.lapses || 0) + Number(card.schedules?.production?.lapses || 0);
  }
  function cardLogs(card, deckId){
    return (state().reviewLog || []).filter(r => r.id === card.id && (r.deckId == null || r.deckId === deckId));
  }
  function difficultyScore(card, deckId){
    const h = cardLogs(card, deckId);
    if (!h.length && !totalReps(card)) return -Infinity;
    let score = totalLapses(card) * 4;
    for (const r of h.slice(-12)) {
      if (r.rating === 'again') score += 5;
      else if (r.rating === 'hard') score += 2;
      if (r.direction === 'production' && (r.rating === 'again' || r.rating === 'hard')) score += 1;
    }
    const last = h[h.length - 1];
    if (last?.rating === 'again') score += 3;
    else if (last?.rating === 'hard') score += 1;
    return score;
  }
  function allCards(deckId){
    return (state().cards?.[deckId] || []).filter(c => !c.suspended);
  }
  function dueCards(deckId){
    const out = [], seen = new Set();
    for (const x of core.dueNow(deckId)) {
      if (!x.card.suspended && !seen.has(x.card.id)) {
        seen.add(x.card.id);
        out.push(x.card);
      }
    }
    return out;
  }
  function sourceCards(deckId, source, tag){
    const all = allCards(deckId);
    if (source === 'weak') {
      return all.map(card => ({card, score:difficultyScore(card, deckId)}))
        .filter(x => Number.isFinite(x.score) && x.score > 0)
        .sort((a,b) => b.score - a.score || Number(a.card.created||0) - Number(b.card.created||0))
        .map(x => x.card);
    }
    if (source === 'recent') {
      const allowed = new Map(all.map(c => [c.id, c]));
      const cutoff = Date.now() - 30 * 86400000;
      const out = [], seen = new Set();
      for (const r of [...(state().reviewLog || [])].reverse()) {
        if ((r.deckId != null && r.deckId !== deckId) || !allowed.has(r.id) || seen.has(r.id)) continue;
        if (Number(r.ts || 0) < cutoff || (r.rating !== 'again' && r.rating !== 'hard')) continue;
        seen.add(r.id); out.push(allowed.get(r.id));
      }
      return out;
    }
    if (source === 'favorites') return all.filter(c => c.favorite);
    if (source === 'tag') {
      const q = String(tag || '').trim().toLowerCase();
      return q ? all.filter(c => (c.tags || []).some(t => String(t).toLowerCase() === q)) : [];
    }
    if (source === 'all') return all;
    return dueCards(deckId);
  }
  function shuffle(arr){
    const a = [...arr];
    for (let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }
  function cursorKey(deckId, source){ return `${deckId}|${source}`; }
  function buildQueue(deckId, source, tag, order, size){
    let cards = sourceCards(deckId, source, tag);
    if (order === 'random') cards = shuffle(cards);
    else if (order === 'hard') cards = [...cards].sort((a,b) => difficultyScore(b,deckId)-difficultyScore(a,deckId) || Number(a.created||0)-Number(b.created||0));
    else {
      cards = [...cards].sort((a,b) => Number(a.created||0)-Number(b.created||0));
      const p = loadPrefs(), n = Number(p.cursors?.[cursorKey(deckId,source)] || 0);
      if (cards.length) {
        const k = ((n % cards.length) + cards.length) % cards.length;
        cards = cards.slice(k).concat(cards.slice(0,k));
      }
    }
    return size > 0 ? cards.slice(0,size) : cards;
  }
  function advanceCursor(deckId, source){
    if (document.getElementById('rf191HfOrder')?.value !== 'continue') return;
    const p = loadPrefs(); p.cursors ||= {};
    const k = cursorKey(deckId, source);
    p.cursors[k] = Number(p.cursors[k] || 0) + 1;
    try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch {}
  }

  function audioId(card, deckId){
    const x = card?.remoteId || '';
    return new RegExp(`^${deckId}-\\d+$`).test(x) ? x : null;
  }
  function audioPath(card, deckId){
    const rid = audioId(card, deckId);
    return rid ? `./audio/${deckId}/${encodeURIComponent(rid)}.caf` : null;
  }
  function ensureAudio(){
    if (audio) return audio;
    audio = document.getElementById('rf14SharedAudio') || document.createElement('audio');
    audio.id = 'rf14SharedAudio';
    audio.preload = 'auto';
    audio.setAttribute('playsinline','');
    audio.style.display = 'none';
    if (!audio.isConnected) document.body.appendChild(audio);
    return audio;
  }
  async function primeAudio(card, deckId){
    const p = audioPath(card, deckId);
    if (!p) return false;
    const el = ensureAudio();
    try {
      el.pause(); el.src = p; el.currentTime = 0; el.muted = true;
      const play = el.play(); if (play) await play;
      el.pause(); el.currentTime = 0; el.muted = false;
      const s = document.getElementById('rf191HfAudioStatus');
      if (s) s.textContent = '✓ Player de áudio liberado.';
      return true;
    } catch {
      el.muted = false;
      return false;
    }
  }
  function waitAudio(el){
    return new Promise((resolve,reject) => {
      let done = false;
      const finish = ok => {
        if (done) return; done = true; clearTimeout(timer);
        el.onended = el.onerror = el.onabort = null;
        ok ? resolve() : reject(new Error('audio'));
      };
      el.onended = () => finish(true);
      el.onerror = el.onabort = () => finish(false);
      const timer = setTimeout(() => finish(true),15000);
    });
  }
  async function playTarget(card, deckId){
    const p = audioPath(card, deckId);
    if (p) {
      try {
        const el = ensureAudio();
        el.pause(); el.muted = false; el.src = p; el.playbackRate = 1; el.currentTime = 0;
        const ended = waitAudio(el);
        await el.play(); await ended;
        const s = document.getElementById('rf191HfAudioStatus');
        if (s) s.textContent = '✓ Áudio gravado reproduzido.';
        return;
      } catch {}
    }
    const s = document.getElementById('rf191HfAudioStatus');
    if (s) s.textContent = 'Áudio gravado indisponível; usando voz do sistema.';
    try { core.speakText(card.front, deckId, 1); } catch {}
    await sleep(Math.max(1800, Math.min(6500, String(card.front || '').length * 72)));
  }
  async function speakPortuguese(text){
    if (!('speechSynthesis' in window)) { await sleep(1500); return; }
    await new Promise(resolve => {
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'pt-BR'; u.rate = 1;
        let done = false;
        const finish = () => { if (done) return; done = true; resolve(); };
        u.onend = finish; u.onerror = finish;
        speechSynthesis.speak(u);
        setTimeout(finish, Math.max(3000, Math.min(8500, String(text || '').length * 80)));
      } catch { resolve(); }
    });
  }

  function showPrompt(card, deckId, pos, total, round, max){
    const lang = document.getElementById('rf2HfLang');
    const phrase = document.getElementById('rf2HfPhrase');
    const translation = document.getElementById('rf191HfTranslation');
    const hint = document.getElementById('rf2HfHint');
    const deck = core.DECKS[deckId];
    if (lang) lang.textContent = `${deck.flag} ${deck.name} · ${pos+1}/${total} · volta ${round}/${max===Infinity?'∞':max}`;
    if (phrase) phrase.textContent = card.back;
    if (translation) { translation.textContent = ''; translation.classList.add('hidden'); }
    if (hint) hint.textContent = 'Ouça em português, produza a frase no idioma-alvo e aguarde a resposta.';
  }
  function reveal(card){
    const phrase = document.getElementById('rf2HfPhrase');
    const translation = document.getElementById('rf191HfTranslation');
    const hint = document.getElementById('rf2HfHint');
    if (phrase) phrase.textContent = card.front;
    if (translation) { translation.textContent = card.back; translation.classList.remove('hidden'); }
    if (hint) hint.textContent = 'Resposta correta. Ouça e compare com o que você falou.';
  }
  function stopOwn(updateHint=true){
    running = false; token++;
    try { audio?.pause(); } catch {}
    try { speechSynthesis.cancel(); } catch {}
    try { wake?.release(); } catch {}
    wake = null;
    if (updateHint) {
      const h = document.getElementById('rf2HfHint');
      if (h) h.textContent = 'Parado.';
    }
  }

  async function startProduction(){
    stopOwn(false);
    const oldStop = document.getElementById('rf2HfStop')?.onclick;
    try { oldStop?.call(document.getElementById('rf2HfStop')); } catch {}

    const deckId = document.getElementById('rf2HfDeck')?.value || 'en';
    const source = document.getElementById('rf2HfSource')?.value || 'due';
    const tag = document.getElementById('rf191HfTag')?.value || '';
    const order = document.getElementById('rf191HfOrder')?.value || 'random';
    const size = Math.max(0, Number(document.getElementById('rf191HfSize')?.value || 10));
    const loop = document.getElementById('rf191HfLoop')?.value || 'infinite';
    const maxRounds = loop === 'infinite' ? Infinity : Math.max(1, Number(loop) || 1);
    const pause = Math.max(0, Number(document.getElementById('rf2HfPause')?.value || 5)) * 1000;
    const repeats = Math.max(1, Number(document.getElementById('rf2HfRepeats')?.value || 2));
    let queue = buildQueue(deckId, source, tag, order, size);

    const phrase = document.getElementById('rf2HfPhrase');
    const translation = document.getElementById('rf191HfTranslation');
    if (!queue.length) {
      if (phrase) phrase.textContent = source === 'weak' ? 'Nenhuma frase difícil com histórico suficiente ainda.' : 'Nenhuma frase nesta seleção.';
      if (translation) translation.textContent = '';
      return;
    }

    await primeAudio(queue[0], deckId);
    running = true;
    const mine = ++token;
    try { wake = await navigator.wakeLock?.request('screen'); } catch {}

    let round = 1;
    while (running && mine === token && round <= maxRounds) {
      if (round > 1 && order === 'random') queue = shuffle(queue);
      for (let i=0; i<queue.length && running && mine===token; i++) {
        const card = queue[i];
        showPrompt(card, deckId, i, queue.length, round, maxRounds);

        // v19.2: o prompt de produção é falado primeiro em português.
        await speakPortuguese(card.back);
        if (!running || mine !== token) break;

        // Só depois da fala em português começa a pausa para o usuário responder.
        await sleep(pause);
        if (!running || mine !== token) break;

        reveal(card);
        for (let n=0; n<repeats && running && mine===token; n++) {
          await playTarget(card, deckId);
          if (n < repeats-1) await sleep(450);
        }
        advanceCursor(deckId, source);
      }
      round++;
    }

    if (running && mine === token) {
      running = false;
      const h = document.getElementById('rf2HfHint');
      if (h) h.textContent = 'Sessão concluída.';
      try { wake?.release(); } catch {}
      wake = null;
    }
  }

  document.addEventListener('click', e => {
    const start = e.target.closest?.('#rf2HfStart');
    if (start) {
      const mode = document.getElementById('rf2HfMode')?.value || 'recognition';
      if (mode === 'production') {
        e.preventDefault();
        e.stopImmediatePropagation();
        startProduction();
        return;
      }
      stopOwn(false);
      return;
    }
    if (e.target.closest?.('#rf2HfStop,#rf2HandsBack')) stopOwn(false);
  }, true);
})();
