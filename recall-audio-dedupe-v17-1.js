(() => {
  'use strict';
  if (window.__recallAudioDedupeV171) return;
  window.__recallAudioDedupeV171 = true;

  if (!('speechSynthesis' in window)) return;

  const synth = window.speechSynthesis;
  const previousSpeak = synth.speak.bind(synth);
  let lastTargetText = '';
  let lastTargetAt = 0;

  function langKey(lang) {
    const x = String(lang || '').toLowerCase();
    if (x.startsWith('en')) return 'en';
    if (x.startsWith('de')) return 'de';
    if (x.startsWith('pt')) return 'pt';
    return '';
  }

  function normalize(text) {
    return String(text || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function sharedTargetAudioIsPlaying() {
    const el = document.getElementById('rf14SharedAudio');
    if (!el) return false;
    return !el.paused && !el.ended && Number(el.readyState || 0) >= 2;
  }

  synth.speak = function (utterance) {
    const lang = langKey(utterance?.lang);
    const text = normalize(utterance?.text);
    const now = Date.now();

    // Cram/Weak spots uses rf14SharedAudio for the prerecorded CAF file.
    // When two card-change callbacks overlap, the superseded callback can
    // fall back to speechSynthesis while the newer CAF is already playing.
    // On iOS that produces two voices. Never start target-language TTS while
    // the shared prerecorded player is active.
    if ((lang === 'en' || lang === 'de') && sharedTargetAudioIsPlaying()) {
      return;
    }

    // Also ignore an accidental duplicate request for the same target phrase
    // fired almost at the same time by overlapping custom-session handlers.
    // The window is short enough not to affect normal 3x/repeat practice.
    if ((lang === 'en' || lang === 'de') && text && text === lastTargetText && now - lastTargetAt < 900) {
      return;
    }

    if (lang === 'en' || lang === 'de') {
      lastTargetText = text;
      lastTargetAt = now;
    }

    return previousSpeak(utterance);
  };

  // When a new Cram card action begins, clear any stale native/bridged speech.
  document.addEventListener('click', event => {
    if (event.target?.closest?.('#rf3StartSession,#rf3CramNext,#rf3CramPrev,#rf3CramFlip,#rf3CramBack')) {
      try { synth.cancel(); } catch (_) {}
    }
  }, true);

  function updateVersion() {
    document.querySelectorAll('.rf3-version').forEach(el => {
      el.textContent = 'Recall v17.1';
    });
  }

  updateVersion();
  let tries = 0;
  const timer = setInterval(() => {
    updateVersion();
    if (++tries > 30) clearInterval(timer);
  }, 150);
})();
