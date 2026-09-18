(() => {
  'use strict';
  if (window.__recallSmartSessionsV199) return;
  const core = window.recallCore;
  if (!core) return;
  window.__recallSmartSessionsV199 = true;

  const DECKS = core.DECKS;
  const state = () => core.getState();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const baseCandidates = core.getCandidateItems();

  let zeroDayDeck = null;
  let zeroDayInitialKeys = new Set();
  let zeroDayDoneKeys = new Set();
  const itemKey = x => `${x?.card?.id||''}|${x?.direction||''}`;

  function save(){ core.save(); }
  function now(){ return Date.now(); }
  function atEndOfDay(offset=0){
    const d = new Date();
    d.setDate(d.getDate()+offset);
    d.setHours(21,0,0,0);
    return d.getTime();
  }
  function mode(deckId){ return state().settings?.modeByDeck?.[deckId] || 'smart'; }

  function isBuried(card){
    return Boolean(card?.buriedUntilDay && core.dayKey() < card.buriedUntilDay);
  }
  function studied(card){
    return Number(card?.schedules?.recognition?.reps||0)+Number(card?.schedules?.production?.reps||0)>0 || Boolean(card?.introducedDay);
  }
  function directionAllowed(card, deckId, direction){
    const m = mode(deckId);
    if(direction==='recognition') return m!=='production';
    if(m==='recognition') return false;
    return m==='production' || Number(card?.schedules?.recognition?.reps||0) >= Number(DECKS[deckId]?.unlockReps||0);
  }
  function scheduledEntries(deckId){
    const out=[];
    for(const card of (state().cards?.[deckId]||[])){
      if(card.suspended || isBuried(card) || !studied(card)) continue;
      for(const direction of ['recognition','production']){
        if(!directionAllowed(card,deckId,direction)) continue;
        const due=Number(card.schedules?.[direction]?.due);
        if(Number.isFinite(due) && due>0) out.push({card,direction,due});
      }
    }
    return out;
  }
  function loadForDeck(deckId){
    const entries=scheduledEntries(deckId);
    const e0=atEndOfDay(0), e1=atEndOfDay(1), e6=atEndOfDay(6);
    return {
      today: entries.filter(x=>x.due<=e0).length,
      tomorrow: entries.filter(x=>x.due>e0 && x.due<=e1).length,
      seven: entries.filter(x=>x.due<=e6).length
    };
  }
  function forecast(){
    const en=loadForDeck('en'), de=loadForDeck('de');
    return {
      en,de,
      today:en.today+de.today,
      tomorrow:en.tomorrow+de.tomorrow,
      seven:en.seven+de.seven
    };
  }

  function zeroCount(deckId){
    return baseCandidates(deckId, atEndOfDay(0), mode(deckId)).length;
  }

  core.setCandidateItems(function(deckId=core.selectedDeck(), cutoff=Date.now(), selectedMode=core.selectedMode(deckId)){
    const actual=baseCandidates(deckId, cutoff, selectedMode);
    if(zeroDayDeck!==deckId) return actual;

    const promoted=baseCandidates(deckId, atEndOfDay(0), selectedMode);
    const merged=new Map(actual.map(x=>[itemKey(x),x]));
    for(const x of promoted){
      const k=itemKey(x);
      if(zeroDayInitialKeys.has(k) && !zeroDayDoneKeys.has(k) && !merged.has(k)) merged.set(k,x);
    }
    return [...merged.values()].sort((a,b)=>Number(a.due||0)-Number(b.due||0));
  });

  const baseRateCard=core.getRateCard();
  core.setRateCard(function(kind){
    const item=core.current?.();
    if(zeroDayDeck && item && core.selectedDeck()===zeroDayDeck){
      zeroDayDoneKeys.add(itemKey(item));
    }
    return baseRateCard(kind);
  });

  function clearZeroDay(){
    zeroDayDeck=null;
    zeroDayInitialKeys=new Set();
    zeroDayDoneKeys=new Set();
    document.getElementById('rf199ZeroChip')?.remove();
  }

  function ensureZeroChip(deckId){
    const wrap=document.querySelector('#view-review .progress-wrap');
    if(!wrap) return;
    let chip=document.getElementById('rf199ZeroChip');
    if(!chip){
      chip=document.createElement('div');
      chip.id='rf199ZeroChip';
      chip.className='rf199-zero-chip';
      wrap.insertAdjacentElement('afterend',chip);
    }
    chip.innerHTML=`<span>⚡ Zerar o dia · ${DECKS[deckId].flag} ${esc(DECKS[deckId].name)} · até 21h</span><button id="rf199ZeroStop" type="button">Encerrar</button>`;
    document.getElementById('rf199ZeroStop').onclick=()=>{clearZeroDay();core.clearCurrentItem();core.showView('decks');core.render();};
  }

  function startZeroDay(deckId){
    clearZeroDay();
    const count=zeroCount(deckId);
    if(!count){
      const msg=document.getElementById('rf199HomeMsg');
      if(msg) msg.textContent=`${DECKS[deckId].name}: nada mais previsto até 21h.`;
      return;
    }
    zeroDayDeck=deckId;
    zeroDayDoneKeys=new Set();
    zeroDayInitialKeys=new Set(baseCandidates(deckId,atEndOfDay(0),mode(deckId)).map(itemKey));
    state().settings.selectedDeck=deckId;
    save();
    core.clearCurrentItem();
    core.startSession?.(deckId);
    setTimeout(()=>ensureZeroChip(deckId),40);
  }

  function reviewDeckForLog(log){
    if(log?.deckId && DECKS[log.deckId]) return log.deckId;
    for(const id of Object.keys(DECKS)){
      if((state().cards?.[id]||[]).some(c=>c.id===log?.id)) return id;
    }
    return '';
  }
  function recentErrorLogs(deckId, hours){
    const since=now()-hours*3600000;
    return (state().reviewLog||[])
      .filter(l=>Number(l.ts||0)>=since && (l.rating==='again'||l.rating==='hard') && reviewDeckForLog(l)===deckId)
      .sort((a,b)=>Number(b.ts||0)-Number(a.ts||0));
  }
  function recentErrorCards(deckId,hours){
    const seen=new Set(), cards=[];
    const all=state().cards?.[deckId]||[];
    for(const log of recentErrorLogs(deckId,hours)){
      if(seen.has(log.id)) continue;
      const card=all.find(c=>c.id===log.id);
      if(card && !card.suspended && !isBuried(card)){
        seen.add(card.id);cards.push(card);
      }
    }
    return cards;
  }

  function ensureErrorsView(){
    const main=document.querySelector('main.app');
    if(!main || document.getElementById('view-rf199-errors')) return;
    const v=document.createElement('section');
    v.id='view-rf199-errors';
    v.className='view';
    v.innerHTML=`
      <div class="section">
        <div class="rf2-head"><div><h2 style="margin:0">↩ Últimos erros</h2><div class="rf2-muted">Reforce Hard e Não lembrei sem alterar o SRS.</div></div><button id="rf199ErrorsBack" class="secondary-btn">← Decks</button></div>
        <div class="rf199-error-grid">
          <label>Deck<select id="rf199ErrDeck"><option value="en">🇺🇸 English</option><option value="de">🇩🇪 Deutsch</option></select></label>
          <label>Período<select id="rf199ErrPeriod"><option value="24">Últimas 24 horas</option><option value="72">Últimos 3 dias</option></select></label>
          <label>Modo<select id="rf199ErrMode"><option value="production">🗣 Produção</option><option value="recognition">👁 Compreensão</option></select></label>
        </div>
        <div id="rf199ErrSummary" class="rf199-error-summary"></div>
        <button id="rf199ErrStart" class="primary-btn" style="width:100%;margin-top:12px">Revisar últimos erros</button>
        <div id="rf199ErrMsg" class="msg"></div>
      </div>`;
    main.appendChild(v);
    document.getElementById('rf199ErrorsBack').onclick=()=>core.showView('decks');
    for(const id of ['rf199ErrDeck','rf199ErrPeriod']) document.getElementById(id).onchange=renderErrorsSummary;
    document.getElementById('rf199ErrStart').onclick=startRecentErrors;
  }

  function renderErrorsSummary(){
    ensureErrorsView();
    const deckId=document.getElementById('rf199ErrDeck')?.value||core.selectedDeck();
    const hours=Number(document.getElementById('rf199ErrPeriod')?.value||24);
    const logs=recentErrorLogs(deckId,hours), cards=recentErrorCards(deckId,hours);
    const again=logs.filter(x=>x.rating==='again').length, hard=logs.filter(x=>x.rating==='hard').length;
    const el=document.getElementById('rf199ErrSummary');
    if(el) el.innerHTML=`<b>${cards.length} frase(s)</b><span>${again} Não lembrei · ${hard} Difícil</span>`;
  }

  function openRecentErrors(){
    clearZeroDay();
    ensureErrorsView();
    const deck=document.getElementById('rf199ErrDeck');
    if(deck) deck.value=core.selectedDeck();
    renderErrorsSummary();
    core.showView('rf199-errors');
  }

  function startRecentErrors(){
    const deckId=document.getElementById('rf199ErrDeck')?.value||core.selectedDeck();
    const hours=Number(document.getElementById('rf199ErrPeriod')?.value||24);
    const studyMode=document.getElementById('rf199ErrMode')?.value||'production';
    const cards=recentErrorCards(deckId,hours);
    const msg=document.getElementById('rf199ErrMsg');
    if(!cards.length){
      if(msg) msg.textContent='Nenhum Hard/Não lembrei encontrado nesse período.';
      return;
    }

    const deck=document.getElementById('rf3Deck');
    const type=document.getElementById('rf3Type');
    const source=document.getElementById('rf3Source');
    const modeEl=document.getElementById('rf3Mode');
    const size=document.getElementById('rf3Size');
    const tag=document.getElementById('rf3Tag');
    const start=document.getElementById('rf3StartSession');
    if(!deck||!type||!source||!modeEl||!size||!tag||!start){
      if(msg) msg.textContent='A tela de sessão ainda não ficou pronta. Volte e tente novamente.';
      return;
    }

    const tempTag='__RecentErrorsV199';
    for(const c of cards){
      c.tags=Array.isArray(c.tags)?c.tags:[];
      if(!c.tags.includes(tempTag)) c.tags.push(tempTag);
    }
    save();

    deck.value=deckId;
    type.value='cram';
    source.value='tag';
    modeEl.value=studyMode;
    size.value='0';
    tag.value=tempTag;
    start.click();

    for(const c of (state().cards?.[deckId]||[])){
      if(Array.isArray(c.tags)) c.tags=c.tags.filter(t=>t!==tempTag);
    }
    save();
  }

  function styles(){
    if(document.getElementById('rf199Style')) return;
    const st=document.createElement('style');
    st.id='rf199Style';
    st.textContent=`
      .rf199-panel{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:11px 12px;margin:0 0 10px}
      .rf199-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:9px}
      .rf199-kpi{background:var(--surface2);border-radius:11px;padding:9px;text-align:center}.rf199-kpi b{display:block;font-size:19px;color:var(--ink);letter-spacing:-.03em}.rf199-kpi span{font-size:9.5px;color:var(--muted)}
      .rf199-decks{font-size:10px;color:var(--muted);margin-top:7px;text-align:center}
      .rf199-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.rf199-actions button{min-height:42px;border-radius:11px;border:1px solid var(--line);background:var(--surface2);color:var(--ink);font-weight:850;font-size:11px}.rf199-actions button.primary{background:var(--primary);color:#fff;border-color:var(--primary)}
      .rf199-zero-chip{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--surface2);border:1px solid var(--line);border-radius:13px;padding:8px 10px;margin:0 0 10px;font-size:11px;color:var(--muted)}.rf199-zero-chip button{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:9px;padding:7px 9px;font-size:10px;font-weight:800}
      .rf199-error-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.rf199-error-grid label{font-size:11px;color:var(--muted);font-weight:800}.rf199-error-grid label:last-child{grid-column:1/-1}.rf199-error-grid select{margin-top:5px;width:100%;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:12px;padding:11px}
      .rf199-error-summary{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;background:var(--surface2);border-radius:12px;padding:10px 11px}.rf199-error-summary b{font-size:15px}.rf199-error-summary span{font-size:10px;color:var(--muted)}
      #rf199RecentErrorsPreset b{display:block;font-size:13px;margin-bottom:3px;color:var(--primary)}
      @media(max-width:430px){.rf199-actions{grid-template-columns:1fr}.rf199-error-grid{grid-template-columns:1fr}.rf199-error-grid label:last-child{grid-column:auto}}
    `;
    document.head.appendChild(st);
  }

  function renderHomePanel(){
    const view=document.getElementById('view-decks');
    if(!view) return false;
    let panel=document.getElementById('rf199Home');
    if(!panel){
      panel=document.createElement('div');
      panel.id='rf199Home';
      panel.className='rf199-panel';
    }
    const f=forecast(), enZero=zeroCount('en'), deZero=zeroCount('de');
    panel.innerHTML=`
      <div class="rf2-head"><div><b>⚡ Estudo inteligente</b><div class="rf2-muted">Carga prevista e atalhos de revisão</div></div><span class="rf2-muted">08h–21h</span></div>
      <div class="rf199-kpis">
        <div class="rf199-kpi"><b>${f.today}</b><span>restante hoje</span></div>
        <div class="rf199-kpi"><b>${f.tomorrow}</b><span>amanhã</span></div>
        <div class="rf199-kpi"><b>${f.seven}</b><span>próx. 7 dias</span></div>
      </div>
      <div class="rf199-decks">Hoje: 🇺🇸 ${f.en.today} · 🇩🇪 ${f.de.today} &nbsp;|&nbsp; Amanhã: 🇺🇸 ${f.en.tomorrow} · 🇩🇪 ${f.de.tomorrow}</div>
      <div class="rf199-actions">
        <button class="primary" id="rf199ZeroEn">⚡ Zerar English · ${enZero}</button>
        <button class="primary" id="rf199ZeroDe">⚡ Zerar Deutsch · ${deZero}</button>
        <button id="rf199RecentErrors">↩ Últimos erros</button>
      </div>
      <div id="rf199HomeMsg" class="rf2-muted" style="margin-top:7px"></div>`;

    const msg=document.getElementById('syncMsg');
    if(msg?.parentElement===view){
      if(msg.nextElementSibling!==panel) msg.insertAdjacentElement('afterend',panel);
    }else if(panel.parentElement!==view){
      view.appendChild(panel);
    }

    document.getElementById('rf199ZeroEn').onclick=()=>startZeroDay('en');
    document.getElementById('rf199ZeroDe').onclick=()=>startZeroDay('de');
    document.getElementById('rf199RecentErrors').onclick=openRecentErrors;
    return true;
  }

  function ensureSessionPreset(){
    const presets=document.getElementById('rf16Presets');
    if(!presets) return false;
    if(!document.getElementById('rf199RecentErrorsPreset')){
      const b=document.createElement('button');
      b.id='rf199RecentErrorsPreset';
      b.className='rf16-preset';
      b.type='button';
      b.innerHTML='<b>↩ Últimos erros</b>Hard / Não lembrei recentes';
      b.onclick=openRecentErrors;
      presets.appendChild(b);
    }
    return true;
  }

  document.addEventListener('click',e=>{
    const nav=e.target.closest?.('.nav button');
    if(nav && nav.dataset.view!=='review') clearZeroDay();
    if(e.target.closest?.('#deckGrid')) clearZeroDay();
    if(e.target.closest?.('#rf3SessionBtn,#rf18ProgressBtn,#rf2HealthBtn')) clearZeroDay();
  },true);

  function init(){
    styles();
    ensureErrorsView();
    renderHomePanel();
    ensureSessionPreset();
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      const a=renderHomePanel();
      const b=ensureSessionPreset();
      if(tries>40 || (a&&b)) clearInterval(timer);
    },250);

    const view=document.getElementById('view-decks');
    if(view){
      new MutationObserver(()=>requestAnimationFrame(()=>{renderHomePanel();ensureSessionPreset();})).observe(view,{childList:true,subtree:false});
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();