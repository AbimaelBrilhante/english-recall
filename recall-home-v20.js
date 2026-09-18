(() => {
  'use strict';
  if (window.__recallHomeV20) return;
  const core = window.recallCore;
  if (!core) return;
  window.__recallHomeV20 = true;

  const DECKS = core.DECKS;
  const state = () => core.getState();
  const DAY = core.DAY || 86400000;
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function dateStart(offset=0){
    const d=new Date();d.setDate(d.getDate()+offset);d.setHours(0,0,0,0);return d.getTime();
  }
  function endStudy(offset=0){
    const d=new Date();d.setDate(d.getDate()+offset);d.setHours(21,0,0,0);return d.getTime();
  }
  function todayKey(){ return core.dayKey(); }
  function mode(id){ return state().settings?.modeByDeck?.[id] || 'recognition'; }
  function visualMode(id){ return mode(id)==='production' ? 'production' : 'recognition'; }
  function modeLabel(id){ return visualMode(id)==='production' ? 'Fala' : 'Compreensão'; }
  function reps(card){
    return Number(card?.schedules?.recognition?.reps||0)+Number(card?.schedules?.production?.reps||0);
  }
  function unseen(card){ return !card?.introducedDay && reps(card)===0; }

  function logsFor(id){
    return (state().reviewLog||[]).filter(x=>x.deckId===id);
  }
  function todayCount(id){
    const a=dateStart(),b=dateStart(1),day=todayKey();
    return logsFor(id).filter(x=>x.day===day || (Number(x.ts||0)>=a&&Number(x.ts||0)<b)).length;
  }
  function retention(id){
    const since=Date.now()-30*DAY;
    const logs=logsFor(id).filter(x=>Number(x.ts||0)>=since);
    if(!logs.length) return 0;
    return Math.round(logs.filter(x=>x.rating!=='again').length/logs.length*100);
  }
  function pendingToday(id){
    try{return core.getCandidateItems()(id,endStudy(),core.selectedMode(id)).length;}catch{return 0;}
  }
  function goal(id){
    const fallback=id==='en'?20:10;
    const daily=Number(state().settings?.rf18?.goals?.[id]?.daily || state().settings?.power?.dailyGoal || fallback);
    const done=todayCount(id);
    return {daily,done,pct:Math.min(100,Math.round(done/Math.max(1,daily)*100))};
  }
  function queue(id){
    let items=[];
    try{items=core.getCandidateItems()(id,endStudy(),core.selectedMode(id));}catch{}
    const reviews=items.filter(x=>!unseen(x.card)).length;
    const today=todayKey();
    const used=(state().cards?.[id]||[]).filter(c=>c.introducedDay===today).length;
    const limit=Number(state().settings?.newCardLimits?.[id] ?? (id==='en'?10:5));
    return {reviews,used,limit};
  }
  function isBuried(card){
    return Boolean(card?.buriedUntilDay && todayKey() < card.buriedUntilDay);
  }
  function productionAllowed(card,id){
    const m=visualMode(id);
    if(m==='recognition') return false;
    return Number(card?.schedules?.recognition?.reps||0)>=Number(DECKS[id]?.unlockReps||0) || m==='production';
  }
  function scheduledEntries(id){
    const out=[];
    const m=visualMode(id);
    for(const card of (state().cards?.[id]||[])){
      if(card.suspended||isBuried(card)||reps(card)===0) continue;
      if(m!=='production'){
        const due=Number(card.schedules?.recognition?.due);
        if(Number.isFinite(due)&&due>0)out.push(due);
      }
      if(m!=='recognition'&&productionAllowed(card,id)){
        const due=Number(card.schedules?.production?.due);
        if(Number.isFinite(due)&&due>0)out.push(due);
      }
    }
    return out;
  }
  function forecastFor(id){
    const a0=endStudy(0),a1=endStudy(1),a6=endStudy(6),entries=scheduledEntries(id);
    return {
      today:entries.filter(x=>x<=a0).length,
      tomorrow:entries.filter(x=>x>a0&&x<=a1).length,
      seven:entries.filter(x=>x<=a6).length
    };
  }
  function lastErrors(){
    return (state().reviewLog||[])
      .filter(x=>x.rating==='again'||x.rating==='hard')
      .sort((a,b)=>Number(b.ts||0)-Number(a.ts||0))
      .slice(0,3)
      .map(log=>{
        const id=log.deckId || Object.keys(DECKS).find(k=>(state().cards?.[k]||[]).some(c=>c.id===log.id)) || 'en';
        const card=(state().cards?.[id]||[]).find(c=>c.id===log.id);
        return {text:card?.front||'Card difícil',ts:Number(log.ts||0),rating:log.rating};
      });
  }
  function ago(ts){
    if(!ts)return '';
    const h=Math.max(0,Math.round((Date.now()-ts)/3600000));
    return h<1?'agora':h<24?('há '+h+'h'):('há '+Math.round(h/24)+'d');
  }

  function ensureBrand(){
    if(document.body.classList.contains('rv20-brand-ready')) return;
    const brand=document.querySelector('.brand');
    const streak=document.getElementById('topStreak');
    const due=document.getElementById('topDue');
    if(brand && !brand.querySelector('.rv20-brandmark')){
      brand.innerHTML='<div class="rv20-brandmark">◫</div><div class="rv20-brandcopy"><h1>Recall</h1><span>Aprenda hoje. Lembre sempre.</span></div>';
    }
    if(streak?.parentElement){
      const p=streak.parentElement;
      p.innerHTML='🔥 <b id="topStreak">'+esc(streak.textContent||'0')+'</b><span>dias</span>';
    }
    if(due?.parentElement) due.parentElement.classList.add('rv20-due-pill');
    document.body.classList.add('rv20-brand-ready');
  }

  function ensureRoot(){
    const view=document.getElementById('view-decks');
    if(!view) return null;
    let root=document.getElementById('rv20Home');
    if(!root){
      root=document.createElement('div');
      root.id='rv20Home';
      view.appendChild(root);
    }
    return root;
  }

  function deckHtml(id){
    const cfg=DECKS[id],cards=state().cards?.[id]||[],g=goal(id),ret=retention(id),today=todayCount(id),total=logsFor(id).length,m=visualMode(id);
    const desc=id==='en'?'Vocabulário, expressões e fluência no dia a dia':'Estruturas, casos e conversação prática';
    return '<article class="rv20-deck">'+
      '<div class="rv20-deck-head">'+
        '<div class="rv20-flag">'+cfg.flag+'</div>'+
        '<div class="rv20-deck-name"><b>'+esc(cfg.name)+'</b><span class="rv20-mode">'+modeLabel(id)+'</span><p>'+desc+'</p></div>'+
        '<div class="rv20-ring-label"><div class="rv20-ring" style="--p:'+ret+'"><b>'+ret+'%</b></div><small>retenção</small></div>'+
      '</div>'+
      '<div class="rv20-deck-stats">'+
        '<div class="rv20-ds"><b>'+total.toLocaleString('pt-BR')+'</b><span>exercícios</span></div>'+
        '<div class="rv20-ds today"><b>'+today+'</b><span>hoje</span></div>'+
        '<div class="rv20-ds cards"><b>'+cards.length.toLocaleString('pt-BR')+'</b><span>frases</span></div>'+
      '</div>'+
      '<div class="rv20-actions">'+
        '<button data-rv20-study="'+id+'" data-mode="recognition" class="'+(m==='recognition'?'active':'')+'">🎧 Compreensão</button>'+
        '<button data-rv20-study="'+id+'" data-mode="production" class="'+(m==='production'?'active':'')+'">🎙 Fala</button>'+
        '<button data-rv20-continue="'+id+'" class="continue" aria-label="Continuar '+esc(cfg.name)+'">▶</button>'+
      '</div>'+
      '<div class="rv20-progress-mini"><div class="rv20-progress-label"><span>Ritmo diário</span><b>'+g.done+' / '+g.daily+' cards</b></div><div class="rv20-track"><div class="rv20-fill" style="width:'+g.pct+'%"></div></div></div>'+
    '</article>';
  }

  function renderHome(){
    ensureBrand();
    const root=ensureRoot();
    if(!root)return;
    const selected=state().settings?.selectedDeck||'en';
    const qEn=queue('en'),qDe=queue('de'),fEn=forecastFor('en'),fDe=forecastFor('de');
    const errors=lastErrors();
    root.innerHTML=
      '<div class="rv20-section-title"><b>▱ Meus Decks em Foco</b><span>'+(pendingToday('en')+pendingToday('de'))+' pendentes hoje</span></div>'+
      '<section class="rv20-deck-grid">'+deckHtml('en')+deckHtml('de')+'</section>'+
      '<div class="rv20-section-title"><b>▥ Metas e fila</b><span>Hoje</span></div>'+
      '<section class="rv20-grid2">'+
        '<div class="rv20-panel"><h3>▥ Metas de estudo</h3>'+
          ['en','de'].map(id=>{const g=goal(id);return '<div class="rv20-goal-row '+id+'"><div class="rv20-goal-head"><b>'+DECKS[id].flag+' '+esc(DECKS[id].name)+'</b><span>'+g.pct+'%</span></div><div class="rv20-track"><div class="rv20-fill" style="width:'+g.pct+'%"></div></div></div>';}).join('')+
        '</div>'+
        '<div class="rv20-panel"><h3>⟳ Novas x revisões</h3><div class="rv20-queue">'+
          '<div class="rv20-qbox"><b>'+DECKS.en.flag+' '+qEn.reviews+'</b><span>revisões hoje</span></div><div class="rv20-qbox"><b>'+qEn.used+'/'+qEn.limit+'</b><span>novas English</span></div>'+
          '<div class="rv20-qbox"><b>'+DECKS.de.flag+' '+qDe.reviews+'</b><span>revisões hoje</span></div><div class="rv20-qbox"><b>'+qDe.used+'/'+qDe.limit+'</b><span>novas Deutsch</span></div>'+
        '</div></div>'+
      '</section>'+
      '<div class="rv20-section-title"><b>◫ Diagnóstico rápido</b><span>atualizado pelo histórico</span></div>'+
      '<section class="rv20-grid2">'+
        '<div class="rv20-panel"><h3>⌁ Previsão de Carga</h3><div class="rv20-forecast">'+
          '<div class="rv20-fc"><b>'+(fEn.today+fDe.today)+'</b><span>hoje</span></div>'+
          '<div class="rv20-fc"><b>'+(fEn.tomorrow+fDe.tomorrow)+'</b><span>amanhã</span></div>'+
          '<div class="rv20-fc"><b>'+(fEn.seven+fDe.seven)+'</b><span>7 dias</span></div>'+
        '</div><div class="rv20-note">Janela de estudo: 08h–21h.</div></div>'+
        '<div class="rv20-panel"><h3>⚠ Últimos erros</h3><div class="rv20-errors">'+
          (errors.length?errors.map(x=>'<div class="rv20-error"><i>'+(x.rating==='again'?'●':'◐')+'</i><span>'+esc(x.text)+'</span><small>'+ago(x.ts)+'</small></div>').join(''):'<div class="rv20-note">Nenhum erro recente.</div>')+
        '</div><button id="rv20Errors" class="rv20-errors-btn">Revisar últimos erros →</button></div>'+
      '</section>'+
      '<div class="rv20-section-title"><b>⚡ Ações rápidas</b><span>ferramentas atuais</span></div>'+
      '<section class="rv20-panel"><div class="rv20-quick">'+
        '<button id="rv20Zero"><span>⚡</span>Zerar '+esc(DECKS[selected]?.name||'dia')+'</button>'+
        '<button id="rv20Hands"><span>🎧</span>Hands-free</button>'+
        '<button id="rv20Session"><span>▣</span>Sessão</button>'+
        '<button id="rv20Progress"><span>📈</span>Progresso</button>'+
        '<button id="rv20Health"><span>🩺</span>Saúde</button>'+
        '<button id="rv20Sync"><span>↻</span>Sincronizar</button>'+
      '</div><div id="rv20Msg" class="rv20-note"></div></section>';
    bind();
  }

  function setModeAndStudy(id,m){
    state().settings ||= {};
    state().settings.modeByDeck ||= {};
    state().settings.modeByDeck[id]=m;
    state().settings.selectedDeck=id;
    core.save();
    core.clearCurrentItem();
    core.startSession(id);
  }
  function continueDeck(id){
    const m=visualMode(id);
    setModeAndStudy(id,m);
  }
  function clickOriginal(id){
    const el=document.getElementById(id);
    if(el){el.click();return true;}
    return false;
  }
  function message(text){
    const el=document.getElementById('rv20Msg');if(el)el.textContent=text;
  }
  function bind(){
    document.querySelectorAll('[data-rv20-study]').forEach(b=>b.onclick=()=>setModeAndStudy(b.dataset.rv20Study,b.dataset.mode));
    document.querySelectorAll('[data-rv20-continue]').forEach(b=>b.onclick=()=>continueDeck(b.dataset.rv20Continue));
    document.getElementById('rv20Errors').onclick=()=>{ if(!clickOriginal('rf199RecentErrors')) core.showView('rf199-errors'); };
    document.getElementById('rv20Zero').onclick=()=>{
      const id=state().settings?.selectedDeck||'en';
      if(!clickOriginal(id==='de'?'rf199ZeroDe':'rf199ZeroEn')) message('Abra novamente a Home e tente de novo.');
    };
    document.getElementById('rv20Hands').onclick=()=>{
      core.showView('rf3-session');
      setTimeout(()=>{ if(!clickOriginal('rf191HandsSessionBtn')) message('Hands-free disponível dentro de Sessão.'); },40);
    };
    document.getElementById('rv20Session').onclick=()=>{ if(!clickOriginal('rf3SessionBtn')) core.showView('rf3-session'); };
    document.getElementById('rv20Progress').onclick=()=>{ if(!clickOriginal('rf18ProgressBtn')) core.showView('rf18-progress'); };
    document.getElementById('rv20Health').onclick=()=>{ if(!clickOriginal('rf2HealthBtn')) core.showView('rf2-health'); };
    document.getElementById('rv20Sync').onclick=async()=>{
      const b=document.getElementById('rv20Sync'); if(b)b.disabled=true;
      const ok=await core.syncAll(true);
      if(b)b.disabled=false;
      message(ok?'Sincronização concluída.':'Não foi possível sincronizar agora.');
      renderHome();
    };
  }

  function homeActive(){
    const on=document.getElementById('view-decks')?.classList.contains('active');
    document.body.classList.toggle('rv20-home-active',Boolean(on));
  }

  const baseRender=core.getRender();
  core.setRender(function(){
    const r=baseRender();
    renderHome();
    homeActive();
    return r;
  });

  function init(){
    ensureBrand();
    ensureRoot();
    renderHome();
    homeActive();
    const view=document.getElementById('view-decks');
    if(view)new MutationObserver(homeActive).observe(view,{attributes:true,attributeFilter:['class']});
    document.querySelectorAll('.nav button').forEach(b=>b.addEventListener('click',()=>requestAnimationFrame(homeActive)));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();