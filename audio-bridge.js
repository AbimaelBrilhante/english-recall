(() => {
  'use strict';

  if (!('speechSynthesis' in window)) return;

  const synth = window.speechSynthesis;
  const nativeSpeak = synth.speak.bind(synth);
  const nativeCancel = synth.cancel.bind(synth);
  const prerecorded = new Map();
  let activeAudio = null;

  async function loadPrerecordedMap() {
    try {
      const response = await fetch(`./decks/english.json?audio-test=${Date.now()}`, {cache: 'no-store'});
      if (!response.ok) return;
      const deck = await response.json();
      const card = Array.isArray(deck.cards) ? deck.cards.find(c => c.id === 'en-001') : null;
      if (card?.front) {
        prerecorded.set(`en|${card.front}`, './audio/en/en-001.caf');
      }
    } catch (error) {
      console.warn('[Recall audio test] Could not load deck map.', error);
    }
  }

  function languageKey(lang) {
    const value = String(lang || '').toLowerCase();
    if (value.startsWith('de')) return 'de';
    return 'en';
  }

  function stopPrerecorded() {
    if (!activeAudio) return;
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch (_) {}
    activeAudio = null;
  }

  synth.cancel = function () {
    stopPrerecorded();
    return nativeCancel();
  };

  synth.speak = function (utterance) {
    const text = String(utterance?.text || '');
    const key = `${languageKey(utterance?.lang)}|${text}`;
    const audioPath = prerecorded.get(key);

    if (!audioPath) {
      return nativeSpeak(utterance);
    }

    stopPrerecorded();
    nativeCancel();

    const audio = new Audio(`${audioPath}?v=1`);
    activeAudio = audio;
    audio.preload = 'auto';
    audio.playbackRate = Number(utterance?.rate) || 1;

    let fellBack = false;
    const fallback = () => {
      if (fellBack) return;
      fellBack = true;
      if (activeAudio === audio) activeAudio = null;
      try { nativeSpeak(utterance); } catch (_) {}
    };

    audio.addEventListener('error', fallback, {once: true});
    audio.addEventListener('ended', () => {
      if (activeAudio === audio) activeAudio = null;
    }, {once: true});

    try {
      const playPromise = audio.play();
      if (playPromise?.catch) playPromise.catch(fallback);
    } catch (_) {
      fallback();
    }
  };

  loadPrerecordedMap();
  console.info('[Recall audio test] en-001 prerecorded CAF bridge loaded.');
})();
