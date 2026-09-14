(() => {
  'use strict';
  if (window.__recallSingleAudioV141) return;
  window.__recallSingleAudioV141 = true;

  function pauseMedia(el) {
    try {
      el.pause();
      if (Number.isFinite(el.currentTime)) el.currentTime = 0;
    } catch (_) {}
  }

  function stopMediaExcept(keep = null) {
    document.querySelectorAll('audio,video').forEach(el => {
      if (el !== keep) pauseMedia(el);
    });
  }

  function stopEverything() {
    stopMediaExcept(null);
    try { window.speechSynthesis?.cancel(); } catch (_) {}
  }

  // Keep exactly one media channel active. Recall can play audio through
  // the prerecorded-audio bridge and through the shared Hands-free/Cram
  // player; without this guard iOS can let both continue at once.
  document.addEventListener('play', event => {
    const el = event.target;
    if (!(el instanceof HTMLMediaElement)) return;
    stopMediaExcept(el);

    // The shared v14 player is independent from speechSynthesis. When it
    // starts, explicitly stop any bridge/native speech that may still be alive.
    if (el.id === 'rf14SharedAudio') {
      try { window.speechSynthesis?.cancel(); } catch (_) {}
    }
  }, true);

  // Changing a Cram card must always silence the previous card first.
  for (const id of ['rf3StartSession', 'rf3CramNext', 'rf3CramPrev', 'rf3CramFlip', 'rf3CramBack']) {
    document.addEventListener('click', event => {
      const target = event.target?.closest?.(`#${id}`);
      if (target) stopEverything();
    }, true);
  }

  // Do the same when leaving Hands-free.
  document.addEventListener('click', event => {
    if (event.target?.closest?.('#rf2HfStop,#rf2HandsBack')) stopEverything();
  }, true);

  function updateVersion() {
    document.querySelectorAll('.rf3-version').forEach(el => {
      el.textContent = 'Recall v14.1';
    });
  }

  updateVersion();
  let tries = 0;
  const timer = setInterval(() => {
    updateVersion();
    if (++tries > 30) clearInterval(timer);
  }, 150);
})();
