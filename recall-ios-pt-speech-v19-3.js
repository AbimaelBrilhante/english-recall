(() => {
  'use strict';
  if (window.__recallPtSpeechV2012) return;
  if (!('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) return;
  window.__recallPtSpeechV2012 = true;

  const synth = window.speechSynthesis;
  const nativeSpeak = synth.speak.bind(synth);
  const nativeCancel = synth.cancel.bind(synth);
  const nativeResume = synth.resume ? synth.resume.bind(synth) : () => {};
  let handsFreeActive = false;
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

  // Unlock Portuguese TTS directly inside the user's tap. On iPhone this must
  // happen synchronously; setTimeout/await before the first speak() is unreliable.
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

  function forceCancel() {
    try { nativeCancel(); } catch {}
    primeUtterance = null;
  }

  // The Hands-free controllers call speechSynthesis.cancel() during startup and
  // immediately before Portuguese TTS. On iOS that destroys the user-gesture
  // unlock and the later Portuguese utterance is silently dropped. While a
  // Hands-free session is active, ignore those internal cancels. Stop/Back still
  // perform a real native cancel below.
  try {
    synth.cancel = () => {
      if (handsFreeActive) return;
      forceCancel();
    };
  } catch {}

  document.addEventListener('click', e => {
    const start = e.target?.closest?.('#rf2HfStart');
    if (start) {
      // Starting again is an explicit reset: cancel old speech first, then prime
      // immediately before the mode controller gets a chance to run.
      forceCancel();
      handsFreeActive = true;
      prime();
      return;
    }

    const stop = e.target?.closest?.('#rf2HfStop,#rf2HandsBack');
    if (stop) {
      handsFreeActive = false;
      forceCancel();
    }
  }, true);

  window.recallPtSpeech = {
    prime,
    speak,
    cancel: forceCancel,
    setHandsFreeActive(value) { handsFreeActive = Boolean(value); }
  };
})();
