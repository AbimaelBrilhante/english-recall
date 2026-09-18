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
    if (!card || card.dataset.rf197Gestures === '1') return;
    card.dataset.rf197Gestures = '1';
    card.dataset.rf196Gestures = '1';
    card.dataset.rf194Clickable = '1';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', 'Toque para virar. Deslize para a esquerda para avançar e para a direita para voltar.');
    card.style.cursor = 'pointer';
    card.style.touchAction = 'pan-y';
    card.style.transformOrigin = '50% 55%';
    card.style.willChange = 'transform, opacity, box-shadow, filter';

    let touchX = 0;
    let touchY = 0;
    let lastX = 0;
    let lastT = 0;
    let dragDx = 0;
    let touching = false;
    let horizontalDrag = false;

    const resetInline = () => {
      card.style.transform = '';
      card.style.opacity = '';
      card.style.boxShadow = '';
      card.style.filter = '';
      card.style.transition = '';
    };

    const flip = () => {
      const btn = document.getElementById('rf3CramFlip');
      if (btn) btn.click();
    };

    const enterAnimation = direction => {
      try {
        card.animate(
          direction === 'next'
            ? [
                {transform:'translate3d(48px,0,0) rotateZ(1.4deg) scale(.985)',opacity:.46,filter:'blur(1.2px)'},
                {transform:'translate3d(0,0,0) rotateZ(0deg) scale(1)',opacity:1,filter:'blur(0px)'}
              ]
            : [
                {transform:'translate3d(-48px,0,0) rotateZ(-1.4deg) scale(.985)',opacity:.46,filter:'blur(1.2px)'},
                {transform:'translate3d(0,0,0) rotateZ(0deg) scale(1)',opacity:1,filter:'blur(0px)'}
              ],
          {duration:300,easing:'cubic-bezier(.16,1,.3,1)'}
        );
      } catch {}
    };

    const navigate = (direction, fromGesture = false) => {
      const btn = document.getElementById(direction === 'next' ? 'rf3CramNext' : 'rf3CramPrev');
      if (!btn) return;

      if (!fromGesture) {
        btn.click();
        enterAnimation(direction);
        return;
      }

      suppressCardClickUntil = Date.now() + 700;
      const width = Math.max(card.getBoundingClientRect().width, 280);
      const exitX = direction === 'next' ? -Math.max(width * 1.08, 340) : Math.max(width * 1.08, 340);
      const rotate = direction === 'next' ? -5.5 : 5.5;

      try {
        const current = getComputedStyle(card).transform === 'none' ? 'translate3d(0,0,0)' : card.style.transform || 'translate3d(0,0,0)';
        const anim = card.animate(
          [
            {transform:current,opacity:Number(card.style.opacity || 1),filter:'blur(0px)'},
            {transform:`translate3d(${exitX}px,0,0) rotateZ(${rotate}deg) scale(.965)`,opacity:.12,filter:'blur(1.8px)'}
          ],
          {duration:220,easing:'cubic-bezier(.32,.72,0,1)',fill:'forwards'}
        );
        anim.onfinish = () => {
          anim.cancel();
          resetInline();
          btn.click();
          requestAnimationFrame(() => enterAnimation(direction));
        };
      } catch {
        resetInline();
        btn.click();
        requestAnimationFrame(() => enterAnimation(direction));
      }
    };

    const springBack = () => {
      try {
        const from = card.style.transform || 'translate3d(0,0,0)';
        const opacity = Number(card.style.opacity || 1);
        const anim = card.animate(
          [
            {transform:from,opacity,filter:card.style.filter || 'blur(0px)'},
            {transform:'translate3d(0,0,0) rotateZ(0deg) scale(1)',opacity:1,filter:'blur(0px)'}
          ],
          {duration:290,easing:'cubic-bezier(.2,.9,.25,1)'}
        );
        anim.onfinish = resetInline;
      } catch { resetInline(); }
    };

    card.addEventListener('touchstart', e => {
      if (e.touches?.length !== 1) { touching = false; return; }
      const t = e.touches[0];
      touchX = lastX = t.clientX;
      touchY = t.clientY;
      lastT = performance.now();
      dragDx = 0;
      touching = true;
      horizontalDrag = false;
      card.style.transition = 'none';
    }, {passive:true});

    card.addEventListener('touchmove', e => {
      if (!touching || e.touches?.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - touchX;
      const dy = t.clientY - touchY;

      if (!horizontalDrag) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dy) > Math.abs(dx) * 1.15) {
          touching = false;
          resetInline();
          return;
        }
        horizontalDrag = Math.abs(dx) > Math.abs(dy);
      }
      if (!horizontalDrag) return;

      if (e.cancelable) e.preventDefault();
      dragDx = dx;
      lastX = t.clientX;
      lastT = performance.now();

      const width = Math.max(card.getBoundingClientRect().width, 280);
      const clamped = Math.max(-width * .72, Math.min(width * .72, dx));
      const progress = Math.min(1, Math.abs(clamped) / (width * .62));
      const rotate = Math.max(-4.2, Math.min(4.2, clamped / 42));
      const scale = 1 - progress * .018;
      const opacity = 1 - progress * .14;
      const blur = progress * .45;
      const shadowY = 18 + progress * 12;
      const shadowBlur = 38 + progress * 18;

      card.style.transform = `translate3d(${clamped * .94}px,0,0) rotateZ(${rotate}deg) scale(${scale})`;
      card.style.opacity = String(opacity);
      card.style.filter = `blur(${blur}px)`;
      card.style.boxShadow = `0 ${shadowY}px ${shadowBlur}px rgba(34,52,105,${0.14 + progress * .08})`;
    }, {passive:false});

    card.addEventListener('touchend', e => {
      if (!touching) return;
      touching = false;
      const t = e.changedTouches?.[0];
      if (!t) { resetInline(); return; }

      const dx = t.clientX - touchX;
      const dy = t.clientY - touchY;
      const now = performance.now();
      const dt = Math.max(16, now - lastT);
      const velocity = (t.clientX - lastX) / dt;
      const width = Math.max(card.getBoundingClientRect().width, 280);
      const distanceCommit = Math.abs(dx) >= Math.min(92, width * .22);
      const velocityCommit = Math.abs(dx) >= 38 && Math.abs(velocity) >= .32;
      const horizontal = horizontalDrag && Math.abs(dx) > Math.abs(dy) * 1.08;

      if (horizontal && (distanceCommit || velocityCommit)) {
        if (e.cancelable) e.preventDefault();
        navigate(dx < 0 ? 'next' : 'prev', true);
      } else if (horizontalDrag) {
        springBack();
      } else {
        resetInline();
      }
    }, {passive:false});

    card.addEventListener('touchcancel', () => {
      touching = false;
      horizontalDrag = false;
      springBack();
    }, {passive:true});

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
    if (badge) badge.textContent = '🔊 Áudio automático · toque para virar · deslize suavemente ←/→';
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
