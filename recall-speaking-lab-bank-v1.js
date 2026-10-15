(() => {
'use strict';
if (window.__recallSpeakingLabBankV1) return;
window.__recallSpeakingLabBankV1 = true;

const DB='recallSpeakingLabBetaV1';
const STORE='attempts';
const TARGET='speaking-lab/sentence-builder-en.json';
const BANK_FILES=[
  ['./speaking-lab/sentence-builder-curated-v1.json','curated'],
  ['./speaking-lab/sentence-builder-deck-v1.json','deck_chunk'],
  ['./speaking-lab/sentence-builder-errors-v1.json','error_pattern']
];
const SESSION_SIZE=8;
const LEVEL_TARGETS={'B1':3,'B1+':3,'B2':2};
const LABELS={
  past_tense:'Passado',
  grammar_fix:'Gramática',
  pt_to_en:'Produção',
  purpose:'Finalidade',
  professionalize:'Profissionalizar',
  combine:'Combinar ideias',
  to_verb:'to + verbo',
  impact:'Impacto'
};
const nativeFetch=window.fetch.bind(window);

function isTarget(input){
  try{
    const raw=typeof input==='string'?input:(input?.url||'');
    return raw.includes(TARGET);
  }catch{return false;}
}

function expand(x,source){
  const type=x.t, q=String(x.q||''), model=String(x.m||'');
  const openEnded=['purpose','professionalize','impact'].includes(type);
  let instruction='Say this in English.';
  let promptText=`Say in English: ${q}`;
  let lang='en-US';

  if(type==='pt_to_en'||type==='to_verb'){
    instruction='Say this in English.';
    promptText=`Say in English: ${q}`;
    lang='pt-BR';
  }else if(type==='grammar_fix'){
    instruction='Correct this sentence.';
    promptText=`Correct this sentence: ${q}`;
  }else if(type==='past_tense'){
    instruction='Change this sentence to the past.';
    promptText=`Change this sentence to the past: ${q}`;
  }else if(type==='purpose'){
    instruction='Complete the idea with a professional purpose.';
    promptText=`Complete with a professional purpose: ${q}`;
  }else if(type==='professionalize'){
    instruction='Make this sentence sound more professional.';
    promptText=`Make this more professional: ${q}`;
  }else if(type==='combine'){
    instruction='Combine these two ideas naturally.';
    promptText=`Combine naturally: ${q}`;
  }else if(type==='impact'){
    instruction='Finish this answer with professional impact.';
    promptText=`Finish with professional impact: ${q}`;
  }

  return {
    id:x.id,
    level:x.l,
    type,
    label:LABELS[type]||type,
    promptSegments:[
      {lang:'en-US',text:instruction},
      {lang,text:q}
    ],
    promptText,
    model,
    accepted:Array.isArray(x.a)?x.a:(openEnded?[]:[model]),
    focus:Array.isArray(x.f)?x.f:[],
    openEnded,
    source,
    ...(x.r?{sourceRef:x.r}:{})
  };
}

async function loadBank(){
  const out=[];
  for(const [path,source] of BANK_FILES){
    const r=await nativeFetch(`${path}?v=1`,{cache:'no-store'});
    if(!r.ok) throw new Error(`Bank HTTP ${r.status}: ${path}`);
    const j=await r.json();
    const rows=Array.isArray(j?.exercises)?j.exercises:[];
    out.push(...rows.map(x=>expand(x,source)));
  }
  return out;
}

function history(){
  return new Promise(resolve=>{
    let req;
    try{req=indexedDB.open(DB,1);}catch{return resolve(new Map());}
    req.onupgradeneeded=()=>{
      try{
        if(!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE,{keyPath:'id'});
      }catch{}
    };
    req.onerror=()=>resolve(new Map());
    req.onsuccess=()=>{
      const db=req.result, out=new Map();
      try{
        const tx=db.transaction(STORE,'readonly');
        const cur=tx.objectStore(STORE).openCursor();
        cur.onerror=()=>{try{db.close();}catch{} resolve(out);};
        cur.onsuccess=()=>{
          const c=cur.result;
          if(!c){try{db.close();}catch{} return resolve(out);}
          const v=c.value||{}, id=v.exerciseId;
          if(id){
            const prev=out.get(id)||{count:0,last:0};
            prev.count++;
            prev.last=Math.max(prev.last,Number(v.ts||0));
            out.set(id,prev);
          }
          c.continue();
        };
      }catch{
        try{db.close();}catch{}
        resolve(out);
      }
    };
  });
}

function shuffle(a){
  const x=[...a];
  for(let i=x.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [x[i],x[j]]=[x[j],x[i]];
  }
  return x;
}

function choose(pool,n,stats,chosen){
  const remaining=shuffle(pool.filter(x=>!chosen.some(y=>y.id===x.id)));
  const picked=[];
  while(picked.length<n && remaining.length){
    remaining.sort((a,b)=>{
      const sa=stats.get(a.id)||{count:0,last:0};
      const sb=stats.get(b.id)||{count:0,last:0};
      if(sa.count!==sb.count) return sa.count-sb.count;
      if(sa.last!==sb.last) return sa.last-sb.last;

      const chosenNow=[...chosen,...picked];
      const typeA=chosenNow.filter(x=>x.type===a.type).length;
      const typeB=chosenNow.filter(x=>x.type===b.type).length;
      if(typeA!==typeB) return typeA-typeB;

      const sourceA=chosenNow.filter(x=>x.source===a.source).length;
      const sourceB=chosenNow.filter(x=>x.source===b.source).length;
      if(sourceA!==sourceB) return sourceA-sourceB;

      return 0;
    });
    picked.push(remaining.shift());
  }
  return picked;
}

async function selectSession(bank){
  const stats=await history();
  let selected=[];
  for(const [level,n] of Object.entries(LEVEL_TARGETS)){
    selected.push(...choose(bank.filter(x=>x.level===level),n,stats,selected));
  }
  if(selected.length<SESSION_SIZE){
    selected.push(...choose(bank,SESSION_SIZE-selected.length,stats,selected));
  }
  selected=shuffle(selected.slice(0,SESSION_SIZE));
  window.__recallSpeakingLabBankStats={
    bankSize:bank.length,
    sessionSize:selected.length,
    ids:selected.map(x=>x.id),
    levels:selected.reduce((m,x)=>(m[x.level]=(m[x.level]||0)+1,m),{}),
    sources:selected.reduce((m,x)=>(m[x.source]=(m[x.source]||0)+1,m),{})
  };
  return selected;
}

window.fetch=async function(input,init){
  const response=await nativeFetch(input,init);
  if(!isTarget(input) || !response?.ok) return response;
  const backup=response.clone();
  try{
    const bank=await loadBank();
    if(bank.length<SESSION_SIZE) return backup;
    const selected=await selectSession(bank);
    const out={
      version:2,
      language:'en-US',
      bankSize:bank.length,
      sessionSize:selected.length,
      levelTargets:LEVEL_TARGETS,
      exercises:selected
    };
    const headers=new Headers(response.headers);
    headers.set('content-type','application/json; charset=utf-8');
    headers.delete('content-length');
    return new Response(JSON.stringify(out),{
      status:response.status,
      statusText:response.statusText,
      headers
    });
  }catch(err){
    console.warn('[Speaking Lab bank] fallback to original content',err);
    return backup;
  }
};

// A second Sentence Builder session in the same page gets a fresh 8-item rotation.
// At 8/8, "Próximo" starts another rotation instead of looping to item 1.
const AUTO='recallSpeakingLabAutoOpenV1';
let sessionOpened=false;
document.addEventListener('click',e=>{
  const builder=e.target?.closest?.('#slBuilder');
  if(builder){
    if(sessionOpened){
      e.preventDefault();
      e.stopImmediatePropagation();
      try{sessionStorage.setItem(AUTO,'1');}catch{}
      location.reload();
      return;
    }
    sessionOpened=true;
  }

  const next=e.target?.closest?.('#slNext');
  const pos=document.querySelector('.sl-pos')?.textContent?.trim();
  if(next && pos==='8/8'){
    e.preventDefault();
    e.stopImmediatePropagation();
    try{sessionStorage.setItem(AUTO,'1');}catch{}
    location.reload();
  }
},true);

let tries=0;
const auto=setInterval(()=>{
  let wants=false;
  try{wants=sessionStorage.getItem(AUTO)==='1';}catch{}
  if(!wants){clearInterval(auto);return;}
  const b=document.getElementById('slBuilder');
  if(b){
    try{sessionStorage.removeItem(AUTO);}catch{}
    clearInterval(auto);
    b.click();
  }else if(++tries>80){
    clearInterval(auto);
  }
},150);
})();