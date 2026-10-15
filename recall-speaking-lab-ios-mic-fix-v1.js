(() => {
'use strict';
if (window.__recallSpeakingLabIosMicFixV1) return;
window.__recallSpeakingLabIosMicFixV1 = true;

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (!isIOS) return;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const inSpeakingBuilder = () => document.getElementById('view-speaking-builder')?.classList.contains('active');
const inSpeakingSixty = () => document.getElementById('view-speaking-sixty')?.classList.contains('active');
const inSpeakingCapture = () => inSpeakingBuilder() || inSpeakingSixty();

// Recording is primary in Speaking Lab. Keep SpeechRecognition optional on iOS
// so it cannot contend with MediaRecorder for the audio session.
function installScopedRecognitionGuard(key) {
  const Native = window[key];
  if (typeof Native !== 'function') return;
  function GuardedRecognition(...args) {
    if (inSpeakingCapture()) {
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

function setAudioSession(type) {
  try {
    if (navigator.audioSession && navigator.audioSession.type !== type) {
      navigator.audioSession.type = type;
    }
    return navigator.audioSession?.type || null;
  } catch {
    return null;
  }
}

function restorePlaybackWhenStopped(stream) {
  try {
    const tracks = stream?.getAudioTracks?.() || [];
    for (const track of tracks) {
      const nativeStop = track.stop?.bind(track);
      if (!nativeStop || track.__recallStopWrapped) continue;
      track.__recallStopWrapped = true;
      track.stop = () => {
        try { nativeStop(); }
        finally {
          setTimeout(() => {
            if (inSpeakingCapture()) setAudioSession('playback');
          }, 80);
        }
      };
    }
  } catch {}
  return stream;
}

async function captureWithCorrectSession(constraints) {
  // TTS can leave WebKit in "playback". Safari requires "play-and-record"
  // before microphone capture in both Sentence Builder and 60-Second Challenge.
  setAudioSession('play-and-record');
  await sleep(120);
  return restorePlaybackWhenStopped(await nativeGetUserMedia(constraints));
}

const wrappedGetUserMedia = async constraints => {
  if (!inSpeakingCapture() || !constraints?.audio) return nativeGetUserMedia(constraints);
  try {
    return await captureWithCorrectSession(constraints);
  } catch (err) {
    lastMicError = { name: err?.name || 'UnknownError', message: err?.message || '' };
    if (!transient.has(err?.name)) throw err;
    await sleep(500);
    try {
      return await captureWithCorrectSession(constraints);
    } catch (err2) {
      lastMicError = { name: err2?.name || 'UnknownError', message: err2?.message || '' };
      throw err2;
    }
  }
};

try { Object.defineProperty(md, 'getUserMedia', { configurable: true, writable: true, value: wrappedGetUserMedia }); }
catch { try { md.getUserMedia = wrappedGetUserMedia; } catch {} }

// Keep the detailed diagnostic for the Sentence Builder alert path.
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
