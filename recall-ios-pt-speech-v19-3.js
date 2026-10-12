(() => {
  'use strict';
  if (window.__recallPtSpeechV2012) return;
  if (!('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) return;
  window.__recallPtSpeechV2012 = true;

  const synth = window.speechSynthesis;
  const nativeSpeak = synth.speak.bind(synth);
  const nativeCancel = synth.cancel.bind(synth);
  const nativeResume = synth.resume ? synth.resume.bind(synth) : () => {};
  let primeUtterance = null;

  function portugueseVoice() {
    try {
      const voices = synth.getVoices?.() || [];
      return voices.find(v => /^pt-BR$/i.test(v.lang || '')) ||
             voices.find(v => /^pt([_-]|$)/i.test(v.lang || '')) || null;
    } catch { return null; }
  }

  function makeUtterance(text) {
    const u = new SpeechSynthesisUtterance(String(text || ''));
    u.lang = 'pt-BR';
    u.rate = 1;
    const v = portugueseVoice();
    if (v) u.voice = v;
    return u;
  }

  // iOS only reliably unlocks speechSynthesis when speak() is called directly
  // inside the user's tap. Controllers call this after their own cancel/cleanup
  // and immediately after starting the HTMLAudioElement prime, before any await.
  function prime() {
    try {
      nativeResume();
      const u = makeUtterance('\u00A0');
      u.volume = 0.01;
      primeUtterance = u;
      const release = () => { if (primeUtterance === u) primeUtterance = null; };
      u.onend = release;
      u.onerror = release;
      nativeSpeak(u);
      return true;
    } catch {
      primeUtterance = null;
      return false;
    }
  }

  function speak(text) {
    return new Promise(resolve => {
      try {
        nativeResume();
        const u = makeUtterance(text);
        let done = false;
        const timer = setTimeout(finish, Math.max(3500, Math.min(10000, String(text || '').length * 95)));
        function finish() {
          if (done) return;
          done = true;
          clearTimeout(timer);
          u.onend = null;
          u.onerror = null;
          resolve();
        }
        u.onend = finish;
        u.onerror = finish;
        nativeSpeak(u);
      } catch {
        resolve();
      }
    });
  }

  function cancel() {
    try { nativeCancel(); } catch {}
    primeUtterance = null;
  }

  window.recallPtSpeech = { prime, speak, cancel };
})();
