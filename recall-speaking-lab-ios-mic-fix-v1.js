(() => {
'use strict';
if (window.__recallSpeakingLabIosMicFixV1) return;
window.__recallSpeakingLabIosMicFixV1 = true;

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (!isIOS) return;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const inSpeakingBuilder = () => document.getElementById('view-speaking-builder')?.classList.contains('active');

// In Sentence Builder, recording is the primary feature. Safari/iOS can contend for
// the microphone when MediaRecorder and Web Speech Recognition are started together.
// We keep recognition available elsewhere, but use a no-op recognizer inside this mode.
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

// Retry only transient device-busy failures. Permission denials are never retried or hidden.
const md = navigator.mediaDevices;
if (md?.getUserMedia) {
  const nativeGetUserMedia = md.getUserMedia.bind(md);
  const transient = new Set(['NotReadableError', 'AbortError', 'InvalidStateError']);
  try {
    md.getUserMedia = async constraints => {
      try {
        return await nativeGetUserMedia(constraints);
      } catch (err) {
        if (!inSpeakingBuilder() || !constraints?.audio || !transient.has(err?.name)) throw err;
        await sleep(650);
        return nativeGetUserMedia(constraints);
      }
    };
  } catch {}
}
})();
