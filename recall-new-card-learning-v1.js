(() => {
  'use strict';
  if (window.__recallNewCardLearningV1) return;
  const core = window.recallCore;
  if (!core) return;
  window.__recallNewCardLearningV1 = true;

  const STORAGE_KEY = 'recallNewCardLearningV1';
  const runtimeSeen = new Set();
  let activeCard = null;
  let activeDeck = 'en';
  let step = 0;
  let plays = 0;
  let overlay = null;
  let stream = null;
  let recorder = null;
  let chunks = [];
  let audioUrl = '';
  let recordingStep = '';
  let playbackTimer = null;

  const STOP = {
    en: new Set('a an and are as at be been being but by can could did do does for from had has have he her here him his how i if in into is it its me my of on or our she should so that the their them then there they this to too us was we were what when where which who why will with would you your about after before more most some such than very just also still first main one'.split(/\s+/)),
    de: new Set('aber als am an auch auf aus bei bin bis bist da das dass dein deine dem den der die ein eine einem einen einer er es für fur hat haben ich im in ist ja mit nicht noch oder sein seine sind sie so und uns von war was wenn wie wir wo zu zum zur du ihr ihre mein meine mich mir sich'.split(/\s+/))
  };

  const PATTERNS = {
    en: [
      /\bif i understood correctly\b/i,
      /\bfrom my perspective\b/i,
      /\bone of my\b/i,
      /\bthe main challenge(?: was| is)?\b/i,
      /\bthe result was\b/i,
      /\b(?:am|is|are|was|were) responsible for\b/i,
      /\b(?:have|has|had) experience(?: working| using)?\b/i,
      /\b(?:have|has) been \w+ing\b/i,
      /\bwould like to\b/i,
      /\bneed to\b/i,
      /\btry to\b/i,
      /\bstart by\b/i,
      /\bused to\b/i,
      /\blooking for\b/i,
      /\bmake sure\b/i,
      /\bin order to\b/i,
      /\bas a result\b/i,
      /\bcould you\b/i,
      /\bwhenever possible\b/i,
      /\bhow to\b/i
    ],
    de: [
      /\bich möchte\b/i,
      /\bich hätte gern\b/i,
      /\bich brauche\b/i,
      /\bich kann\b/i,
      /\bich muss\b/i,
      /\bich habe\b/i,
      /\bich bin\b/i,
      /\bes gibt\b/i,
      /\bwo ist\b/i,
      /\bwie viel\b/i,
      /\bkönnen sie\b/i,
      /\bkann ich\b/i,
      /\bnoch einmal\b/i,
      /\bich würde gern\b/i
    ]
  };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : null;
      return data && typeof data === 'object' ? data : {version:1, completed:{}};
    } catch {
      return {version:1, completed:{}};
    }
  }

  function completed(cardId) {
    return Boolean(loadStore().completed?.[cardId]);
  }

  function markCompleted(cardId) {
    const data = loadStore();
    data.version = 1;
    data.completed ||= {};
    data.completed[cardId] = Date.now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }

  function totalReps(card) {
    return Number(card?.schedules?.recognition?.reps || 0) + Number(card?.schedules?.production?.reps || 0);
  }

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'').replace(/[^a-z0-9äöüß\s-]/gi,' ').replace(/\s+/g,' ').trim();
  }

  function words(s) {
    return String(s || '').replace(/[“”".,!?;:()\[\]{}]/g,' ').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
  }

  function recurringChunk(card, deckId) {
    const text = String(card?.front || '');
    for (const re of PATTERNS[deckId] || []) {
      const m = text.match(re);
      if (m?.[0]) return m[0];
    }

    const own = words(text);
    const stop = STOP[deckId] || new Set();
    const cards = core.getState()?.cards?.[deckId] || [];
    let best = null;

    for (let n = Math.min(4, own.length); n >= 2; n--) {
      for (let i = 0; i <= own.length - n; i++) {
        const raw = own.slice(i, i + n).join(' ');
        const key = norm(raw);
        const toks = key.split(' ').filter(Boolean);
        if (!key || toks.every(t => stop.has(t))) continue;
        let count = 0;
        for (const c of cards) {
          const hay = ` ${norm(c.front)} `;
          if (hay.includes(` ${key} `)) count++;
        }
        if (count < 2) continue;
        const score = n * 20 + Math.min(count, 8) * 3;
        if (!best || score > best.score) best = {text:raw, score};
      }
      if (best && n >= 3) break;
    }

    if (best) return best.text;
    if (own.length <= 4) return own.join(' ');
    return own.slice(0, 4).join(' ');
  }

  function setAudio(type) {
    try { if (navigator.audioSession) navigator.audioSession.type = type; } catch {}
  }

  function stopPlaybackTimer() {
    if (playbackTimer) clearTimeout(playbackTimer);
    playbackTimer = null;
  }

  function stopStream(restore = true) {
    try { stream?.getTracks().forEach(t => t.stop()); } catch {}
    stream = null;
    recorder = null;
    chunks = [];
    stopPlaybackTimer();
    if (restore) playbackTimer = setTimeout(() => setAudio('playback'), 120);
  }

  async function startRecord(kind) {
    if (recorder && recorder.state === 'recording') return;
    try { speechSynthesis.cancel(); } catch {}
    stopPlaybackTimer();
    setAudio('play-and-record');
    await sleep(150);
    stream = await navigator.mediaDevices.getUserMedia({audio:true});
    const mime = ['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(x => MediaRecorder.isTypeSupported?.(x)) || '';
    chunks = [];
    recorder = new MediaRecorder(stream, mime ? {mimeType:mime} : undefined);
    recorder.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
    recorder.start();
    recordingStep = kind;
    render();
  }

  async function stopRecord() {
    if (!recorder || recorder.state !== 'recording') return;
    const mr = recorder;
    const blob = await new Promise(resolve => {
      mr.onstop = () => resolve(new Blob(chunks, {type:mr.mimeType || 'audio/mp4'}));
      try { mr.stop(); } catch { resolve(new Blob(chunks)); }
    });
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = blob.size ? URL.createObjectURL(blob) : '';
    stopStream(true);
    recordingStep = '';
    render();
  }

  function playRecording() {
    if (!audioUrl) return;
    new Audio(audioUrl).play().catch(() => {});
  }

  function speakTarget() {
    if (!activeCard) return;
    plays++;
    setAudio('playback');
    core.speakText(activeCard.front, activeDeck, 1);
    render();
  }

  function injectStyle() {
    if (document.getElementById('rnclStyle')) return;
    const s = document.createElement('style');
    s.id = 'rnclStyle';
    s.textContent = `
      .rncl{position:fixed;inset:0;z-index:10050;background:var(--bg,#12111a);color:var(--ink,#f5f3fb);overflow:auto;padding:calc(env(safe-area-inset-top) + 14px) 16px calc(env(safe-area-inset-bottom) + 28px)}
      .rncl-wrap{max-width:620px;margin:0 auto}.rncl-top{display:flex;align-items:center;gap:10px;margin-bottom:14px}.rncl-top strong{font-size:20px}.rncl-top span{margin-left:auto;font-size:10px;color:var(--muted,#aaa5b9);font-weight:800}.rncl-progress{height:6px;background:var(--surface2,#242132);border-radius:999px;overflow:hidden;margin-bottom:14px}.rncl-progress i{display:block;height:100%;background:linear-gradient(90deg,var(--primary,#3c318c),#8190ff);border-radius:999px}
      .rncl-card{background:var(--surface,#1c1a27);border:1px solid var(--line,#353145);border-radius:22px;padding:18px;margin-bottom:12px}.rncl-kicker{font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted,#aaa5b9);font-weight:900}.rncl-title{font-size:21px;line-height:1.25;margin:7px 0 5px}.rncl-sub{font-size:11px;line-height:1.5;color:var(--muted,#aaa5b9)}
      .rncl-listen{text-align:center;padding:12px 0}.rncl-orb,.rncl-mic{border:0;border-radius:50%;display:grid;place-items:center;margin:10px auto;color:#fff}.rncl-orb{width:92px;height:92px;background:linear-gradient(145deg,#5f53dc,#8190ff);font-size:36px}.rncl-mic{width:98px;height:98px;background:linear-gradient(145deg,#5f53dc,#8190ff);font-size:38px}.rncl-mic.rec{background:linear-gradient(145deg,#ed4d72,#ff8099)}
      .rncl-phrase{font-size:23px;line-height:1.35;font-weight:850;margin:8px 0}.rncl-translation{font-size:14px;line-height:1.5;color:var(--muted,#aaa5b9);margin-top:8px}.rncl-chunk{margin-top:14px;padding:12px;border-radius:14px;background:var(--surface2,#242132);border-left:4px solid #8190ff}.rncl-chunk small{display:block;color:var(--muted,#aaa5b9);font-size:9px;font-weight:850;text-transform:uppercase;letter-spacing:.08em}.rncl-chunk b{display:block;margin-top:4px;font-size:16px}
      .rncl-btn{width:100%;min-height:46px;border-radius:13px;border:1px solid var(--line,#353145);background:var(--surface2,#242132);color:var(--ink,#f5f3fb);font-weight:850;margin-top:8px}.rncl-btn.primary{border:0;background:linear-gradient(135deg,#5f53dc,#8190ff);color:#fff}.rncl-btn.ghost{background:transparent;color:var(--muted,#aaa5b9)}.rncl-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.rncl-status{text-align:center;color:var(--muted,#aaa5b9);font-size:10px;font-weight:850;margin-top:8px}.rncl-tip{font-size:10px;line-height:1.5;color:var(--muted,#aaa5b9);background:var(--surface2,#242132);border-radius:12px;padding:10px;margin-top:10px}.rncl-hidden{display:none!important}
      @media(max-width:430px){.rncl-grid{grid-template-columns:1fr}.rncl-phrase{font-size:21px}}
    `;
    document.head.appendChild(s);
  }

  function shell(inner) {
    const pct = Math.round(((step + 1) / 5) * 100);
    return `<div class="rncl-wrap"><div class="rncl-top"><strong>Nova frase</strong><span>${step + 1}/5 · antes do SRS</span></div><div class="rncl-progress"><i style="width:${pct}%"></i></div>${inner}</div>`;
  }

  function recordArea(kind, instruction, showReplay = true) {
    const recNow = recorder && recorder.state === 'recording' && recordingStep === kind;
    return `<div class="rncl-card rncl-listen"><div class="rncl-kicker">Fale em voz alta</div><div class="rncl-title">${esc(instruction)}</div><button class="rncl-mic ${recNow ? 'rec' : ''}" data-record="${kind}">${recNow ? '■' : '🎙'}</button><div class="rncl-status">${recNow ? 'GRAVANDO… toque para parar' : 'Toque para gravar'}</div>${audioUrl && showReplay && !recNow ? '<button class="rncl-btn" data-replay>▶ Ouvir minha resposta</button>' : ''}</div>`;
  }

  function render() {
    if (!overlay || !activeCard) return;
    const chunk = recurringChunk(activeCard, activeDeck);
    const langName = activeDeck === 'de' ? 'alemão' : 'inglês';

    if (step === 0) {
      overlay.innerHTML = shell(`<div class="rncl-card"><div class="rncl-kicker">1 · Ouça antes de ler</div><div class="rncl-title">Tente captar a ideia geral</div><div class="rncl-sub">Não procure entender palavra por palavra. Primeiro crie familiaridade com o som.</div><div class="rncl-listen"><button class="rncl-orb" data-listen>🔊</button><div class="rncl-status">${plays ? `Ouvido ${plays}x` : 'Texto oculto'}</div></div><div class="rncl-tip">Ouça 2 vezes se a frase parecer difícil. O objetivo aqui é som → significado, não tradução palavra por palavra.</div><button class="rncl-btn primary" data-next ${plays < 1 ? 'disabled' : ''}>Já ouvi → ver e entender</button><button class="rncl-btn ghost" data-skip>Pular introdução desta frase</button></div>`);
    } else if (step === 1) {
      overlay.innerHTML = shell(`<div class="rncl-card"><div class="rncl-kicker">2 · Veja e entenda</div><div class="rncl-phrase">${esc(activeCard.front)}</div><div class="rncl-translation">${esc(activeCard.back)}</div><div class="rncl-chunk"><small>Trecho útil para reaproveitar</small><b>${esc(chunk)}</b></div><div class="rncl-tip">Não tente decorar a frase inteira como uma sequência de palavras. Guarde principalmente a estrutura e o trecho reutilizável.</div><div class="rncl-grid"><button class="rncl-btn" data-listen>🔊 Ouvir novamente</button><button class="rncl-btn primary" data-next>Entendi → repetir</button></div></div>`);
    } else if (step === 2) {
      overlay.innerHTML = shell(`<div class="rncl-card"><div class="rncl-kicker">3 · Repita</div><div class="rncl-phrase">${esc(activeCard.front)}</div><div class="rncl-chunk"><small>Trecho útil</small><b>${esc(chunk)}</b></div><div class="rncl-sub">Repita 2–3 vezes. Não precisa imitar o sotaque perfeitamente; faça a sequência ficar confortável para a boca.</div></div>${recordArea('repeat','Grave uma repetição da frase')}<div class="rncl-grid"><button class="rncl-btn" data-listen>🔊 Ouvir modelo</button><button class="rncl-btn primary" data-next>Próximo → falar sem olhar</button></div>`);
    } else if (step === 3) {
      overlay.innerHTML = shell(`<div class="rncl-card"><div class="rncl-kicker">4 · Reconstrua</div><div class="rncl-title">Fale a frase sem olhar o inglês</div><div class="rncl-translation">${esc(activeCard.back)}</div><div class="rncl-chunk"><small>Pista</small><b>${esc(chunk)}</b></div><div class="rncl-tip">Se travar, tente recuperar o trecho principal primeiro e complete o resto. Depois compare com a frase original.</div></div>${recordArea('rebuild',`Diga a frase em ${langName}`)}<button class="rncl-btn" data-reveal>Mostrar frase original</button><div id="rnclReveal" class="rncl-card rncl-hidden"><div class="rncl-phrase">${esc(activeCard.front)}</div></div><button class="rncl-btn primary" data-next>Próximo → criar variação</button>`);
    } else {
      overlay.innerHTML = shell(`<div class="rncl-card"><div class="rncl-kicker">5 · Faça uma variação</div><div class="rncl-title">Crie uma frase diferente usando o mesmo trecho</div><div class="rncl-chunk"><small>Reutilize</small><b>${esc(chunk)}</b></div><div class="rncl-tip">Troque uma informação: ferramenta, pessoa, tempo, lugar, contexto ou resultado. Não precisa ficar igual à frase original.</div></div>${recordArea('variation','Fale uma frase nova')}<div class="rncl-card"><div class="rncl-sub">Referência original</div><div class="rncl-phrase" style="font-size:16px">${esc(activeCard.front)}</div></div><button class="rncl-btn primary" data-finish>Entrar no SRS →</button>`);
    }

    bind();
  }

  function bind() {
    overlay.querySelectorAll('[data-listen]').forEach(b => b.onclick = speakTarget);
    const next = overlay.querySelector('[data-next]');
    if (next) next.onclick = () => { cleanupRecording(); step = Math.min(4, step + 1); render(); };
    const skip = overlay.querySelector('[data-skip]');
    if (skip) skip.onclick = () => finish(false);
    const finishBtn = overlay.querySelector('[data-finish]');
    if (finishBtn) finishBtn.onclick = () => finish(true);
    const replay = overlay.querySelector('[data-replay]');
    if (replay) replay.onclick = playRecording;
    const reveal = overlay.querySelector('[data-reveal]');
    if (reveal) reveal.onclick = () => overlay.querySelector('#rnclReveal')?.classList.toggle('rncl-hidden');
    overlay.querySelectorAll('[data-record]').forEach(b => b.onclick = async () => {
      if (recorder?.state === 'recording') {
        await stopRecord();
      } else {
        if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = ''; }
        try { await startRecord(b.dataset.record); }
        catch (err) {
          stopStream(true);
          recordingStep = '';
          alert(`Não foi possível abrir o microfone (${err?.name || 'erro'}). Você pode continuar o exercício falando sem gravar.`);
          render();
        }
      }
    });
  }

  function cleanupRecording() {
    if (recorder?.state === 'recording') {
      try { recorder.stop(); } catch {}
    }
    stopStream(true);
    recordingStep = '';
    if (audioUrl) { try { URL.revokeObjectURL(audioUrl); } catch {}; audioUrl = ''; }
  }

  function finish(saveCompletion) {
    cleanupRecording();
    try { speechSynthesis.cancel(); } catch {}
    if (saveCompletion && activeCard?.id) markCompleted(activeCard.id);
    if (activeCard?.id) runtimeSeen.add(activeCard.id);
    overlay?.remove();
    overlay = null;
    activeCard = null;
    step = 0;
    plays = 0;
  }

  function launch(item) {
    if (!item?.card) return;
    injectStyle();
    activeCard = item.card;
    activeDeck = core.selectedDeck?.() || 'en';
    step = 0;
    plays = 0;
    cleanupRecording();
    try { speechSynthesis.cancel(); } catch {}
    overlay?.remove();
    overlay = document.createElement('div');
    overlay.className = 'rncl';
    overlay.id = 'rnclOverlay';
    document.body.appendChild(overlay);
    render();
  }

  function maybeLaunch() {
    if (overlay) return;
    const review = document.getElementById('view-review');
    if (review && !review.classList.contains('active')) return;
    const item = core.current?.();
    if (!item?.card) return;
    const card = item.card;
    if (totalReps(card) !== 0) return;
    if (completed(card.id) || runtimeSeen.has(card.id)) return;
    launch(item);
  }

  const baseReview = core.getRenderReview?.();
  if (baseReview && core.setRenderReview) {
    core.setRenderReview(function(...args) {
      const out = baseReview.apply(this, args);
      setTimeout(maybeLaunch, 30);
      return out;
    });
  }

  window.recallNewCardLearning = {
    maybeLaunch,
    reset(cardId) {
      const data = loadStore();
      if (cardId) delete data.completed?.[cardId];
      else data.completed = {};
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
      runtimeSeen.clear();
    }
  };
})();