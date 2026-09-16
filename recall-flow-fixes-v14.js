(() => {
  'use strict';
  if (window.__recallFlowFixesV14) return;
  const core = window.recallCore;
  if (!core) return;
  window.__recallFlowFixesV14 = true;

  const DECKS = core.DECKS;
  const state = () => core.getState();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const HF_PREF_KEY = 'recallHandsfreeSmartV191';

  let hfRunning = false;
  let hfToken = 0;
  let wake = null;
  let hfAudio = null;

  function loadHfPrefs() {
    try { return JSON.parse(localStorage.getItem(HF_PREF_KEY) || '{}') || {}; }
    catch { return {}; }
  }
  function saveHfPrefs() {
    const old = loadHfPrefs();
    const p = { cursors: old.cursors || {} };
    for (const id of ['rf2HfDeck','rf2HfSource','rf191HfTag','rf191HfSize','rf191HfOrder','rf191HfLoop','rf2HfMode','rf2HfPause','rf2HfRepeats']) {
      const el = document.getElementById(id);
      if (el) p[id] = el.value;
    }
    const pt = document.getElementById('rf2HfPt');
    if (pt) p.rf2HfPt = pt.checked;
    try { localStorage.setItem(HF_PREF_KEY, JSON.stringify(p)); } catch {}
  }
  function restoreHfPrefs() {
    const p = loadHfPrefs();
    for (const id of ['rf2HfDeck','rf2HfSource','rf191HfTag','rf191HfSize','rf191HfOrder','rf191HfLoop','rf2HfMode','rf2HfPause','rf2HfRepeats']) {
      const el = document.getElementById(id);
      if (el && p[id] != null) el.value = p[id];
    }
    const pt = document.getElementById('rf2HfPt');
    if (pt && typeof p.rf2HfPt === 'boolean') pt.checked = p.rf2HfPt;
  }

  function totalReps(card) {
    return Number(card.schedules?.recognition?.reps || 0) + Number(card.schedules?.production?.reps || 0);
  }
  function totalLapses(card) {
    return Number(card.schedules?.recognition?.lapses || 0) + Number(card.schedules?.production?.lapses || 0);
  }
  function cardLogs(card, deckId) {
    return (state().reviewLog || []).filter(r => r.id === card.id && (r.deckId == null || r.deckId === deckId));
  }
  function difficultyScore(card, deckId) {
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
  function allHfCards(deckId) {
    return (state().cards?.[deckId] || []).filter(c => !c.suspended);
  }
  function dueHfCards(deckId) {
    const out = [], seen = new Set();
    for (const x of core.dueNow(deckId)) {
      if (!x.card.suspended && !seen.has(x.card.id)) {
        seen.add(x.card.id);
        out.push(x.card);
      }
    }
    return out;
  }
  function weakHfCards(deckId) {
    return allHfCards(deckId)
      .map(card => ({ card, score: difficultyScore(card, deckId) }))
      .filter(x => Number.isFinite(x.score) && x.score > 0)
      .sort((a,b) => b.score - a.score || Number(a.card.created || 0) - Number(b.card.created || 0))
      .map(x => x.card);
  }
  function recentHfCards(deckId) {
    const allowed = new Map(allHfCards(deckId).map(c => [c.id, c]));
    const cutoff = Date.now() - 30 * 86400000;
    const out = [], seen = new Set();
    for (const r of [...(state().reviewLog || [])].reverse()) {
      if ((r.deckId != null && r.deckId !== deckId) || !allowed.has(r.id) || seen.has(r.id)) continue;
      if (Number(r.ts || 0) < cutoff) continue;
      if (r.rating !== 'again' && r.rating !== 'hard') continue;
      seen.add(r.id);
      out.push(allowed.get(r.id));
    }
    return out;
  }
  function sourceHfCards(deckId, source, tag) {
    if (source === 'weak') return weakHfCards(deckId);
    if (source === 'recent') return recentHfCards(deckId);
    if (source === 'favorites') return allHfCards(deckId).filter(c => c.favorite);
    if (source === 'tag') {
      const q = String(tag || '').trim().toLowerCase();
      return q ? allHfCards(deckId).filter(c => (c.tags || []).some(t => String(t).toLowerCase() === q)) : [];
    }
    if (source === 'all') return allHfCards(deckId);
    return dueHfCards(deckId);
  }
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function hfCursorKey(deckId, source) { return `${deckId}|${source}`; }
  function buildHfQueue(deckId, source, tag, order, size) {
    let cards = sourceHfCards(deckId, source, tag);
    if (order === 'random') cards = shuffle(cards);
    else if (order === 'hard') cards = [...cards].sort((a,b) => difficultyScore(b, deckId) - difficultyScore(a, deckId) || Number(a.created || 0) - Number(b.created || 0));
    else {
      cards = [...cards].sort((a,b) => Number(a.created || 0) - Number(b.created || 0));
      const p = loadHfPrefs(), n = Number(p.cursors?.[hfCursorKey(deckId, source)] || 0);
      if (cards.length) {
        const k = ((n % cards.length) + cards.length) % cards.length;
        cards = cards.slice(k).concat(cards.slice(0, k));
      }
    }
    return size > 0 ? cards.slice(0, size) : cards;
  }
  function advanceHfCursor(deckId, source) {
    if (document.getElementById('rf191HfOrder')?.value !== 'continue') return;
    const p = loadHfPrefs();
    p.cursors ||= {};
    const k = hfCursorKey(deckId, source);
    p.cursors[k] = Number(p.cursors[k] || 0) + 1;
    try { localStorage.setItem(HF_PREF_KEY, JSON.stringify(p)); } catch {}
  }

  function audioId(card, deckId) {
    const x = card?.remoteId || '';
    return new RegExp(`^${deckId}-\\d+$`).test(x) ? x : null;
  }
  function audioPath(card, deckId) {
    const rid = audioId(card, deckId);
    return rid ? `./audio/${deckId}/${encodeURIComponent(rid)}.caf` : null;
  }
  function ensureSharedAudio() {
    if (hfAudio) return hfAudio;
    hfAudio = document.getElementById('rf14SharedAudio') || document.createElement('audio');
    hfAudio.id = 'rf14SharedAudio';
    hfAudio.preload = 'auto';
    hfAudio.setAttribute('playsinline', '');
    hfAudio.style.display = 'none';
    if (!hfAudio.isConnected) document.body.appendChild(hfAudio);
    return hfAudio;
  }
  async function primeAudio(card, deckId) {
    const p = audioPath(card, deckId);
    if (!p) return false;
    const el = ensureSharedAudio();
    try {
      el.pause();
      el.src = p;
      el.currentTime = 0;
      el.muted = true;
      const play = el.play();
      if (play) await play;
      el.pause();
      el.currentTime = 0;
      el.muted = false;
      const s = document.getElementById('rf191HfAudioStatus');
      if (s) s.textContent = '✓ Player de áudio liberado.';
      return true;
    } catch {
      el.muted = false;
      const s = document.getElementById('rf191HfAudioStatus');
      if (s) s.textContent = 'Áudio gravado indisponível; o fallback de voz será usado.';
      return false;
    }
  }
  function waitAudio(el) {
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = ok => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        el.onended = null; el.onerror = null; el.onabort = null;
        ok ? resolve() : reject(new Error('audio'));
      };
      el.onended = () => finish(true);
      el.onerror = () => finish(false);
      el.onabort = () => finish(false);
      const timer = setTimeout(() => finish(true), 15000);
    });
  }
  async function playRecorded(card, deckId, rate = 1) {
    const p = audioPath(card, deckId);
    if (!p) throw new Error('no-recorded-audio');
    const el = ensureSharedAudio();
    el.pause();
    el.muted = false;
    el.src = p;
    el.playbackRate = rate;
    el.currentTime = 0;
    const ended = waitAudio(el);
    await el.play();
    await ended;
  }
  async function playTarget(card, deckId, rate = 1) {
    try {
      await playRecorded(card, deckId, rate);
      const s = document.getElementById('rf191HfAudioStatus');
      if (s) s.textContent = '✓ Áudio gravado reproduzido.';
      return true;
    } catch {
      const s = document.getElementById('rf191HfAudioStatus');
      if (s) s.textContent = 'Áudio gravado indisponível; usando voz do sistema.';
      try {
        core.speakText(card.front, deckId, rate);
        await sleep(Math.max(1800, Math.min(6500, String(card.front || '').length * 72)));
        return true;
      } catch {
        return false;
      }
    }
  }
  async function speakPt(text) {
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

  function showRecognition(card, deckId, pos, total, round, max) {
    const lang = document.getElementById('rf2HfLang');
    const phrase = document.getElementById('rf2HfPhrase');
    const translation = document.getElementById('rf191HfTranslation');
    const hint = document.getElementById('rf2HfHint');
    if (lang) lang.textContent = `${DECKS[deckId].flag} ${DECKS[deckId].name} · ${pos + 1}/${total} · volta ${round}/${max === Infinity ? '∞' : max}`;
    if (phrase) phrase.textContent = card.front;
    if (translation) { translation.textContent = card.back; translation.classList.remove('hidden'); }
    if (hint) hint.textContent = 'Ouça a frase, confira a tradução e repita em voz alta durante a pausa.';
  }
  function showProductionPrompt(card, deckId, pos, total, round, max) {
    const lang = document.getElementById('rf2HfLang');
    const phrase = document.getElementById('rf2HfPhrase');
    const translation = document.getElementById('rf191HfTranslation');
    const hint = document.getElementById('rf2HfHint');
    if (lang) lang.textContent = `${DECKS[deckId].flag} ${DECKS[deckId].name} · ${pos + 1}/${total} · volta ${round}/${max === Infinity ? '∞' : max}`;
    if (phrase) phrase.textContent = card.back;
    if (translation) { translation.textContent = ''; translation.classList.add('hidden'); }
    if (hint) hint.textContent = 'Produza a frase no idioma-alvo antes da resposta.';
  }
  function revealProduction(card) {
    const phrase = document.getElementById('rf2HfPhrase');
    const translation = document.getElementById('rf191HfTranslation');
    const hint = document.getElementById('rf2HfHint');
    if (phrase) phrase.textContent = card.front;
    if (translation) { translation.textContent = card.back; translation.classList.remove('hidden'); }
    if (hint) hint.textContent = 'Resposta correta. Ouça e compare com o que você falou.';
  }

  function stopHands14() {
    hfRunning = false; hfToken++;
    try { hfAudio?.pause(); } catch {}
    try { speechSynthesis.cancel(); } catch {}
    try { wake?.release(); } catch {}
    wake = null;
    const hint = document.getElementById('rf2HfHint');
    if (hint) hint.textContent = 'Parado.';
  }

  async function startHands14() {
    stopHands14();
    saveHfPrefs();

    const deckId = document.getElementById('rf2HfDeck')?.value || 'en';
    const source = document.getElementById('rf2HfSource')?.value || 'due';
    const tag = document.getElementById('rf191HfTag')?.value || '';
    const order = document.getElementById('rf191HfOrder')?.value || 'random';
    const size = Math.max(0, Number(document.getElementById('rf191HfSize')?.value || 10));
    const loop = document.getElementById('rf191HfLoop')?.value || 'infinite';
    const maxRounds = loop === 'infinite' ? Infinity : Math.max(1, Number(loop) || 1);
    const mode = document.getElementById('rf2HfMode')?.value || 'recognition';
    const pause = Math.max(0, Number(document.getElementById('rf2HfPause')?.value || 5)) * 1000;
    const repeats = Math.max(1, Number(document.getElementById('rf2HfRepeats')?.value || 2));
    const speakTranslation = Boolean(document.getElementById('rf2HfPt')?.checked);

    let queue = buildHfQueue(deckId, source, tag, order, size);
    const phrase = document.getElementById('rf2HfPhrase');
    const translation = document.getElementById('rf191HfTranslation');
    if (!queue.length) {
      if (phrase) phrase.textContent = source === 'weak' ? 'Nenhuma frase difícil com histórico suficiente ainda.' : 'Nenhuma frase nesta seleção.';
      if (translation) translation.textContent = '';
      return;
    }

    await primeAudio(queue[0], deckId);

    hfRunning = true;
    const token = ++hfToken;
    try { wake = await navigator.wakeLock?.request('screen'); } catch {}

    let round = 1;
    while (hfRunning && token === hfToken && round <= maxRounds) {
      if (round > 1 && order === 'random') queue = shuffle(queue);
      for (let i = 0; i < queue.length && hfRunning && token === hfToken; i++) {
        const card = queue[i];
        if (mode === 'production') {
          showProductionPrompt(card, deckId, i, queue.length, round, maxRounds);
          await sleep(pause);
          if (!hfRunning || token !== hfToken) break;
          revealProduction(card);
          for (let n = 0; n < repeats && hfRunning && token === hfToken; n++) {
            await playTarget(card, deckId, 1);
            if (n < repeats - 1) await sleep(450);
          }
        } else {
          showRecognition(card, deckId, i, queue.length, round, maxRounds);
          for (let n = 0; n < repeats && hfRunning && token === hfToken; n++) {
            await playTarget(card, deckId, 1);
            if (n < repeats - 1) await sleep(450);
          }
          if (speakTranslation && hfRunning && token === hfToken) {
            await speakPt(card.back);
            await sleep(250);
          }
          if (hfRunning && token === hfToken) await sleep(pause);
        }
        advanceHfCursor(deckId, source);
      }
      round++;
    }

    if (hfRunning && token === hfToken) {
      hfRunning = false;
      const hint = document.getElementById('rf2HfHint');
      if (hint) hint.textContent = 'Sessão concluída.';
      try { wake?.release(); } catch {}
      wake = null;
    }
  }

  function ensureHfStyles() {
    if (document.getElementById('rf191HfStyle')) return;
    const st = document.createElement('style');
    st.id = 'rf191HfStyle';
    st.textContent = `
      #view-rf2-hands .rf2-grid input.setting{width:100%;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:12px;padding:11px;margin-top:5px}
      .rf191-hf-translation{font-size:16px;line-height:1.35;font-weight:700;color:var(--ink);margin:0 0 10px;min-height:22px}
      .rf191-hf-translation.hidden{visibility:hidden}
      .rf191-hf-count,.rf191-hf-status{font-size:11px;color:var(--muted);margin-top:9px;line-height:1.4}
      #rf191HandsSessionBtn{width:100%;margin-top:10px}
    `;
    document.head.appendChild(st);
  }

  function updateHandsUi() {
    const source = document.getElementById('rf2HfSource')?.value || 'due';
    const tagWrap = document.getElementById('rf191HfTagWrap');
    if (tagWrap) tagWrap.style.display = source === 'tag' ? '' : 'none';

    const mode = document.getElementById('rf2HfMode')?.value || 'recognition';
    const ptToggle = document.getElementById('rf191HfPtToggle');
    if (ptToggle) ptToggle.style.display = mode === 'production' ? 'none' : '';

    const deckId = document.getElementById('rf2HfDeck')?.value || 'en';
    const tag = document.getElementById('rf191HfTag')?.value || '';
    const count = document.getElementById('rf191HfCount');
    if (count) count.textContent = `${sourceHfCards(deckId, source, tag).length} frase(s) disponíveis nesta seleção.`;

    if (!hfRunning) {
      const hint = document.getElementById('rf2HfHint');
      if (hint) hint.textContent = mode === 'production'
        ? 'Português → responda → revela a frase → áudio.'
        : 'Frase + tradução → áudio → pausa.';
    }
    saveHfPrefs();
  }

  function installHandsFreeUi() {
    const view = document.getElementById('view-rf2-hands');
    if (!view) return false;
    ensureHfStyles();

    if (view.dataset.rf191Smart !== '1') {
      view.dataset.rf191Smart = '1';
      view.innerHTML = `<div class="section">
        <div class="rf2-head"><h2>🎧 Hands-free</h2><button class="secondary-btn" id="rf2HandsBack">← Sessão</button></div>
        <p>Treino contínuo para carro ou academia. Não altera o SRS.</p>
        <div class="rf2-grid">
          <label>Deck<select id="rf2HfDeck" class="setting"><option value="en">🇺🇸 English</option><option value="de">🇩🇪 Deutsch</option></select></label>
          <label>Frases<select id="rf2HfSource" class="setting"><option value="due">Revisões de hoje</option><option value="weak">Mais difíceis / Weak Spots</option><option value="recent">Difícil / Não lembrei recentes</option><option value="favorites">Favoritas</option><option value="tag">Tag / tema</option><option value="all">Todas as frases</option></select></label>
          <label id="rf191HfTagWrap">Tag<input id="rf191HfTag" class="setting" type="text" placeholder="Interview"></label>
          <label>Quantidade<select id="rf191HfSize" class="setting"><option value="5">5 frases</option><option value="10" selected>10 frases</option><option value="20">20 frases</option><option value="0">Todas</option></select></label>
          <label>Ordem<select id="rf191HfOrder" class="setting"><option value="random" selected>🔀 Aleatória</option><option value="hard">⚠️ Mais difíceis primeiro</option><option value="continue">▶ Continuar de onde parei</option></select></label>
          <label>Loop<select id="rf191HfLoop" class="setting"><option value="1">1 volta</option><option value="2">2 voltas</option><option value="3">3 voltas</option><option value="infinite" selected>♾ Contínuo</option></select></label>
          <label>Modo<select id="rf2HfMode" class="setting"><option value="recognition" selected>👁 Compreensão</option><option value="production">🗣 Produção</option></select></label>
          <label>Pausa<select id="rf2HfPause" class="setting"><option value="3">3 s</option><option value="5" selected>5 s</option><option value="7">7 s</option><option value="10">10 s</option></select></label>
          <label>Repetir áudio<select id="rf2HfRepeats" class="setting"><option value="1">1x</option><option value="2" selected>2x</option><option value="3">3x</option></select></label>
        </div>
        <div class="toggle" id="rf191HfPtToggle" style="margin-top:10px"><span>Falar tradução em português</span><input id="rf2HfPt" type="checkbox"></div>
        <div id="rf191HfCount" class="rf191-hf-count"></div>
        <div class="rf2-hfnow">
          <span id="rf2HfLang" class="rf2-muted">Pronto</span>
          <strong id="rf2HfPhrase">Escolha as opções e toque em iniciar</strong>
          <div id="rf191HfTranslation" class="rf191-hf-translation"></div>
          <span id="rf2HfHint" class="rf2-muted"></span>
        </div>
        <div class="rf2-controls"><button class="rf2-primary" id="rf2HfStart">▶ Iniciar</button><button class="rf2-secondary" id="rf2HfStop">■ Parar</button></div>
        <div id="rf191HfAudioStatus" class="rf191-hf-status">Áudio ainda não iniciado.</div>
      </div>`;

      restoreHfPrefs();

      for (const id of ['rf2HfDeck','rf2HfSource','rf191HfTag','rf191HfSize','rf191HfOrder','rf191HfLoop','rf2HfMode','rf2HfPause','rf2HfRepeats','rf2HfPt']) {
        const el = document.getElementById(id);
        if (el) el.addEventListener(id === 'rf191HfTag' ? 'input' : 'change', updateHandsUi);
      }
      document.getElementById('rf2HfStart').onclick = startHands14;
      document.getElementById('rf2HfStop').onclick = stopHands14;
      document.getElementById('rf2HandsBack').onclick = () => { stopHands14(); core.showView('rf3-session'); };
      updateHandsUi();
    }
    return true;
  }

  function ensureHandsSessionEntry() {
    const home = document.getElementById('rf2HandsBtn');
    if (home) home.style.display = 'none';

    const view = document.getElementById('view-rf3-session');
    const start = document.getElementById('rf3StartSession');
    if (!view || !start) return false;
    if (!document.getElementById('rf191HandsSessionBtn')) {
      const b = document.createElement('button');
      b.id = 'rf191HandsSessionBtn';
      b.type = 'button';
      b.className = 'secondary-btn';
      b.textContent = '🎧 Hands-free';
      b.onclick = () => { installHandsFreeUi(); core.showView('rf2-hands'); };
      start.insertAdjacentElement('afterend', b);
    }
    return true;
  }

  function enhanceHandsFree() {
    const a = installHandsFreeUi();
    const b = ensureHandsSessionEntry();
    return a && b;
  }

  function cardFromCramDom() {
    const deckId = document.getElementById('rf3Deck')?.value || core.selectedDeck();
    const frontEl = document.querySelector('#rf3CramCard .front');
    const backEl = document.querySelector('#rf3CramCard .back');
    if (!frontEl || !backEl) return null;
    const frontText = frontEl.textContent?.trim() || '';
    const cards = state().cards?.[deckId] || [];
    let card = cards.find(c => c.front === frontText);
    if (!card) card = cards.find(c => c.back === frontText);
    return card ? { card, deckId, frontEl, backEl } : null;
  }

  function syncCramProductionDisplay() {
    const info = cardFromCramDom();
    if (!info) return null;
    const mode = document.getElementById('rf3Mode')?.value || 'recognition';
    const { card, frontEl, backEl } = info;
    if (mode === 'production') {
      const revealed = !backEl.classList.contains('hidden');
      frontEl.textContent = card.back;
      backEl.textContent = card.front + (card.note ? `\n\n📝 ${card.note}` : '');
      backEl.classList.toggle('hidden', !revealed);
    }
    return { ...info, mode };
  }

  async function autoPlayCram(reason = 'card') {
    await sleep(60);
    const info = syncCramProductionDisplay();
    if (!info) return;
    if (info.mode === 'production') {
      if (reason === 'flip' && !info.backEl.classList.contains('hidden')) await playTarget(info.card, info.deckId, 1);
    } else {
      await playTarget(info.card, info.deckId, 1);
    }
  }

  function wrapClick(id, after) {
    const el = document.getElementById(id);
    if (!el || el.dataset.rf14Wrapped === '1') return;
    const original = el.onclick;
    el.onclick = function(e) {
      const result = original?.call(this, e);
      Promise.resolve(result).finally(() => after());
      return result;
    };
    el.dataset.rf14Wrapped = '1';
  }

  function enhanceCram() {
    if (!document.getElementById('view-rf3-cram')) return false;
    wrapClick('rf3StartSession', () => {
      if (document.getElementById('view-rf3-cram')?.classList.contains('active')) autoPlayCram('card');
    });
    wrapClick('rf3CramNext', () => autoPlayCram('card'));
    wrapClick('rf3CramPrev', () => autoPlayCram('card'));
    wrapClick('rf3CramFlip', () => autoPlayCram('flip'));

    const card = document.getElementById('rf3CramCard');
    if (card && !document.getElementById('rf14AutoBadge')) {
      const badge = document.createElement('div');
      badge.id = 'rf14AutoBadge';
      badge.className = 'rf3-muted';
      badge.style.margin = '8px 0';
      badge.textContent = '🔊 Áudio automático ativado';
      card.insertAdjacentElement('beforebegin', badge);
    }
    return true;
  }

  function updateVersion() {
    document.querySelectorAll('.rf3-version').forEach(el => el.textContent = 'Recall v19.1');
  }

  function init() {
    enhanceHandsFree();
    enhanceCram();
    updateVersion();
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      const a = enhanceHandsFree(), b = enhanceCram();
      updateVersion();
      if ((a && b) || tries > 40) clearInterval(t);
    }, 150);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();