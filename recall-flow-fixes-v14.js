(() => {
  'use strict';
  if (window.__recallFlowFixesV14) return;
  const core = window.recallCore;
  if (!core) return;
  window.__recallFlowFixesV14 = true;

  const DECKS = core.DECKS;
  const state = () => core.getState();
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  let hfRunning = false;
  let hfToken = 0;
  let wake = null;
  let hfAudio = null;
  let hfDeck = null;
  let hfCards = [];
  let hfIndex = 0;

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
    hfAudio = document.createElement('audio');
    hfAudio.id = 'rf14SharedAudio';
    hfAudio.preload = 'auto';
    hfAudio.setAttribute('playsinline', '');
    hfAudio.style.display = 'none';
    document.body.appendChild(hfAudio);
    return hfAudio;
  }

  function waitAudio(el) {
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = ok => {
        if (done) return;
        done = true;
        el.onended = null; el.onerror = null; el.onabort = null;
        ok ? resolve() : reject(new Error('audio'));
      };
      el.onended = () => finish(true);
      el.onerror = () => finish(false);
      el.onabort = () => finish(false);
      setTimeout(() => finish(true), 12000);
    });
  }

  async function playRecorded(card, deckId, rate = 1) {
    const p = audioPath(card, deckId);
    if (!p) throw new Error('no-recorded-audio');
    const el = ensureSharedAudio();
    try { el.pause(); } catch {}
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
      return true;
    } catch {
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
    try {
      speechSynthesis.cancel();
      await new Promise(resolve => {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'pt-BR'; u.rate = 1;
        let done = false;
        const finish = () => { if (done) return; done = true; resolve(); };
        u.onend = finish; u.onerror = finish;
        speechSynthesis.speak(u);
        setTimeout(finish, Math.max(3500, Math.min(9000, String(text || '').length * 85)));
      });
    } catch {}
  }

  function handCards() {
    const deckId = document.getElementById('rf2HfDeck')?.value || 'en';
    const src = document.getElementById('rf2HfSource')?.value || 'due';
    const all = (state().cards?.[deckId] || []).filter(c => !c.suspended);
    if (src === 'favorites') return [deckId, all.filter(c => c.favorite)];
    if (src === 'all') return [deckId, all];
    const seen = new Set(), cards = [];
    for (const x of core.dueNow(deckId)) {
      if (!x.card.suspended && !seen.has(x.card.id)) { seen.add(x.card.id); cards.push(x.card); }
    }
    return [deckId, cards];
  }

  function renderHandsCard(card, mode, index, total) {
    const lang = document.getElementById('rf2HfLang');
    const phrase = document.getElementById('rf2HfPhrase');
    const hint = document.getElementById('rf2HfHint');
    if (lang) lang.textContent = `${DECKS[hfDeck].flag} ${DECKS[hfDeck].name} · ${index + 1}/${total}`;
    if (mode === 'production') {
      if (phrase) phrase.textContent = card.back;
      if (hint) hint.textContent = 'Traduza em voz alta. Depois você ouvirá a resposta correta.';
    } else {
      if (phrase) phrase.textContent = card.front;
      if (hint) hint.textContent = 'Ouça e repita em voz alta durante a pausa.';
    }
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
    const [deckId, cards] = handCards();
    hfDeck = deckId; hfCards = cards; hfIndex = 0;
    const phrase = document.getElementById('rf2HfPhrase');
    if (!cards.length) { if (phrase) phrase.textContent = 'Nenhuma frase nesta seleção.'; return; }

    hfRunning = true;
    const token = ++hfToken;
    const mode = document.getElementById('rf2HfMode')?.value || 'recognition';
    const pause = Number(document.getElementById('rf2HfPause')?.value || 5) * 1000;
    const repeats = Math.max(1, Number(document.getElementById('rf2HfRepeats')?.value || 1));
    const speakTranslation = Boolean(document.getElementById('rf2HfPt')?.checked);

    try { wake = await navigator.wakeLock?.request('screen'); } catch {}

    // Reuse one media element for the whole session. This is important on iPhone:
    // creating a new Audio() after every await can lose the original user gesture.
    ensureSharedAudio();

    while (hfRunning && token === hfToken) {
      const card = cards[hfIndex % cards.length];
      renderHandsCard(card, mode, hfIndex % cards.length, cards.length);

      if (mode === 'production') {
        await speakPt(card.back);
        if (!hfRunning || token !== hfToken) break;
        await sleep(pause);
        for (let n = 0; n < repeats && hfRunning && token === hfToken; n++) {
          await playTarget(card, deckId, 1);
          if (n < repeats - 1) await sleep(450);
        }
      } else {
        for (let n = 0; n < repeats && hfRunning && token === hfToken; n++) {
          await playTarget(card, deckId, 1);
          if (n < repeats - 1) await sleep(450);
        }
        if (speakTranslation && hfRunning && token === hfToken) {
          await speakPt(card.back);
          await sleep(350);
        }
        if (hfRunning && token === hfToken) await sleep(pause);
      }
      hfIndex++;
    }
  }

  function enhanceHandsFree() {
    const view = document.getElementById('view-rf2-hands');
    const grid = view?.querySelector('.rf2-grid');
    if (!view || !grid) return false;

    if (!document.getElementById('rf2HfMode')) {
      const label = document.createElement('label');
      label.innerHTML = 'Modo<select id="rf2HfMode" class="setting"><option value="recognition">👁 Compreensão</option><option value="production">🗣 Produção</option></select>';
      grid.insertBefore(label, grid.children[1] || null);
    }

    const mode = document.getElementById('rf2HfMode');
    const ptToggle = document.getElementById('rf2HfPt')?.closest('.toggle');
    const updateModeUi = () => {
      if (!ptToggle || !mode) return;
      const prod = mode.value === 'production';
      ptToggle.style.display = prod ? 'none' : '';
      const hint = document.getElementById('rf2HfHint');
      if (hint && !hfRunning) hint.textContent = prod ? 'Português → fale a tradução → ouça a resposta.' : 'Idioma-alvo → ouça e repita.';
    };
    if (mode) { mode.onchange = updateModeUi; updateModeUi(); }

    const start = document.getElementById('rf2HfStart');
    const stop = document.getElementById('rf2HfStop');
    const back = document.getElementById('rf2HandsBack');
    if (start) start.onclick = startHands14;
    if (stop) stop.onclick = stopHands14;
    if (back) back.onclick = () => { stopHands14(); core.showView('decks'); };
    return true;
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
      // In production, do not reveal the answer through audio before the user flips.
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
    document.querySelectorAll('.rf3-version').forEach(el => el.textContent = 'Recall v14.0');
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
      if ((a && b) || tries > 30) clearInterval(t);
    }, 150);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();