(() => {
  'use strict';
  if (window.__recallCramNaturalV194) return;
  const core = window.recallCore;
  if (!core) return;
  window.__recallCramNaturalV194 = true;

  const state = () => core.getState();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let shared = null;
  let fallbackToken = 0;

  function ensureAudio() {
    if (shared) return shared;
    shared = document.getElementById('rf14SharedAudio') || document.createElement('audio');
    shared.id = 'rf14SharedAudio';
    shared.preload = 'auto';
    shared.setAttribute('playsinline', '');
    shared.style.display = 'none';
    if (!shared.isConnected) document.body.appendChild(shared);
    return shared;
  }

  function audioPath(card, deckId) {
    const rid = String(card?.remoteId || '');
    return new RegExp('^' + deckId + '-\\d+$').test(rid)
      ? './audio/' + deckId + '/' + encodeURIComponent(rid) + '.caf'
      : null;
  }

  function currentInfo() {
    const view = document.getElementById('view-rf3-cram');
    if (!view?.classList.contains('active')) return null;

    const deckId = document.getElementById('rf3Deck')?.value || core.selectedDeck();
    const mode = document.getElementById('rf3Mode')?.value || 'recognition';
    const frontEl = document.querySelector('#rf3CramCard .front');
    const backEl = document.querySelector('#rf3CramCard .back');
    if (!frontEl || !backEl) return null;

    const a = (frontEl.textContent || '').trim();
    const b = (backEl.textContent || '').split('\n\n📝 ')[0].trim();
    const cards = state().cards?.[deckId] || [];
    const card = cards.find(c => c.front === a || c.back === a || c.front === b || c.back === b);
    return card ? { card, deckId, mode, frontEl, backEl } : null;
  }

  function primeDeck(deckId) {
    const card = (state().cards?.[deckId] || []).find(c => audioPath(c, deckId));
    const src = card && audioPath(card, deckId);
    if (!src) return;

    const el = ensureAudio();
    try {
      el.pause();
      el.src = src;
      el.currentTime = 0;
      el.muted = true;
      const p = el.play();
      Promise.resolve(p).then(() => {
        try { el.pause(); el.currentTime = 0; el.muted = false; } catch {}
      }).catch(() => { try { el.muted = false; } catch {} });
    } catch {
      try { el.muted = false; } catch {}
    }
  }

  function mediaAlreadyPlaying() {
    const el = document.getElementById('rf14SharedAudio');
    if (el && !el.paused && !el.ended) return true;
    try { if (window.speechSynthesis?.speaking) return true; } catch {}
    return false;
  }

  function waitAudio(el) {
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = ok => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        el.onended = el.onerror = el.onabort = null;
        ok ? resolve() : reject(new Error('audio'));
      };
      el.onended = () => finish(true);
      el.onerror = el.onabort = () => finish(false);
      const timer = setTimeout(() => finish(true), 15000);
    });
  }

  async function playTarget(card, deckId) {
    const src = audioPath(card, deckId);
    if (src) {
      try {
        const el = ensureAudio();
        el.pause();
        el.muted = false;
        el.src = src;
        el.currentTime = 0;
        el.playbackRate = 1;
        const ended = waitAudio(el);
        await el.play();
        await ended;
        return;
      } catch {}
    }

    try {
      core.speakText(card.front, deckId, 1);
      await sleep(Math.max(1800, Math.min(6500, String(card.front || '').length * 72)));
    } catch {}
  }

  async function fallbackAutoplay(reason) {
    const mine = ++fallbackToken;
    await sleep(220);
    if (mine !== fallbackToken || mediaAlreadyPlaying()) return;

    const info = currentInfo();
    if (!info) return;

    if (info.mode === 'production') {
      if (reason !== 'flip' || info.backEl.classList.contains('hidden')) return;
    }

    await playTarget(info.card, info.deckId);
  }

  function makeCardClickable() {
    const card = document.getElementById('rf3CramCard');
    if (!card || card.dataset.rf194Clickable === '1') return;
    card.dataset.rf194Clickable = '1';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', 'Virar card');
    card.style.cursor = 'pointer';

    const flip = () => {
      const btn = document.getElementById('rf3CramFlip');
      if (btn) btn.click();
    };
    card.addEventListener('click', e => {
      if (e.target.closest('button,a,input,select,textarea')) return;
      flip();
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        flip();
      }
    });
  }

  document.addEventListener('click', e => {
    const start = e.target.closest?.('#rf3StartSession');
    if (start && document.getElementById('rf3Type')?.value === 'cram') {
      const deckId = document.getElementById('rf3Deck')?.value || core.selectedDeck();
      primeDeck(deckId);
      setTimeout(() => { makeCardClickable(); fallbackAutoplay('card'); }, 40);
      return;
    }

    const nextPrev = e.target.closest?.('#rf3CramNext,#rf3CramPrev');
    if (nextPrev) {
      const deckId = document.getElementById('rf3Deck')?.value || core.selectedDeck();
      primeDeck(deckId);
      fallbackAutoplay('card');
      return;
    }

    const flip = e.target.closest?.('#rf3CramFlip');
    if (flip) {
      const deckId = document.getElementById('rf3Deck')?.value || core.selectedDeck();
      primeDeck(deckId);
      fallbackAutoplay('flip');
    }
  }, true);

  function init() {
    makeCardClickable();
    let tries = 0;
    const timer = setInterval(() => {
      makeCardClickable();
      if (++tries > 40) clearInterval(timer);
    }, 150);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
