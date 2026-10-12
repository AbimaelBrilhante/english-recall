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

  // iOS 27 / standalone PWA can leave WebKit's audio session in a stale
  // ringer-muted state while every playback API still reports success. Cycling
  // through a genuinely different category forces WebKit to rebuild the output
  // route. Feature-detected so other browsers keep the previous behavior.
  function healIosAudioSession() {
    const session = navigator.audioSession;
    if (!session) return false;
    try {
      session.type = 'ambient';
      setTimeout(() => {
        try { session.type = 'playback'; } catch {}
      }, 0);
      return true;
    } catch {
      return false;
    }
  }

  // iOS/Safari can drop a pt-BR utterance when cancel() -> speak() happens
  // immediately after priming an HTMLAudioElement. Heal the output route first,
  // then keep the short defer that was already stable on older iOS versions.
  function wrappedSpeak(utterance) {
    const lang = String(utterance?.lang || '');
    if (!/^pt([_-]|$)/i.test(lang)) return nativeSpeak(utterance);
    healIosAudioSession();
    try {
      const v = portugueseVoice();
      if (v && !utterance.voice) utterance.voice = v;
      nativeResume();
    } catch {}
    setTimeout(() => {
      try { nativeResume(); } catch {}
      try { nativeSpeak(utterance); } catch {}
    }, 220);
  }

  try { synth.speak = wrappedSpeak; } catch {}

  function primePortuguese() {
    healIosAudioSession();
    setTimeout(() => {
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
    }, 70);
  }

  // Prime Portuguese speech from the user's Start tap. In Compreensão the
  // recognition controller first stops any previous session, so prime just
  // after that synchronous cleanup. Production keeps its immediate path.
  document.addEventListener('click', e => {
    const start = e.target?.closest?.('#rf2HfStart');
    if (!start) return;
    const mode = document.getElementById('rf2HfMode')?.value || 'recognition';
    const wantsPortuguese = mode === 'production' || Boolean(document.getElementById('rf2HfPt')?.checked);
    if (!wantsPortuguese) return;
    healIosAudioSession();
    if (mode === 'recognition') setTimeout(primePortuguese, 80);
    else primePortuguese();
  }, true);
})();
