(() => {
'use strict';
if (window.__speakingLabFeedbackV1) return;
window.__speakingLabFeedbackV1 = true;

const MODE = window.__slFeedbackMode || (() => {
  const p = location.pathname;
  if (p.endsWith('/60-second.html')) return '60-second';
  if (p.endsWith('/error-rescue.html')) return 'error-rescue';
  return 'sentence-builder';
})();
const DB = 'recallSpeakingLabBetaV1';
const STORE = 'attempts';
const SESSION_STARTED = Date.now() - 5000;
const cache = {};
let queued = false;
let lastAttemptId = '';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const SB = {
  pt_to_en: {label:'Produção', objective:'Construir a ideia em inglês sem traduzir palavra por palavra.', avoid:'Montar a frase seguindo exatamente a ordem do português.'},
  past_tense: {label:'Passado', objective:'Manter o evento terminado no passado.', avoid:'Começar no passado e voltar para o presente no meio da frase.'},
  grammar_fix: {label:'Gramática', objective:'Corrigir a estrutura da frase, não apenas trocar vocabulário.', avoid:'Corrigir uma palavra e manter a estrutura principal errada.'},
  purpose: {label:'Finalidade', objective:'Ligar a ação ao propósito ou resultado, normalmente com to + verbo.', avoid:'Explicar a ação e esquecer por que ela foi feita.'},
  professionalize: {label:'Profissionalizar', objective:'Trocar linguagem genérica por verbos mais claros e resultado profissional.', avoid:'Usar frases vagas como “I did”, “I made” ou “I fixed” sem explicar o que mudou.'},
  combine: {label:'Combinar ideias', objective:'Conectar duas ideias mostrando claramente a relação entre elas.', avoid:'Juntar frases sem indicar contraste, causa, sequência ou condição.'},
  to_verb: {label:'to + verbo', objective:'Depois de to, usar o verbo na forma base.', avoid:'Usar -ing ou passado imediatamente depois de to.'},
  impact: {label:'Impacto', objective:'Fechar a resposta mostrando resultado ou impacto para o negócio.', avoid:'Parar depois de dizer o que você fez e não dizer o que mudou.'}
};

const ER_AVOID = {
  'responsible-be':'Dizer “I responsible...” sem am/is/are.',
  'information-uncountable':'Usar “informations”. Information não recebe plural com -s.',
  'data-usage':'Usar “datas”. Em inglês profissional, normalmente usamos data sem -s.',
  'to-infinitive':'Usar “for validate” ou colocar outra forma verbal depois de to.',
  'responsible-for-gerund':'Usar “responsible to check” em vez de “responsible for checking”.',
  'past-tense':'Misturar presente e passado ao contar um evento já terminado.',
  'present-perfect-since':'Usar simple present com since/for para algo que começou no passado e continua agora.',
  'third-person-s':'Esquecer o -s do verbo com he/she/it no present simple.',
  'be-to-infinitive':'Dizer “My role is validate...” sem to.',
  'impact-conclusion':'Encerrar a resposta na ação e não mostrar o resultado ou impacto.'
};

const CAT_AVOID = {
  'Entrevista':'Responder de forma genérica e não mostrar valor ou resultado.',
  'Projeto':'Gastar muito tempo no contexto e pouco na sua ação e no resultado.',
  'SQL':'Listar comandos ou ferramentas sem explicar como você valida o resultado.',
  'Desafio':'Dar a solução sem explicar como você chegou à decisão.',
  'Decisão técnica':'Escolher uma opção sem mencionar critérios, risco ou trade-off.',
  'Stakeholders':'Focar só na parte técnica e esquecer alinhamento e decisão do negócio.',
  'Comunicação':'Explicar detalhes técnicos antes de deixar claro o impacto para o negócio.',
  'Qualidade de dados':'Falar da correção sem explicar como encontrou a causa e validou a solução.',
  'BI / Dashboard':'Falar só do layout e não da decisão ou necessidade do usuário.',
  'Automação':'Falar da automação sem dizer o que mudou depois.',
  'Governança':'Falar apenas de controles sem citar definição, dono ou rastreabilidade.',
  'Comportamental':'Contar a situação sem fechar com aprendizado ou mudança de comportamento.',
  'Trabalho em equipe':'Descrever sua parte sem explicar colaboração e alinhamento.',
  'Aprendizado':'Listar recursos de estudo sem mostrar como você pratica e aplica.'
};

function openDb() {
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
  const db = await openDb();
  const rows = await new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const r = t.objectStore(STORE).getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
  db.close();
  return rows;
}

async function getJson(path) {
  if (!cache[path]) cache[path] = fetch(path + '?v=feedback1', {cache:'no-store'}).then(r => r.json());
  return cache[path];
}

async function contextFor(a) {
  if (a.mode === 'sentence-builder') {
    const files = [
      './speaking-lab/sentence-builder-curated-v1.json',
      './speaking-lab/sentence-builder-deck-v1.json',
      './speaking-lab/sentence-builder-errors-v1.json'
    ];
    const lists = await Promise.all(files.map(getJson));
    const x = lists.flatMap(j => j.exercises || []).find(x => x.id === a.exerciseId) || null;
    return {exercise:x};
  }
  if (a.mode === '60-second') {
    const files = ['./speaking-lab/60-second-curated-v2.json','./speaking-lab/60-second-professional-v2.json'];
    const lists = await Promise.all(files.map(getJson));
    const topic = lists.flatMap(j => j.topics || []).find(x => x.id === a.topicId) || null;
    return {topic};
  }
  const j = await getJson('./speaking-lab/error-rescue-v1.json');
  const pattern = (j.patterns || []).find(p => p.id === a.patternId) || null;
  const exercise = pattern?.exercises?.find(e => e.id === a.exerciseId) || null;
  return {pattern, exercise};
}

function infoFor(a, ctx) {
  if (a.mode === 'sentence-builder') {
    const x = ctx.exercise || {};
    const rule = SB[x.t] || {label:x.t || 'Estrutura', objective:'Construir uma resposta clara usando a estrutura pedida.', avoid:'Tentar decorar apenas a frase-modelo.'};
    return {
      title:`Feedback · ${rule.label}`,
      objective:rule.objective,
      points:Array.isArray(x.f) && x.f.length ? x.f : [],
      avoid:rule.avoid,
      model:x.m || '',
      groupKey:x.t || 'outro',
      groupLabel:rule.label
    };
  }
  if (a.mode === '60-second') {
    const x = ctx.topic || {};
    return {
      title:'Feedback · 60-Second',
      objective:'Sustentar uma resposta organizada e chegar a uma conclusão clara.',
      points:Array.isArray(x.anchors) ? x.anchors : [],
      avoid:CAT_AVOID[x.category] || 'Ficar muito tempo no contexto e não chegar à sua ação e ao resultado.',
      model:x.model || '',
      groupKey:x.category || 'outro',
      groupLabel:x.category || 'Tema geral'
    };
  }
  const p = ctx.pattern || {};
  return {
    title:`Feedback · ${p.label || 'Error Rescue'}`,
    objective:p.note || 'Reaplicar corretamente o padrão treinado.',
    points:[],
    avoid:ER_AVOID[a.patternId] || 'Repetir o padrão de erro que este exercício está treinando.',
    model:ctx.exercise?.model || '',
    groupKey:a.patternId || 'outro',
    groupLabel:p.label || 'Padrão'
  };
}

function ratingName(v) {
  return v === 'stuck' ? 'Travei' : v === 'effort' ? 'Com esforço' : v === 'natural' ? 'Natural' : 'Ainda não marcada';
}

async function groupLabelFor(row) {
  if (row.mode === 'sentence-builder') return SB[row.type]?.label || row.type || 'Estrutura';
  if (row.mode === '60-second') return row.category || 'Tema geral';
  const j = await getJson('./speaking-lab/error-rescue-v1.json');
  return (j.patterns || []).find(p => p.id === row.patternId)?.label || row.patternId || 'Padrão';
}

async function sessionSummary() {
  const rows = (await allAttempts()).filter(r => r.mode === MODE && Number(r.ts || 0) >= SESSION_STARTED);
  const rated = rows.filter(r => r.selfRating);
  const counts = {
    stuck:rated.filter(r => r.selfRating === 'stuck').length,
    effort:rated.filter(r => r.selfRating === 'effort').length,
    natural:rated.filter(r => r.selfRating === 'natural').length
  };
  const scores = new Map();
  const labels = new Map();
  for (const r of rated) {
    const key = MODE === 'sentence-builder' ? (r.type || 'outro') : MODE === '60-second' ? (r.category || 'outro') : (r.patternId || 'outro');
    const score = r.selfRating === 'stuck' ? 2 : r.selfRating === 'effort' ? 1 : 0;
    scores.set(key, (scores.get(key) || 0) + score);
    if (!labels.has(key)) labels.set(key, await groupLabelFor(r));
  }
  const weak = [...scores.entries()].sort((a,b) => b[1] - a[1])[0];
  return {total:rows.length, rated:rated.length, ...counts, priority:weak && weak[1] > 0 ? labels.get(weak[0]) : ''};
}

function injectStyle() {
  if (document.getElementById('slfbStyle')) return;
  const s = document.createElement('style');
  s.id = 'slfbStyle';
  s.textContent = `
    .slfb{background:var(--surface,#fff);border:1px solid var(--line,#e3e2ec);border-radius:22px;padding:16px;margin:12px 0}.slfb-head{display:flex;align-items:center;gap:8px}.slfb-head b{font-size:16px}.slfb-free{margin-left:auto;font-size:8px;font-weight:900;color:var(--primary2,#5748cc);background:var(--surface2,#f1f0f8);padding:5px 7px;border-radius:999px}.slfb-row{margin-top:12px}.slfb-row small{display:block;font-size:8.5px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;color:var(--muted,#77778a);margin-bottom:4px}.slfb-row div{font-size:11px;line-height:1.5}.slfb-points{margin:0;padding-left:18px;font-size:11px;line-height:1.55}.slfb-avoid{padding:10px;border-radius:11px;background:var(--surface2,#f1f0f8)}.slfb-model{display:none;margin-top:8px;padding:10px;border-radius:11px;background:var(--surface2,#f1f0f8);font-size:11px;line-height:1.5}.slfb-model.open{display:block}.slfb-btn{width:100%;min-height:40px;margin-top:8px;border:1px solid var(--line,#e3e2ec);background:var(--surface2,#f1f0f8);color:var(--ink,#1d1d29);border-radius:11px;font-weight:850}.slfb-summary{margin-top:12px;padding-top:12px;border-top:1px solid var(--line,#e3e2ec)}.slfb-counts{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:7px}.slfb-count{background:var(--surface2,#f1f0f8);border-radius:10px;padding:8px;text-align:center}.slfb-count b{display:block;font-size:16px}.slfb-count span{font-size:8px;color:var(--muted,#77778a)}.slfb-priority{font-size:10px;line-height:1.45;color:var(--muted,#77778a);margin-top:8px}`;
  document.head.appendChild(s);
}

function savedHost() {
  const ok = [...document.querySelectorAll('.ok')].find(x => /Resposta salva/i.test(x.textContent || ''));
  return ok?.closest('.card') || null;
}

async function latestAttempt() {
  const rows = (await allAttempts()).filter(r => r.mode === MODE).sort((a,b) => Number(b.ts||0) - Number(a.ts||0));
  return rows[0] || null;
}

async function renderFeedback() {
  const host = savedHost();
  if (!host) return;
  const attempt = await latestAttempt();
  if (!attempt) return;
  const ctx = await contextFor(attempt);
  const info = infoFor(attempt, ctx);
  const summary = await sessionSummary();
  injectStyle();

  let box = document.getElementById('slfbCard');
  if (!box) {
    box = document.createElement('section');
    box.id = 'slfbCard';
    box.className = 'slfb';
    host.insertAdjacentElement('afterend', box);
  }
  lastAttemptId = attempt.id;
  const points = info.points.length ? `<div class="slfb-row"><small>Pontos que a resposta deveria cobrir</small><ul class="slfb-points">${info.points.map(p=>`<li>${esc(p)}</li>`).join('')}</ul></div>` : '';
  box.innerHTML = `
    <div class="slfb-head"><b>${esc(info.title)}</b><span class="slfb-free">SEM IA</span></div>
    <div class="slfb-row"><small>Objetivo</small><div>${esc(info.objective)}</div></div>
    ${points}
    <div class="slfb-row"><small>Evite</small><div class="slfb-avoid">${esc(info.avoid)}</div></div>
    ${info.model ? `<button class="slfb-btn" id="slfbModelBtn">Ver resposta-modelo</button><div class="slfb-model" id="slfbModel">${esc(info.model)}</div>` : ''}
    <div class="slfb-row"><small>Sua autoavaliação</small><div>${esc(ratingName(attempt.selfRating))}</div></div>
    <div class="slfb-summary"><small style="font-size:8.5px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;color:var(--muted,#77778a)">Resumo desta sessão</small>
      <div class="slfb-counts"><div class="slfb-count"><b>${summary.stuck}</b><span>Travei</span></div><div class="slfb-count"><b>${summary.effort}</b><span>Com esforço</span></div><div class="slfb-count"><b>${summary.natural}</b><span>Natural</span></div></div>
      <div class="slfb-priority">${summary.rated === 0 ? 'Marque como saiu para o resumo começar a ficar útil.' : summary.priority ? `Prioridade até agora: <b>${esc(summary.priority)}</b>.` : 'Até agora não apareceu um ponto claro de recuperação.'}</div>
    </div>`;
  const btn = document.getElementById('slfbModelBtn');
  if (btn) btn.onclick = () => {
    const el = document.getElementById('slfbModel');
    el?.classList.toggle('open');
    btn.textContent = el?.classList.contains('open') ? 'Ocultar resposta-modelo' : 'Ver resposta-modelo';
  };
}

function schedule() {
  if (queued) return;
  queued = true;
  setTimeout(async () => {
    queued = false;
    try { await renderFeedback(); } catch (e) { console.warn('[Speaking Lab feedback]', e); }
  }, 80);
}

const obs = new MutationObserver(schedule);
function start() {
  obs.observe(document.body, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class']});
  document.addEventListener('click', e => {
    if (e.target?.closest?.('[data-self]')) setTimeout(schedule, 350);
  }, true);
  schedule();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
else start();
})();