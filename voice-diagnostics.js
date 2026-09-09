(() => {
'use strict';

const ADDON_ID = 'recallVoiceDiagnostics';
let detectedVoices = [];
let lastUpdated = 0;

function voiceOptions(deckId) {
  const prefix = deckId === 'de' ? 'de' : 'en';
  return detectedVoices.filter(v => (v.lang || '').toLowerCase().startsWith(prefix));
}

function addStyles() {
  if (document.getElementById(`${ADDON_ID}Style`)) return;
  const style = document.createElement('style');
  style.id = `${ADDON_ID}Style`;
  style.textContent = `
    .voice-diag-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    .voice-diag-summary{margin-top:12px;background:var(--surface2);border-radius:14px;padding:12px}
    .voice-diag-summary strong{display:block;font-size:13px;margin-bottom:4px}
    .voice-diag-summary span{font-size:12px;color:var(--muted);line-height:1.45}
    .voice-diag-list{display:grid;gap:8px;margin-top:10px}
    .voice-diag-item{border:1px solid var(--line);border-radius:14px;padding:11px;background:var(--surface)}
    .voice-diag-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
    .voice-diag-name{font-weight:800;font-size:13px;line-height:1.25}
    .voice-diag-lang{font-size:11px;color:var(--muted);white-space:nowrap}
    .voice-diag-meta{font-size:11px;color:var(--muted);line-height:1.45;margin-top:6px;word-break:break-all;white-space:pre-line}
    .voice-diag-item button{margin-top:8px;min-height:36px;border:1px solid var(--line);border-radius:10px;background:var(--surface2);color:var(--primary);font-weight:800;padding:0 10px}
    .voice-diag-empty{padding:14px;border:1px dashed var(--line);border-radius:14px;color:var(--muted);font-size:12px;text-align:center;margin-top:10px}
  `;
  document.head.appendChild(style);
}

function readVoices() {
  if (!('speechSynthesis' in window)) {
    detectedVoices = [];
    return detectedVoices;
  }
  detectedVoices = window.speechSynthesis.getVoices() || [];
  lastUpdated = Date.now();
  return detectedVoices;
}

function notifyRecallVoiceList() {
  try {
    const handler = window.speechSynthesis && window.speechSynthesis.onvoiceschanged;
    if (typeof handler === 'function') handler.call(window.speechSynthesis, new Event('voiceschanged'));
  } catch (_) {}
}

function speakWithVoice(voiceURI, deckId) {
  if (!('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices() || [];
  const voice = voices.find(v => v.voiceURI === voiceURI);
  const utterance = new SpeechSynthesisUtterance(deckId === 'de' ? 'Hallo! Wie geht es dir?' : 'Hello! How are you today?');
  utterance.lang = deckId === 'de' ? 'de-DE' : 'en-US';
  const speed = Number(document.getElementById('settingsSpeed')?.value || 1);
  utterance.rate = speed;
  utterance.pitch = 1;
  if (voice) utterance.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function renderDiagnostics() {
  const counts = document.getElementById('voiceDiagCounts');
  const updated = document.getElementById('voiceDiagUpdated');
  const list = document.getElementById('voiceDiagList');
  if (!counts || !updated || !list) return;

  if (!('speechSynthesis' in window)) {
    counts.textContent = 'Speech Synthesis não está disponível neste navegador.';
    updated.textContent = '';
    list.innerHTML = '';
    return;
  }

  const deckId = document.getElementById('settingsDeck')?.value || 'en';
  const enCount = voiceOptions('en').length;
  const deCount = voiceOptions('de').length;
  const filtered = voiceOptions(deckId);

  counts.textContent = `English: ${enCount} · Deutsch: ${deCount} · Total do navegador: ${detectedVoices.length}`;
  updated.textContent = lastUpdated
    ? `Última leitura: ${new Date(lastUpdated).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}. Esta é exatamente a lista que o navegador entrega ao Recall.`
    : 'Aguardando leitura das vozes.';

  list.innerHTML = '';
  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'voice-diag-empty';
    empty.textContent = `Nenhuma voz ${deckId === 'de' ? 'alemã' : 'inglesa'} foi exposta por este navegador.`;
    list.appendChild(empty);
    return;
  }

  filtered.forEach(voice => {
    const row = document.createElement('div');
    row.className = 'voice-diag-item';

    const head = document.createElement('div');
    head.className = 'voice-diag-head';
    const name = document.createElement('div');
    name.className = 'voice-diag-name';
    name.textContent = `${voice.name}${voice.default ? ' · default' : ''}`;
    const lang = document.createElement('div');
    lang.className = 'voice-diag-lang';
    lang.textContent = voice.lang || '—';
    head.append(name, lang);

    const meta = document.createElement('div');
    meta.className = 'voice-diag-meta';
    meta.textContent = `localService: ${String(Boolean(voice.localService))}\nvoiceURI: ${voice.voiceURI || '—'}`;

    const test = document.createElement('button');
    test.type = 'button';
    test.textContent = '▶ Testar esta voz';
    test.addEventListener('click', () => speakWithVoice(voice.voiceURI, deckId));

    row.append(head, meta, test);
    list.appendChild(row);
  });
}

function refreshVoices() {
  const button = document.getElementById('refreshVoices');
  const original = button?.textContent || '↻ Atualizar vozes';
  if (button) {
    button.disabled = true;
    button.textContent = 'Atualizando...';
  }

  readVoices();
  notifyRecallVoiceList();
  renderDiagnostics();

  [250, 900].forEach((delay, index) => {
    setTimeout(() => {
      readVoices();
      notifyRecallVoiceList();
      renderDiagnostics();
      if (index === 1 && button) {
        button.disabled = false;
        button.textContent = original;
      }
    }, delay);
  });
}

function ensureUI() {
  if (document.getElementById(ADDON_ID)) return true;
  const testVoice = document.getElementById('testVoice');
  if (!testVoice) return false;

  addStyles();
  const audioSection = testVoice.closest('.section');
  if (!audioSection) return false;

  const wrapper = document.createElement('div');
  wrapper.id = ADDON_ID;

  const toolbar = document.createElement('div');
  toolbar.className = 'voice-diag-toolbar';
  const refresh = document.createElement('button');
  refresh.id = 'refreshVoices';
  refresh.type = 'button';
  refresh.className = 'secondary-btn';
  refresh.textContent = '↻ Atualizar vozes';
  refresh.addEventListener('click', refreshVoices);
  toolbar.appendChild(refresh);

  const summary = document.createElement('div');
  summary.className = 'voice-diag-summary';
  const title = document.createElement('strong');
  title.textContent = 'Diagnóstico de vozes do navegador';
  const counts = document.createElement('span');
  counts.id = 'voiceDiagCounts';
  counts.textContent = 'Carregando vozes...';
  const br = document.createElement('br');
  const updated = document.createElement('span');
  updated.id = 'voiceDiagUpdated';
  summary.append(title, counts, br, updated);

  const list = document.createElement('div');
  list.id = 'voiceDiagList';
  list.className = 'voice-diag-list';

  wrapper.append(toolbar, summary, list);
  audioSection.appendChild(wrapper);

  document.getElementById('settingsDeck')?.addEventListener('change', () => {
    readVoices();
    renderDiagnostics();
  });

  if ('speechSynthesis' in window) {
    window.speechSynthesis.addEventListener?.('voiceschanged', () => {
      readVoices();
      renderDiagnostics();
    });
  }

  readVoices();
  renderDiagnostics();
  setTimeout(() => { readVoices(); renderDiagnostics(); }, 350);
  return true;
}

function init() {
  if (ensureUI()) return;
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (ensureUI() || attempts > 20) clearInterval(timer);
  }, 150);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
else init();
})();
