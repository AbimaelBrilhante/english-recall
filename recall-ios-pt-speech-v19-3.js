(() => {
  'use strict';
  if (window.__recallPtSpeechV2013) return;
  if (!('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) return;
  window.__recallPtSpeechV2013 = true;

  const synth = window.speechSynthesis;
  const bridgeSpeak = synth.speak.bind(synth);
  const bridgeCancel = synth.cancel.bind(synth);
  const raw = window.recallNativeSpeech || {
    speak: synth.speak.bind(synth),
    cancel: synth.cancel.bind(synth),
    resume: synth.resume ? synth.resume.bind(synth) : () => {}
  };

  function isPortuguese(utterance){
    return /^pt([_-]|$)/i.test(String(utterance?.lang || ''));
  }

  function clonePortuguese(source){
    const u = new SpeechSynthesisUtterance(String(source?.text || ''));
    u.lang = 'pt-BR';
    u.rate = Number(source?.rate) || 1;
    u.pitch = Number(source?.pitch) || 1;
    u.volume = Number.isFinite(Number(source?.volume)) ? Number(source.volume) : 1;
    return u;
  }

  function speakPortugueseDirect(source){
    let finished = false;
    let started = false;
    let attempt = 0;
    let watchdog = null;

    const finish = (kind, event) => {
      if (finished) return;
      finished = true;
      if (watchdog) clearTimeout(watchdog);
      try {
        if (kind === 'end') source?.onend?.call(source, event);
        else source?.onerror?.call(source, event);
      } catch {}
    };

    const run = () => {
      attempt += 1;
      started = false;
      const u = clonePortuguese(source);
      u.onstart = event => {
        started = true;
        try { source?.onstart?.call(source, event); } catch {}
      };
      u.onend = event => finish('end', event);
      u.onerror = event => {
        if (attempt < 2 && !finished) {
          setTimeout(run, 120);
          return;
        }
        finish('error', event);
      };

      try {
        // iOS is much more reliable when cancel/resume/speak happen together.
        raw.cancel();
        raw.resume();
        raw.speak(u);
      } catch (error) {
        if (attempt < 2) setTimeout(run, 120);
        else finish('error', error);
        return;
      }

      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        if (finished || started) return;
        if (attempt < 2) {
          try { raw.cancel(); } catch {}
          run();
        } else {
          finish('error', new Error('pt-speech-did-not-start'));
        }
      }, 900);
    };

    run();
  }

  // English/German continue through the CAF bridge. Portuguese goes straight
  // to Safari's native speech engine, avoiding the bridge and stale voice state.
  synth.speak = function(utterance){
    if (isPortuguese(utterance)) {
      speakPortugueseDirect(utterance);
      return;
    }
    return bridgeSpeak(utterance);
  };

  synth.cancel = function(){
    try { raw.cancel(); } catch {}
    try { return bridgeCancel(); } catch {}
  };

  window.recallPtSpeech = {
    speak(text){
      return new Promise(resolve => {
        const u = new SpeechSynthesisUtterance(String(text || ''));
        u.lang = 'pt-BR';
        u.rate = 1;
        u.onend = resolve;
        u.onerror = resolve;
        synth.speak(u);
      });
    },
    cancel(){ try { synth.cancel(); } catch {} }
  };
})();