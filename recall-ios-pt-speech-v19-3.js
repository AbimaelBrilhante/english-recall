(() => {
  'use strict';
  if (window.__recallIosPtSpeechV193) return;
  if (!('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) return;
  window.__recallIosPtSpeechV193 = true;

  const synth = window.speechSynthesis;
  const nativeSpeak = synth.speak.bind(synth);
  const nativeCancel = synth.cancel.bind(synth);
  const nativeResume = synth.resume ? synth.resume.bind(synth) : () => {};

  function portugueseVoice() {
    try {
      const voices = synth.getVoices?.() || [];
      return voices.find(v => /^pt-BR$/i.test(v.lang || '')) ||
             voices.find(v => /^pt([_-]|$)/i.test(v.lang || '')) || null;
    } catch { return null; }
  }

  // iOS/Safari can drop a pt-BR utterance when cancel() -> speak() happens
  // immediately after priming an HTMLAudioElement. A short defer keeps the
  // speech engine alive without changing the Hands-free session timing logic.
  function wrappedSpeak(utterance) {
    const lang = String(utterance?.lang || '');
    if (!/^pt([_-]|$)/i.test(lang)) return nativeSpeak(utterance);
    try {
      const v = portugueseVoice();
      if (v && !utterance.voice) utterance.voice = v;
      nativeResume();
    } catch {}
    setTimeout(() => {
      try { nativeResume(); } catch {}
      try { nativeSpeak(utterance); } catch {}
    }, 180);
  }

  try { synth.speak = wrappedSpeak; } catch {}

  // Prime speech synthesis inside the user's tap before the production flow
  // reaches its first await. The utterance is silent and immediately canceled.
  document.addEventListener('click', e => {
    const start = e.target?.closest?.('#rf2HfStart');
    if (!start) return;
    if ((document.getElementById('rf2HfMode')?.value || 'recognition') !== 'production') return;
    try {
      nativeResume();
      const u = new SpeechSynthesisUtterance('\u00A0');
      u.lang = 'pt-BR';
      u.volume = 0;
      const v = portugueseVoice();
      if (v) u.voice = v;
      nativeSpeak(u);
      setTimeout(() => { try { nativeCancel(); } catch {} }, 40);
    } catch {}
  }, true);
})();
