(() => {
'use strict';
if (window.__recallSpeakingLabIosMicFixV1) return;
window.__recallSpeakingLabIosMicFixV1 = true;

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (!isIOS) return;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const inSpeakingBuilder = () => document.getElementById('view-speaking-builder')?.classList.contains('active');

// Recording is primary in Sentence Builder. Keep SpeechRecognition disabled here on iOS.
function installScopedRecognitionGuard(key) {
  const Native = window[key];
  if (typeof Native !== 'function') return;
  function GuardedRecognition(...args) {
    if (inSpeakingBuilder()) {
      return {
        lang: 'en-US',
        interimResults: false,
        continuous: false,
        onresult: null,
        onerror: null,
        onend: null,
        start() {},
        stop() { try { this.onend?.(); } catch {} },
        abort() { try { this.onend?.(); } catch {} }
      };
    }
    return Reflect.construct(Native, args, new.target || Native);
  }
  try { GuardedRecognition.prototype = Native.prototype; } catch {}
  try { Object.defineProperty(window, key, { configurable: true, writable: true, value: GuardedRecognition }); }
  catch { try { window[key] = GuardedRecognition; } catch {} }
}

installScopedRecognitionGuard('SpeechRecognition');
installScopedRecognitionGuard('webkitSpeechRecognition');

const md = navigator.mediaDevices;
if (!md?.getUserMedia) return;
const nativeGetUserMedia = md.getUserMedia.bind(md);
const transient = new Set(['NotReadableError', 'AbortError', 'InvalidStateError']);
let lastMicError = null;

const wrappedGetUserMedia = async constraints => {
  if (!inSpeakingBuilder() || !constraints?.audio) return nativeGetUserMedia(constraints);
  try {
    return await nativeGetUserMedia(constraints);
  } catch (err) {
    lastMicError = { name: err?.name || 'UnknownError', message: err?.message || '' };
    if (!transient.has(err?.name)) throw err;
    await sleep(700);
    try {
      return await nativeGetUserMedia(constraints);
    } catch (err2) {
      lastMicError = { name: err2?.name || 'UnknownError', message: err2?.message || '' };
      throw err2;
    }
  }
};

try { Object.defineProperty(md, 'getUserMedia', { configurable: true, writable: true, value: wrappedGetUserMedia }); }
catch { try { md.getUserMedia = wrappedGetUserMedia; } catch {} }

// Replace only the generic Sentence Builder mic alert with the real iOS/WebKit error.
const nativeAlert = window.alert.bind(window);
window.alert = msg => {
  const text = String(msg || '');
  if (inSpeakingBuilder() && text.startsWith('Não consegui acessar o microfone') && lastMicError) {
    const detail = lastMicError.message ? `\n\n${lastMicError.message}` : '';
    nativeAlert(`Falha do microfone no iPhone: ${lastMicError.name}${detail}`);
    return;
  }
  nativeAlert(msg);
};
})();
