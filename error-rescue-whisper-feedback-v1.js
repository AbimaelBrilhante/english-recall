import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm';

(() => {
  'use strict';
  if (window.__errorRescueWhisperFeedbackV1) return;
  window.__errorRescueWhisperFeedbackV1 = true;

  const DB = 'recallSpeakingLabBetaV1';
  const STORE = 'attempts';
  const CONTENT = './speaking-lab/error-rescue-v1.json';
  const MODEL = 'onnx-community/whisper-tiny.en';
  let transcriberPromise = null;
  let lastAttemptId = '';
  let queued = false;
  let contentPromise = null;

  try {
    env.allowLocalModels = false;
    env.useBrowserCache = true;
  } catch {}

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = s => String(s || '')
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  function db() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, {keyPath:'id'});
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  async function allAttempts() {
    const d = await db();
    const rows = await new Promise((resolve, reject) => {
      const t = d.transaction(STORE, 'readonly');
      const r = t.objectStore(STORE).getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
    d.close();
    return rows;
  }

  async function updateAttempt(row) {
    const d = await db();
    await new Promise((resolve, reject) => {
      const t = d.transaction(STORE, 'readwrite');
      t.objectStore(STORE).put(row);
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
    });
    d.close();
  }

  async function latestAttempt() {
    const rows = (await allAttempts())
      .filter(r => r.mode === 'error-rescue')
      .sort((a,b) => Number(b.ts || 0) - Number(a.ts || 0));
    return rows[0] || null;
  }

  async function content() {
    if (!contentPromise) contentPromise = fetch(CONTENT + '?v=whisper1', {cache:'no-store'}).then(r => r.json());
    return contentPromise;
  }

  async function contextFor(a) {
    const j = await content();
    const pattern = (j.patterns || []).find(p => p.id === a.patternId) || null;
    const exercise = pattern?.exercises?.find(e => e.id === a.exerciseId) || null;
    return {pattern, exercise};
  }

  function injectStyle() {
    if (document.getElementById('erwfStyle')) return;
    const s = document.createElement('style');
    s.id = 'erwfStyle';
    s.textContent = `
      .erwf{background:var(--surface,#fff);border:1px solid var(--line,#e3e2ec);border-radius:22px;padding:16px;margin:12px 0}.erwf-head{display:flex;align-items:center;gap:8px}.erwf-head b{font-size:16px}.erwf-local{margin-left:auto;font-size:8px;font-weight:900;color:var(--primary2,#5748cc);background:var(--surface2,#f1f0f8);padding:5px 7px;border-radius:999px}.erwf-note{font-size:9.5px;line-height:1.5;color:var(--muted,#77778a);margin-top:9px}.erwf-btn{width:100%;min-height:44px;border:1px solid var(--line,#e3e2ec);border-radius:12px;background:linear-gradient(135deg,#5f53dc,#8190ff);color:#fff;font-weight:850;margin-top:12px}.erwf-btn.secondary{background:var(--surface2,#f1f0f8);color:var(--ink,#1d1d29)}.erwf-status{margin-top:10px;background:var(--surface2,#f1f0f8);border-radius:11px;padding:10px;font-size:10px;line-height:1.5;color:var(--muted,#77778a)}.erwf-progress{height:6px;background:var(--surface2,#f1f0f8);border-radius:999px;overflow:hidden;margin-top:8px}.erwf-progress>div{height:100%;background:linear-gradient(90deg,#5f53dc,#8190ff);width:0}.erwf-label{display:block;margin-top:12px;margin-bottom:5px;font-size:8.5px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;color:var(--muted,#77778a)}.erwf-text{width:100%;min-height:86px;border:1px solid var(--line,#e3e2ec);border-radius:11px;background:var(--surface2,#f1f0f8);color:var(--ink,#1d1d29);padding:10px;font:inherit;font-size:11px;line-height:1.5;resize:vertical}.erwf-issue{background:#fff4e5;border:1px solid #f5d39a;border-radius:11px;padding:10px;margin-top:7px}.erwf-issue b{font-size:10px}.erwf-issue div{font-size:10px;line-height:1.45;margin-top:3px}.erwf-ok{background:#ecfdf3;border:1px solid #a7e0bd;border-radius:11px;padding:10px;margin-top:8px;font-size:10px;line-height:1.45}.erwf-ref{background:var(--surface2,#f1f0f8);border-radius:11px;padding:10px;font-size:11px;line-height:1.5}.erwf-warn{color:#b42318}.erwf-small{font-size:8.8px;color:var(--muted,#77778a);line-height:1.45;margin-top:8px}@media(prefers-color-scheme:dark){.erwf-issue{background:#332719;border-color:#70552e}.erwf-ok{background:#143326;border-color:#2b6a4a}}
    `;
    document.head.appendChild(s);
  }

  function doneHost() {
    const ok = [...document.querySelectorAll('.ok')].find(x => /Resposta salva/i.test(x.textContent || ''));
    return ok?.closest('.card') || null;
  }

  function setStatus(text, progress = null, danger = false) {
    const status = document.getElementById('erwfStatus');
    const bar = document.getElementById('erwfBar');
    if (status) {
      status.textContent = text;
      status.classList.toggle('erwf-warn', !!danger);
    }
    if (bar && progress != null && Number.isFinite(progress)) {
      bar.style.width = Math.max(0, Math.min(100, progress)) + '%';
    }
  }

  function progressLabel(p) {
    if (!p) return 'Preparando modelo local…';
    if (p.status === 'progress') {
      const pct = Number(p.progress);
      const file = p.file ? String(p.file).split('/').pop() : 'modelo';
      return `${Number.isFinite(pct) ? Math.round(pct) + '% · ' : ''}${file}`;
    }
    if (p.status === 'ready') return 'Modelo local pronto.';
    if (p.status === 'done') return 'Arquivo do modelo carregado.';
    return p.status ? String(p.status) : 'Preparando modelo local…';
  }

  async function getTranscriber() {
    if (!transcriberPromise) {
      transcriberPromise = pipeline('automatic-speech-recognition', MODEL, {
        dtype: 'q8',
        progress_callback: p => {
          const pct = p?.status === 'progress' ? Number(p.progress) : null;
          setStatus(progressLabel(p), pct);
        }
      }).catch(err => {
        transcriberPromise = null;
        throw err;
      });
    }
    return transcriberPromise;
  }

  async function decodeTo16k(blob) {
    const AC = window.AudioContext || window.webkitAudioContext;
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!AC || !OAC) throw new Error('Web Audio não está disponível neste navegador.');
    const ac = new AC();
    const arr = await blob.arrayBuffer();
    const decoded = await ac.decodeAudioData(arr.slice(0));
    try { await ac.close(); } catch {}
    const length = Math.max(1, Math.ceil(decoded.duration * 16000));
    const offline = new OAC(1, length, 16000);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    return new Float32Array(rendered.getChannelData(0));
  }

  function issue(title, detail) { return {title, detail}; }
  function word(text, w) { return new RegExp(`\\b${w}\\b`, 'i').test(text); }

  function analyze(patternId, raw, model) {
    const t = norm(raw);
    const m = norm(model);
    const issues = [];
    let targetSeen = true;

    if (patternId === 'responsible-be') {
      targetSeen = word(t, 'responsible');
      const ok = /\b(?:am|is|are|i'm|he's|she's|we're|they're|you're)\s+responsible\b/.test(t);
      if (targetSeen && !ok) issues.push(issue('Falta o verbo “to be” antes de responsible', 'Use am/is/are de acordo com o sujeito: “I’m responsible…”, “She is responsible…”.'));
    }

    if (patternId === 'information-uncountable') {
      targetSeen = /\binformation(?:s)?\b/.test(t);
      if (/\binformations\b/.test(t)) issues.push(issue('“Informations” não é usado', 'Information é incontável. Use “information”, “some information” ou “a lot of information”.'));
    }

    if (patternId === 'data-usage') {
      targetSeen = /\bdata(?:s)?\b/.test(t);
      if (/\bdatas\b/.test(t)) issues.push(issue('Evite “datas”', 'Em inglês profissional, use “data” sem acrescentar -s.'));
    }

    if (patternId === 'to-infinitive') {
      const wrongAfterTo = t.match(/\bto\s+([a-z]+(?:ing|ed))\b/);
      const wrongFor = t.match(/\bfor\s+(validate|save|check|review|reduce|monitor|clarify|ensure|detect|identify|improve|automate)\b/);
      targetSeen = /\bto\s+[a-z]+\b/.test(t) || !!wrongAfterTo || !!wrongFor;
      if (wrongAfterTo) issues.push(issue('Depois de “to”, use o verbo na forma base', `Você parece ter usado “to ${wrongAfterTo[1]}”. Prefira “to + verbo”, como “to validate” ou “to save”.`));
      if (wrongFor) issues.push(issue('Para indicar finalidade, aqui prefira “to + verbo”', `“for ${wrongFor[1]}” soa inadequado neste padrão. Use “to ${wrongFor[1]}”.`));
    }

    if (patternId === 'responsible-for-gerund') {
      targetSeen = word(t, 'responsible');
      if (/\bresponsible\s+to\b/.test(t)) issues.push(issue('Use “responsible for”, não “responsible to”', 'Depois de responsible, use “for” para introduzir responsabilidade.'));
      const base = t.match(/\bresponsible\s+for\s+(check|validate|review|monitor|manage|create|maintain|investigate|compare|prepare)\b/);
      if (base) issues.push(issue('Depois de “responsible for”, o verbo vai em -ing', `Troque “responsible for ${base[1]}” por “responsible for ${base[1]}ing” (com a grafia correta do verbo).`));
    }

    if (patternId === 'past-tense') {
      const pairs = [['validate','validated'],['find','found'],['develop','developed'],['test','tested'],['review','reviewed'],['talk','talked'],['lead','led'],['choose','chose'],['create','created'],['check','checked']];
      let checked = 0;
      for (const [base,past] of pairs) {
        if (word(m, past)) {
          checked++;
          if (word(t, base) && !word(t, past)) issues.push(issue(`O verbo “${base}” deveria estar no passado`, `Neste exercício, a referência usa “${past}”.`));
        }
      }
      targetSeen = checked > 0;
    }

    if (patternId === 'present-perfect-since') {
      targetSeen = /\b(?:since|for)\b/.test(t);
      const hasPerfect = /\b(?:have|has)(?:\s+been)?\s+[a-z]+(?:ing|ed|en)?\b/.test(t);
      if (targetSeen && !hasPerfect) issues.push(issue('Com since/for para algo que continua agora, faltou present perfect', 'Tente “have/has been + -ing” ou outra forma adequada de present perfect.'));
    }

    if (patternId === 'third-person-s') {
      const pairs = [['solve','solves'],['show','shows'],['reduce','reduces']];
      let checked = 0;
      for (const [base,third] of pairs) {
        if (word(m, third)) {
          checked++;
          if (word(t, base) && !word(t, third)) issues.push(issue(`Com he/she/it, “${base}” precisa de -s`, `A referência usa “${third}”.`));
        }
      }
      targetSeen = checked > 0;
    }

    if (patternId === 'be-to-infinitive') {
      targetSeen = /\b(?:role|goal|responsibility)\s+is\b/.test(t);
      const bad = t.match(/\b(role|goal|responsibility)\s+is\s+(?!to\b)([a-z]+)/);
      if (bad) issues.push(issue('Depois de “is”, faltou “to” antes do verbo', `Neste padrão, use “my ${bad[1]} is to + verbo”.`));
    }

    if (patternId === 'impact-conclusion') {
      const markers = /\b(as a result|resulted|helped|reduced|improved|increased|decreased|faster|less|more|allowed|enabled|this made|this helped|so that)\b/;
      targetSeen = t.split(/\s+/).filter(Boolean).length >= 4;
      if (targetSeen && !markers.test(t)) issues.push(issue('Não encontrei um impacto claro no final', 'Tente fechar dizendo o que mudou: menos trabalho manual, mais velocidade, mais confiança, menos erros, etc.'));
    }

    return {issues, targetSeen};
  }

  function renderAnalysis(transcript, ctx) {
    const result = analyze(ctx.pattern?.id || '', transcript, ctx.exercise?.model || '');
    const target = document.getElementById('erwfAnalysis');
    if (!target) return;
    let html = '';
    if (result.issues.length) {
      html += `<span class="erwf-label">Possíveis problemas encontrados</span>`;
      html += result.issues.map(x => `<div class="erwf-issue"><b>${esc(x.title)}</b><div>${esc(x.detail)}</div></div>`).join('');
    } else if (result.targetSeen) {
      html += `<div class="erwf-ok"><b>Não detectei o erro-alvo automaticamente nesta transcrição.</b><br>Isso não significa que toda a frase esteja correta; significa apenas que a regra deste exercício não disparou um alerta.</div>`;
    } else {
      html += `<div class="erwf-status">Não consegui confirmar o padrão-alvo na transcrição. O Whisper pode ter ouvido algo diferente ou sua resposta pode ter usado outra estrutura.</div>`;
    }
    html += `<span class="erwf-label">Referência</span><div class="erwf-ref">${esc(ctx.exercise?.model || '')}</div>`;
    html += `<div class="erwf-small">A análise é baseada na transcrição e no padrão deste exercício. Ela pode errar se a transcrição estiver incorreta e não avalia pronúncia.</div>`;
    target.innerHTML = html;
  }

  async function transcribe(attempt, ctx) {
    const btn = document.getElementById('erwfRun');
    if (btn) btn.disabled = true;
    try {
      setStatus('Preparando áudio…', 0);
      const audio = await decodeTo16k(attempt.blob);
      setStatus('Carregando Whisper local… Na primeira vez, o download do modelo pode demorar.', 2);
      const transcriber = await getTranscriber();
      setStatus('Transcrevendo no seu aparelho…', 100);
      const out = await transcriber(audio);
      const text = String(out?.text || '').trim();
      if (!text) throw new Error('O Whisper não retornou texto para esta gravação.');
      const box = document.getElementById('erwfTranscript');
      if (box) box.value = text;
      attempt.localTranscript = text;
      attempt.localTranscriptModel = MODEL;
      attempt.localTranscriptTs = Date.now();
      await updateAttempt(attempt);
      setStatus('Transcrição concluída.', 100);
      renderAnalysis(text, ctx);
      const editNote = document.getElementById('erwfEditNote');
      if (editNote) editNote.hidden = false;
      const re = document.getElementById('erwfReanalyze');
      if (re) re.hidden = false;
    } catch (err) {
      console.error('[Error Rescue Whisper]', err);
      setStatus(`Não consegui transcrever: ${err?.message || err}`, null, true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function mount() {
    const host = doneHost();
    if (!host) return;
    const attempt = await latestAttempt();
    if (!attempt?.blob) return;
    if (attempt.id === lastAttemptId && document.getElementById('erwfCard')) return;
    lastAttemptId = attempt.id;
    const ctx = await contextFor(attempt);
    injectStyle();
    document.getElementById('erwfCard')?.remove();
    const card = document.createElement('section');
    card.id = 'erwfCard';
    card.className = 'erwf';
    card.innerHTML = `
      <div class="erwf-head"><b>Feedback da sua fala</b><span class="erwf-local">WHISPER LOCAL</span></div>
      <div class="erwf-note">Primeiro transcrevemos a gravação. Depois analisamos apenas o padrão treinado neste exercício. Seu áudio não é enviado para uma API de transcrição.</div>
      <button class="erwf-btn" id="erwfRun">Transcrever e analisar</button>
      <div class="erwf-progress"><div id="erwfBar"></div></div>
      <div class="erwf-status" id="erwfStatus">Pronto para transcrever. Na primeira utilização, o navegador precisa baixar o modelo do Whisper.</div>
      <span class="erwf-label">Transcrição</span>
      <textarea class="erwf-text" id="erwfTranscript" placeholder="A transcrição aparecerá aqui depois do processamento local."></textarea>
      <div class="erwf-small" id="erwfEditNote" hidden>Se alguma palavra estiver errada, corrija a transcrição antes de reanalisar. Isso evita feedback baseado em um erro do Whisper.</div>
      <button class="erwf-btn secondary" id="erwfReanalyze" hidden>Reanalisar esta transcrição</button>
      <div id="erwfAnalysis"></div>
    `;
    host.insertAdjacentElement('afterend', card);
    document.getElementById('erwfRun').onclick = () => transcribe(attempt, ctx);
    document.getElementById('erwfReanalyze').onclick = () => {
      const text = document.getElementById('erwfTranscript')?.value?.trim() || '';
      if (!text) return;
      renderAnalysis(text, ctx);
    };
  }

  function schedule() {
    if (queued) return;
    queued = true;
    setTimeout(async () => {
      queued = false;
      try { await mount(); } catch (e) { console.warn('[Error Rescue Whisper mount]', e); }
    }, 100);
  }

  const obs = new MutationObserver(schedule);
  function start() {
    obs.observe(document.body, {childList:true, subtree:true, characterData:true});
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
