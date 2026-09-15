(() => {
  'use strict';
  if (window.__recallCefrV181) return;
  const core = window.recallCore;
  if (!core) return;
  window.__recallCefrV181 = true;

  const state = () => core.getState();
  const DECKS = core.DECKS;

  function norm(text){
    return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’]/g,"'").replace(/\s+/g,' ').trim();
  }
  function words(text){ return norm(text).split(/\s+/).filter(Boolean); }
  function countMatches(text, patterns){ return patterns.reduce((n,re)=>n+(re.test(text)?1:0),0); }

  function estimateEnglish(card){
    const text=norm(card.front), wc=words(text).length, tags=new Set((card.tags||[]).filter(t=>!/^CEFR-/i.test(t)));
    let score=0;
    if(wc>=7) score+=1;
    if(wc>=10) score+=2;
    if(wc>=14) score+=2;

    const grammar=[
      /\b(have|has|had) been\b/i,
      /\b(if|unless|although|whether|whenever|while|whereas)\b/i,
      /\bwould\b.+\b(if|when|because|that)\b/i,
      /\b(before|after)\b.+\b(ing|ed)\b/i,
      /\b(which|whose|whom)\b/i,
      /\b(to make sure|as a result|from my perspective|in order to)\b/i
    ];
    score += Math.min(3,countMatches(text,grammar))*2;

    const advanced=[
      /\b(inconsisten\w*|reconcil\w*|measurable|reliable|requirement|cross-reference|significant|responsible|perspective|consolidated|exceptions|automation|validate|validation|technical|business process\w*)\b/i,
      /\b(investigate|approach|implement|improve\w*|identify|analy[sz]\w*|transform|reduce\w*|maintain)\b/i
    ];
    score += Math.min(2,countMatches(text,advanced));
    if(tags.has('Idioms')) score+=3;
    if(wc>=7 && ['Interview','Data','Project','Automation','Tax','Tools','Career'].some(t=>tags.has(t))) score+=1;

    if(score<=0) return 'A1';
    if(score<=3) return 'A2';
    if(score<=7) return 'B1';
    return 'B2';
  }

  function estimateGerman(card){
    const text=norm(card.front), wc=words(text).length;
    let score=0;
    if(wc>=6) score+=1;
    if(wc>=9) score+=2;
    if(wc>=13) score+=2;
    const grammar=[
      /\b(weil|dass|wenn|obwohl|wahrend|damit|bevor|nachdem|ob)\b/i,
      /\b(wurde|konnte|sollte|hatte|ware)\b/i,
      /\b(seitdem|deshalb|trotzdem|außerdem)\b/i
    ];
    score += Math.min(3,countMatches(text,grammar))*2;
    if(score<=1) return 'A1';
    if(score<=4) return 'A2';
    if(score<=7) return 'B1';
    return 'B2';
  }

  function estimate(card,deckId){ return deckId==='de'?estimateGerman(card):estimateEnglish(card); }

  function reclassify(){
    let changed=false;
    for(const deckId of Object.keys(DECKS)){
      for(const card of (state().cards?.[deckId]||[])){
        if(card.cefrSource==='manual') continue;
        const next=estimate(card,deckId);
        if(card.cefr!==next || card.cefrSource!=='auto-v18.1'){
          card.cefr=next;
          card.cefrSource='auto-v18.1';
          changed=true;
        }
        const clean=(card.tags||[]).filter(t=>!/^CEFR-[A-C][12]$/i.test(t));
        const tags=[...new Set([...clean,`CEFR-${next}`])];
        if(JSON.stringify(tags)!==JSON.stringify(card.tags||[])){ card.tags=tags; changed=true; }
      }
    }
    if(changed) core.save();
  }

  function injectStyles(){
    if(document.getElementById('rf181Style')) return;
    const st=document.createElement('style');
    st.id='rf181Style';
    st.textContent=`
      .rf181-card-level{position:absolute;left:18px;bottom:14px;z-index:3;pointer-events:none;display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:20px;padding:0 6px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.76);color:var(--muted);font-size:8.5px;font-weight:850;letter-spacing:.04em;opacity:.72;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
      .flashcard.back .rf181-card-level{background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.18);color:rgba(255,255,255,.78);opacity:.9}
      .rf181-dist{background:var(--surface2);border:1px solid var(--line);border-radius:12px;padding:10px}.rf181-dist-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:7px}.rf181-dist-head b{font-size:11px}.rf181-dist-row{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:6px}.rf181-dist-name{min-width:74px;font-size:10px;font-weight:800;color:var(--ink)}.rf181-level{display:inline-flex;align-items:center;gap:3px;padding:4px 6px;border-radius:999px;background:var(--surface);border:1px solid var(--line);font-size:9px;color:var(--muted)}.rf181-level b{color:var(--primary);font-size:9px}.rf2-tag[data-rf181-cefr="1"]{display:none!important}
    `;
    document.head.appendChild(st);
  }

  function decorateCard(){
    const flash=document.getElementById('flashcard');
    const item=core.current?.();
    if(!flash) return;
    let badge=document.getElementById('rf181CardLevel');
    if(!item){ badge?.remove(); return; }
    if(!badge){
      badge=document.createElement('span');badge.id='rf181CardLevel';badge.className='rf181-card-level';flash.appendChild(badge);
    }
    const level=item.card.cefr||'—';
    badge.textContent=level;
    badge.title=`CEFR estimado: ${level}`;
  }

  function hideDuplicateCefrTags(){
    document.querySelectorAll('.rf2-tag').forEach(el=>{
      const t=(el.textContent||'').replace(/^#/,'').trim();
      if(/^CEFR-[A-C][12]$/i.test(t)) el.dataset.rf181Cefr='1';
    });
  }

  function counts(deckId){
    const out={A1:0,A2:0,B1:0,B2:0};
    for(const c of (state().cards?.[deckId]||[])) if(out[c.cefr]!==undefined) out[c.cefr]++;
    return out;
  }
  function row(deckId){
    const c=counts(deckId),name=DECKS[deckId]?.name||deckId,flag=DECKS[deckId]?.flag||'';
    return `<div class="rf181-dist-row"><span class="rf181-dist-name">${flag} ${name}</span>${['A1','A2','B1','B2'].map(l=>`<span class="rf181-level"><b>${l}</b> ${c[l]}</span>`).join('')}</div>`;
  }
  function decorateDistribution(){
    const dash=document.getElementById('rf18Dashboard');
    if(!dash) return;
    let box=document.getElementById('rf181Distribution');
    const html=`<div class="rf181-dist-head"><b>Níveis estimados (CEFR)</b><span class="rf18-small">classificação automática</span></div>${row('en')}${row('de')}`;
    if(!box){box=document.createElement('div');box.id='rf181Distribution';box.className='rf181-dist';const kpis=dash.querySelector('.rf18-kpis');if(kpis)dash.insertBefore(box,kpis);else dash.appendChild(box);}
    if(box.innerHTML!==html) box.innerHTML=html;
  }

  function decorateAll(){ decorateCard(); hideDuplicateCefrTags(); decorateDistribution(); }

  reclassify();
  injectStyles();

  const baseReview=core.getRenderReview?.();
  if(baseReview) core.setRenderReview(function(...args){const r=baseReview(...args);queueMicrotask(decorateAll);return r;});
  const baseLibrary=core.getRenderLibrary?.();
  if(baseLibrary) core.setRenderLibrary(function(...args){const r=baseLibrary(...args);queueMicrotask(decorateAll);return r;});
  const baseRender=core.getRender?.();
  if(baseRender) core.setRender(function(...args){const r=baseRender(...args);queueMicrotask(decorateAll);return r;});

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#rf18ProgressBtn,#flashcard,[data-view="review"],[data-view="library"]')) setTimeout(decorateAll,40);
  },true);

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',decorateAll,{once:true}); else decorateAll();
  let tries=0;const timer=setInterval(()=>{decorateAll();if(++tries>30)clearInterval(timer);},180);
})();
