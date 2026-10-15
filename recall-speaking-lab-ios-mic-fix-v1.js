(() => {
'use strict';
if (window.__recallSpeakingLabIosMicFixV1) return;
window.__recallSpeakingLabIosMicFixV1 = true;

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (!isIOS) return;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const inSpeakingBuilder = () => document.getElementById('view-speaking-builder')?.classList.contains('active');

// Sentence Builder: recording is primary. Avoid running Web Speech Recognition
// at the same time as MediaRecorder on iOS; transcription remains optional.
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
let sourceStream = null;
let sourcePromise = null;

function sourceIsLive() {
  return Boolean(sourceStream?.getAudioTracks?.().some(t => t.readyState === 'live'));
}

function releaseSource() {
  try { sourceStream?.getTracks?.().forEach(t => t.stop()); } catch {}
  sourceStream = null;
  sourcePromise = null;
}

async function ensureSource(constraints) {
  if (sourceIsLive()) return sourceStream;
  releaseSource();
  if (!sourcePromise) {
    sourcePromise = nativeGetUserMedia(constraints)
      .then(s => {
        sourceStream = s;
        sourcePromise = null;
        return s;
      })
      .catch(err => {
        sourcePromise = null;
        throw err;
      });
  }
  return sourcePromise;
}

function cloneForAttempt(source) {
  const audio = source.getAudioTracks?.() || [];
  if (!audio.length) throw new DOMException('No live audio track', 'NotReadableError');
  const cloned = audio.map(track => {
    const c = track.clone();
    try { c.enabled = true; } catch {}
    return c;
  });
  return new MediaStream(cloned);
}

// Reuse one native microphone source throughout the Sentence Builder session.
// The app still receives a disposable stream per attempt, so its normal cleanup
// stops only the cloned track and not the native source.
try {
  md.getUserMedia = async constraints => {
    if (!inSpeakingBuilder() || !constraints?.audio) {
      return nativeGetUserMedia(constraints);
    }

    try {
      const source = await ensureSource(constraints);
      return cloneForAttempt(source);
    } catch (err) {
      // One recovery attempt for transient Safari device-state failures.
      if (!['NotReadableError', 'AbortError', 'InvalidStateError'].includes(err?.name)) throw err;
      releaseSource();
      await sleep(900);
      const source = await ensureSource(constraints);
      return cloneForAttempt(source);
    }
  };
} catch {}

// Release the native source as soon as the user leaves Sentence Builder.
let wasInBuilder = false;
const watchView = () => {
  const now = inSpeakingBuilder();
  if (wasInBuilder && !now) releaseSource();
  wasInBuilder = now;
};
const observer = new MutationObserver(watchView);
try { observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] }); } catch {}
window.addEventListener('pagehide', releaseSource);
window.addEventListener('beforeunload', releaseSource);
setInterval(watchView, 500);
})();
