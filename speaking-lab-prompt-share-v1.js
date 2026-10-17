(() => {
'use strict';
if (window.__slPromptShareV1) return;
window.__slPromptShareV1 = true;

const MODE = window.__slPromptShareMode || (() => {
  const p = location.pathname;
  if (p.endsWith('/60-second.html')) return '60-second';
  if (p.endsWith('/error-rescue.html')) return 'error-rescue';
  return 'sentence-builder';
})();
const DB='recallSpeakingLabBetaV1', STORE='attempts';
const cache={};
let queued=false, lastRenderedId='';

function openDb(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function allAttempts(){const d=await openDb();const rows=await new Promise((res,rej)=>{const t=d.transaction(STORE,'readonly'),r=t.objectStore(STORE).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);});d.close();return rows;}
async function latestAttempt(){const rows=(await allAttempts()).filter(r=>r.mode===MODE).sort((a,b)=>Number(b.ts||0)-Number(a.ts||0));return rows[0]||null;}
async function getJson(path){if(!cache[path])cache[path]=fetch(path+'?v=prompt-share-2',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Falha ao carregar '+path);return r.json();});return cache[path];}

async function contextFor(a){
  if(a.mode==='sentence-builder'){
    const files=['./speaking-lab/sentence-builder-curated-v1.json','./speaking-lab/sentence-builder-deck-v1.json','./speaking-lab/sentence-builder-errors-v1.json'];
    const lists=await Promise.all(files.map(getJson));
    const x=lists.flatMap(j=>j.exercises||[]).find(x=>x.id===a.exerciseId)||null;
    return {exercise:x};
  }
  if(a.mode==='60-second'){
    const files=['./speaking-lab/60-second-curated-v2.json','./speaking-lab/60-second-professional-v2.json'];
    const lists=await Promise.all(files.map(getJson));
    const topic=lists.flatMap(j=>j.topics||[]).find(x=>x.id===a.topicId)||null;
    return {topic};
  }
  const j=await getJson('./speaking-lab/error-rescue-v1.json');
  const pattern=(j.patterns||[]).find(p=>p.id===a.patternId)||null;
  const exercise=pattern?.exercises?.find(e=>e.id===a.exerciseId)||null;
  return {pattern,exercise};
}

const SB_LABEL={pt_to_en:'produção em inglês',past_tense:'passado',grammar_fix:'correção gramatical',purpose:'finalidade/resultado',professionalize:'linguagem profissional',combine:'combinação de ideias',to_verb:'to + verbo',impact:'impacto profissional'};

function promptFor(a,ctx){
  const base=[
    'Estou treinando inglês no Recall. Vou anexar o áudio da minha resposta.',
    'Quero feedback sobre o que eu REALMENTE falei no áudio. Não compare palavra por palavra com a resposta-modelo: ela é apenas uma referência.',
    '',
    'Meu nível atual é aproximadamente B1 e quero chegar ao B2.'
  ];
  if(a.mode==='sentence-builder'){
    const x=ctx.exercise||{};
    base.push('', 'MODO: Sentence Builder', `EXERCÍCIO: ${x.q||'(não encontrado)'}`, `OBJETIVO/ESTRUTURA: ${SB_LABEL[x.t]||x.t||'construção de frase'}`);
    if(Array.isArray(x.f)&&x.f.length)base.push(`PONTOS/CHUNKS ÚTEIS: ${x.f.join(', ')}`);
    if(x.m)base.push(`RESPOSTA-MODELO: ${x.m}`);
  }else if(a.mode==='60-second'){
    const x=ctx.topic||{};
    base.push('', 'MODO: 60-Second Challenge', `PERGUNTA/TEMA: ${x.prompt||'(não encontrado)'}`, `CATEGORIA: ${x.category||a.category||'geral'}`);
    if(Array.isArray(x.anchors)&&x.anchors.length)base.push(`PONTOS ESPERADOS: ${x.anchors.join(' | ')}`);
    if(x.model)base.push(`EXEMPLO DE RESPOSTA: ${x.model}`);
  }else{
    const p=ctx.pattern||{},e=ctx.exercise||{};
    base.push('', 'MODO: Error Rescue', `EXERCÍCIO: ${e.prompt||'(não encontrado)'}`, `PADRÃO TREINADO: ${p.label||a.patternId||'não identificado'}`);
    if(p.note)base.push(`REGRA/EXPLICAÇÃO: ${p.note}`);
    if(e.model)base.push(`RESPOSTA-MODELO: ${e.model}`);
  }
  base.push('', 'ANALISE ASSIM:',
    '1. Transcreva primeiro exatamente o que você entendeu que eu falei.',
    '2. Identifique no máximo os 3 problemas mais importantes de gramática, vocabulário, estrutura ou naturalidade.',
    '3. Para cada problema, cite o trecho que eu falei, explique em português simples o que precisa mudar e dê a correção.',
    '4. Mostre uma versão corrigida da minha resposta preservando minhas ideias e meu nível de inglês.',
    '5. Depois mostre uma versão um pouco mais natural, adequada a alguém caminhando de B1 para B2.',
    '6. Se eu tiver falado algo correto mas diferente da resposta-modelo, NÃO marque como erro.',
    '7. Se alguma parte do áudio estiver incerta, diga explicitamente que a transcrição pode estar errada em vez de inventar uma correção.',
    '8. Não dê nota de pronúncia nem faça afirmações sobre pronúncia se o áudio não permitir avaliar isso com segurança.'
  );
  if(a.mode==='60-second')base.push('9. Diga também se eu realmente respondi à pergunta e quais pontos esperados eu cobri ou deixei de cobrir.');
  return base.join('\n');
}

function savedHost(){
  const candidates=[...document.querySelectorAll('.card')];
  return candidates.find(el=>/Resposta salva/i.test(el.textContent||''))||null;
}

function injectStyle(){if(document.getElementById('slpsStyle'))return;const s=document.createElement('style');s.id='slpsStyle';s.textContent=`.slps{background:var(--surface,#fff);border:1px solid var(--line,#e3e2ec);border-radius:22px;padding:16px;margin:12px 0}.slps-head{display:flex;align-items:center;gap:8px}.slps-head b{font-size:16px}.slps-tag{margin-left:auto;font-size:8px;font-weight:900;color:var(--primary2,#5748cc);background:var(--surface2,#f1f0f8);padding:5px 7px;border-radius:999px}.slps p{font-size:10px;line-height:1.5;color:var(--muted,#77778a);margin:8px 0 0}.slps-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.slps-btn{min-height:44px;border:1px solid var(--line,#e3e2ec);background:var(--surface2,#f1f0f8);color:var(--ink,#1d1d29);border-radius:12px;font-weight:850;font-size:10px}.slps-btn.primary{border:0;background:linear-gradient(135deg,#5f53dc,#8190ff);color:#fff}.slps-share{margin-top:8px;width:100%}.slps-status{margin-top:8px;font-size:9px;color:var(--muted,#77778a);min-height:14px}@media(max-width:430px){.slps-grid{grid-template-columns:1fr}}`;document.head.appendChild(s);}

async function copyText(text){
  try{await navigator.clipboard.writeText(text);return true}catch{}
  try{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.focus();ta.select();const ok=document.execCommand('copy');ta.remove();return ok}catch{return false}
}

function audioFile(a){
  const blob=a?.blob;if(!(blob instanceof Blob)||!blob.size)return null;
  const type=blob.type||'audio/mp4';
  const ext=type.includes('webm')?'webm':type.includes('wav')?'wav':'m4a';
  const mode=a.mode==='60-second'?'60Second':a.mode==='error-rescue'?'ErrorRescue':'SentenceBuilder';
  const date=new Date(a.ts||Date.now());
  const pad=n=>String(n).padStart(2,'0');
  const stamp=`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
  return new File([blob],`Recall-${mode}-${stamp}.${ext}`,{type});
}

function saveAudio(a,status){
  const file=audioFile(a);
  if(!file){status.textContent='Não encontrei a gravação salva desta tentativa.';return;}
  try{
    const url=URL.createObjectURL(file);
    const link=document.createElement('a');
    link.href=url;
    link.download=file.name;
    link.style.display='none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    status.textContent=`Áudio preparado como ${file.name}. No iPhone, procure em Arquivos → Downloads e anexe no ChatGPT.`;
  }catch(e){status.textContent='Não consegui preparar o áudio para salvar: '+(e?.message||e?.name||'erro');}
}

async function shareAudio(a,status){
  const file=audioFile(a);
  if(!file){status.textContent='Não encontrei a gravação salva desta tentativa.';return;}
  if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
    try{
      await navigator.share({files:[file]});
      status.textContent='Arquivo enviado ao menu de compartilhamento.';
      return;
    }catch(e){if(e?.name==='AbortError'){status.textContent='Compartilhamento cancelado.';return;}status.textContent='O iPhone não conseguiu compartilhar este áudio: '+(e?.message||e?.name||'erro');return;}
  }
  status.textContent='Compartilhamento direto de arquivo não disponível neste navegador. Use “Salvar áudio”.';
}

async function renderCard(){
  const host=savedHost();if(!host)return;
  const attempt=await latestAttempt();if(!attempt)return;
  if(lastRenderedId===attempt.id && document.getElementById('slpsCard'))return;
  const ctx=await contextFor(attempt),prompt=promptFor(attempt,ctx);
  injectStyle();
  let box=document.getElementById('slpsCard');if(!box){box=document.createElement('section');box.id='slpsCard';box.className='slps';host.insertAdjacentElement('afterend',box);}
  lastRenderedId=attempt.id;
  box.innerHTML=`<div class="slps-head"><b>Feedback no ChatGPT</b><span class="slps-tag">MANUAL</span></div><p>Fluxo recomendado no iPhone: copie o prompt, salve a gravação e depois anexe o arquivo no ChatGPT.</p><div class="slps-grid"><button class="slps-btn primary" id="slpsCopy">Copiar prompt</button><button class="slps-btn" id="slpsSave">Salvar áudio</button></div><button class="slps-btn slps-share" id="slpsShare">Compartilhar gravação (opcional)</button><div class="slps-status" id="slpsStatus"></div>`;
  const status=document.getElementById('slpsStatus');
  document.getElementById('slpsCopy').onclick=async()=>{const ok=await copyText(prompt);status.textContent=ok?'Prompt copiado. Agora salve o áudio e anexe os dois na conversa.':'Não consegui copiar automaticamente. Tente novamente.';};
  document.getElementById('slpsSave').onclick=()=>saveAudio(attempt,status);
  document.getElementById('slpsShare').onclick=()=>shareAudio(attempt,status);
}

function schedule(){if(queued)return;queued=true;setTimeout(async()=>{queued=false;try{await renderCard()}catch(e){console.warn('[Recall prompt/share]',e)}},90);}
const obs=new MutationObserver(schedule);
function start(){obs.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});schedule();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();