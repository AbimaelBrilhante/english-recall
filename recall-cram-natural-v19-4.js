(() => {
  'use strict';
  if (window.__recallCramNaturalV194) return;
  const core = window.recallCore;
  if (!core) return;
  window.__recallCramNaturalV194 = true;
  // v19.5: silent priming prevents a fixed deck phrase from leaking before cards.

  const state = () => core.getState();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let shared = null;
  let fallbackToken = 0;
  let suppressCardClickUntil = 0;

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

  const SILENT_PRIME = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
  function primeDeck() {
    // Unlock the shared iPhone media element using silence only.
    // Never use a real deck phrase here, otherwise the first deck audio can leak
    // before every Cram card.
    const el = ensureAudio();
    try {
      el.pause();
      el.src = SILENT_PRIME;
      el.currentTime = 0;
      el.muted = false;
      const p = el.play();
      if (p?.catch) p.catch(() => {});
    } catch {}
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
    if (!card || card.dataset.rf196Gestures === '1') return;
    card.dataset.rf196Gestures = '1';
    card.dataset.rf194Clickable = '1';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', 'Toque para virar. Deslize para a esquerda para avançar e para a direita para voltar.');
    card.style.cursor = 'pointer';
    card.style.touchAction = 'pan-y';

    let touchX = 0;
    let touchY = 0;
    let touching = false;

    const flip = () => {
      const btn = document.getElementById('rf3CramFlip');
      if (btn) btn.click();
    };
    const navigate = direction => {
      const btn = document.getElementById(direction === 'next' ? 'rf3CramNext' : 'rf3CramPrev');
      if (!btn) return;
      try {
        card.animate(
          direction === 'next'
            ? [{transform:'translateX(0)',opacity:1},{transform:'translateX(-28px)',opacity:.72},{transform:'translateX(0)',opacity:1}]
            : [{transform:'translateX(0)',opacity:1},{transform:'translateX(28px)',opacity:.72},{transform:'translateX(0)',opacity:1}],
          {duration:180,easing:'ease-out'}
        );
      } catch {}
      btn.click();
    };

    card.addEventListener('touchstart', e => {
      if (e.touches?.length !== 1) { touching = false; return; }
      const t = e.touches[0];
      touchX = t.clientX;
      touchY = t.clientY;
      touching = true;
    }, {passive:true});

    card.addEventListener('touchend', e => {
      if (!touching) return;
      touching = false;
      const t = e.changedTouches?.[0];
      if (!t) return;
      const dx = t.clientX - touchX;
      const dy = t.clientY - touchY;
      const horizontal = Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.2;
      if (!horizontal) return;

      suppressCardClickUntil = Date.now() + 550;
      if (e.cancelable) e.preventDefault();
      navigate(dx < 0 ? 'next' : 'prev');
    }, {passive:false});

    card.addEventListener('touchcancel', () => { touching = false; }, {passive:true});

    card.addEventListener('click', e => {
      if (Date.now() < suppressCardClickUntil) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.target.closest('button,a,input,select,textarea')) return;
      flip();
    });

    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        flip();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigate('prev');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigate('next');
      }
    });
  }

  function updateGestureHint() {
    const badge = document.getElementById('rf14AutoBadge');
    if (badge) badge.textContent = '🔊 Áudio automático · toque para virar · deslize ←/→ para navegar';
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
    updateGestureHint();
    let tries = 0;
    const timer = setInterval(() => {
      makeCardClickable();
      updateGestureHint();
      if (++tries > 40) clearInterval(timer);
    }, 150);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
