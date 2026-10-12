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

  function ptVoices() {
    try {
      return (synth.getVoices?.() || []).filter(v => /^pt([_-]|$)/i.test(String(v.lang || '')));
    } catch { return []; }
  }

  function rawSpeech() {
    return window.recallNativeSpeech || {
      speak: nativeSpeak,
      cancel: nativeCancel,
      resume: nativeResume
    };
  }

  function statusLine(text, append=false) {
    const el = document.getElementById('rf215PtDiagStatus');
    if (!el) return;
    el.textContent = append && el.textContent ? `${el.textContent}\n${text}` : text;
  }

  function runDiagUtterance(label, text) {
    return new Promise(resolve => {
      const raw = rawSpeech();
      const voices = ptVoices();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'pt-BR';
      u.rate = 1;
      u.volume = 1;
      if (voices[0]) u.voice = voices[0];
      let started = false;
      let done = false;
      const finish = result => {
        if (done) return;
        done = true;
        statusLine(`${label}: ${result}`, true);
        resolve(result);
      };
      u.onstart = () => {
        started = true;
        statusLine(`${label}: iniciou`, true);
      };
      u.onend = () => finish('OK');
      u.onerror = e => finish(`erro ${e?.error || 'desconhecido'}`);
      try {
        raw.cancel();
        raw.resume();
        raw.speak(u);
      } catch (e) {
        finish(`exceção ${e?.name || 'erro'}`);
        return;
      }
      setTimeout(() => {
        if (!started && !done) finish('não iniciou em 2,5 s');
      }, 2500);
    });
  }

  function runPortugueseDiagnostic() {
    const voices = ptVoices();
    const ua = navigator.userActivation;
    const hadSession = healIosAudioSession();
    let sessionType = 'indisponível';
    try { sessionType = navigator.audioSession?.type || sessionType; } catch {}
    statusLine(
      `Vozes PT: ${voices.length} · ativação agora: ${ua?.isActive ?? 'n/a'} · já houve ativação: ${ua?.hasBeenActive ?? 'n/a'} · reparo áudio: ${hadSession ? 'aplicado' : 'indisponível'} · sessão: ${sessionType}`
    );
    setTimeout(() => {
      runDiagUtterance('1. imediato', 'Teste imediato em português.');
    }, 160);
    setTimeout(() => {
      healIosAudioSession();
      setTimeout(() => runDiagUtterance('2. após 3 s', 'Teste após três segundos em português.'), 160);
    }, 3200);
  }

  function ensureDiagnosticUi() {
    if (document.getElementById('rf215PtDiag')) return;
    const pt = document.getElementById('rf2HfPt');
    if (!pt) return;
    const anchor = pt.closest('label') || pt.parentElement;
    if (!anchor?.parentElement) return;

    const box = document.createElement('div');
    box.id = 'rf215PtDiag';
    box.style.marginTop = '10px';
    box.style.padding = '12px';
    box.style.border = '1px solid var(--line, rgba(120,130,150,.28))';
    box.style.borderRadius = '14px';
    box.style.background = 'var(--surface, rgba(255,255,255,.03))';
    box.innerHTML = `
      <button id="rf215PtDiagBtn" type="button" style="width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--line,rgba(120,130,150,.3));background:var(--surface-2,var(--surface,#1d2636));color:var(--ink,#fff);font:inherit;font-weight:700;">🔊 Diagnóstico voz PT</button>
      <div id="rf215PtDiagStatus" style="margin-top:9px;font-size:12px;line-height:1.45;white-space:pre-line;opacity:.78;">Toque no botão sem iniciar a sessão.</div>`;
    anchor.parentElement.insertBefore(box, anchor.nextSibling);
    document.getElementById('rf215PtDiagBtn')?.addEventListener('click', runPortugueseDiagnostic);
  }

  ensureDiagnosticUi();
  const diagObserver = new MutationObserver(ensureDiagnosticUi);
  diagObserver.observe(document.body, { childList:true, subtree:true });
})();
