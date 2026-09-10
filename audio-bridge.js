(() => {
  'use strict';

  if (!('speechSynthesis' in window)) return;

  const synth = window.speechSynthesis;
  const nativeSpeak = synth.speak.bind(synth);
  const nativeCancel = synth.cancel.bind(synth);
  const prerecordedByLang = new Map();
  const prerecordedByText = new Map();
  let activeAudio = null;
  let mapReady = false;

  const DECKS = [
    { id: 'en', file: 'english.json' },
    { id: 'de', file: 'german.json' }
  ];

  function languageKey(lang) {
    const value = String(lang || '').toLowerCase();
    if (value.startsWith('de')) return 'de';
    if (value.startsWith('en')) return 'en';
    return '';
  }

  function textKey(text) {
    return String(text || '').trim();
  }

  async function loadDeckMap(deck) {
    try {
      const response = await fetch(`./decks/${deck.file}?audio-map=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      const cards = Array.isArray(data.cards) ? data.cards : [];

      for (const card of cards) {
        if (!card?.id || !card?.front) continue;
        const text = textKey(card.front);
        const path = `./audio/${deck.id}/${encodeURIComponent(card.id)}.caf`;
        prerecordedByLang.set(`${deck.id}|${text}`, path);
        if (!prerecordedByText.has(text)) prerecordedByText.set(text, path);
      }
    } catch (error) {
      console.warn(`[Recall audio] Could not load ${deck.id} deck map.`, error);
    }
  }

  const mapPromise = Promise.all(DECKS.map(loadDeckMap)).finally(() => {
    mapReady = true;
    console.info(`[Recall audio] Audio map ready for ${prerecordedByText.size} cards.`);
  });

  function stopPrerecorded() {
    if (!activeAudio) return;
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch (_) {}
    activeAudio = null;
  }

  function fallbackToBrowser(utterance) {
    try { nativeSpeak(utterance); } catch (_) {}
  }

  function handleSpeak(utterance) {
    const text = textKey(utterance?.text);
    const lang = languageKey(utterance?.lang);
    const audioPath = (lang ? prerecordedByLang.get(`${lang}|${text}`) : null) || prerecordedByText.get(text);

    if (!audioPath) {
      fallbackToBrowser(utterance);
      return;
    }

    stopPrerecorded();
    nativeCancel();

    const audio = new Audio(`${audioPath}?v=2`);
    activeAudio = audio;
    audio.preload = 'auto';
    audio.playbackRate = Number(utterance?.rate) || 1;

    let fellBack = false;
    const fallback = () => {
      if (fellBack) return;
      fellBack = true;
      if (activeAudio === audio) activeAudio = null;
      fallbackToBrowser(utterance);
    };

    audio.addEventListener('error', fallback, { once: true });
    audio.addEventListener('ended', () => {
      if (activeAudio === audio) activeAudio = null;
    }, { once: true });

    try {
      const playPromise = audio.play();
      if (playPromise?.catch) playPromise.catch(fallback);
    } catch (_) {
      fallback();
    }
  }

  synth.cancel = function () {
    stopPrerecorded();
    return nativeCancel();
  };

  synth.speak = function (utterance) {
    if (!mapReady) {
      mapPromise.finally(() => handleSpeak(utterance));
      return;
    }
    handleSpeak(utterance);
  };

  console.info('[Recall audio] Prerecorded CAF bridge enabled with language + text fallback for English and German.');
})();