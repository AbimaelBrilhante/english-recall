(() => {
  'use strict';
  if (window.__recallInsightsV18) return;
  const core = window.recallCore;
  if (!core) return;
  window.__recallInsightsV18 = true;

  const DECKS = core.DECKS;
  const state = () => core.getState();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));

  function save(){ core.save(); }
  function logs(){ return state().reviewLog || []; }
  function cards(id){ return state().cards?.[id] || []; }
  function dayOfLog(log){ return log?.day || (log?.ts ? core.dayKey(new Date(log.ts)) : ''); }
  function dateOnly(d=new Date()){ const x=new Date(d);x.setHours(0,0,0,0);return x; }
  function startOfWeek(d=new Date()){
    const x=dateOnly(d); const offset=(x.getDay()+6)%7; x.setDate(x.getDate()-offset); return x;
  }
  function addDays(d,n){ const x=new Date(d);x.setDate(x.getDate()+n);return x; }
  function key(d){ return core.dayKey(d); }

  function ensureState(){
    const s=state(); s.settings ||= {}; s.settings.rf18 ||= {};
    s.settings.rf18.goals ||= {};
    const oldGoal=Number(s.settings.power?.dailyGoal || 20);
    for(const id of Object.keys(DECKS)){
      s.settings.rf18.goals[id] ||= {};
      const fallbackDaily=id==='en'?(Number.isFinite(oldGoal)&&oldGoal>0?Math.round(oldGoal):20):10;
      const d=Number(s.settings.rf18.goals[id].daily);
      const w=Number(s.settings.rf18.goals[id].weekly);
      s.settings.rf18.goals[id].daily=Number.isFinite(d)&&d>0?Math.round(d):fallbackDaily;
      s.settings.rf18.goals[id].weekly=Number.isFinite(w)&&w>0?Math.round(w):fallbackDaily*7;
    }
    if(!Array.isArray(s.settings.rf18.ignoredDuplicates))s.settings.rf18.ignoredDuplicates=[];
    applyCefr();
    save();
  }

  function estimateCefr(card,deckId){
    const text=String(card.front||'').trim();
    const words=text.split(/\s+/).filter(Boolean).length;
    if(deckId==='de') return words>=10?'A2':'A1';
    const tags=new Set(card.tags||[]);
    if(tags.has('Idioms')) return 'B2';
    const complex=(text.match(/\b(would|could|should|whether|although|unless|perspective|requirement|reliable|inconsistenc|cross-reference|measurable|significant|responsible|currently|whenever|before changing|if i understood|have been|has been)\w*/gi)||[]).length;
    if(words>=15 || complex>=2) return 'B2';
    if(words>=9 || complex>=1 || tags.has('Interview') || tags.has('Data') || tags.has('Project')) return 'B1';
    return 'A2';
  }

  function applyCefr(){
    let changed=false;
    for(const id of Object.keys(DECKS)) for(const c of cards(id)){
      if(!c.cefr){ c.cefr=estimateCefr(c,id); c.cefrSource='auto'; changed=true; }
      const autoTags=(c.tags||[]).filter(t=>!/^CEFR-[A-C][12]$/.test(t));
      const next=[...new Set([...autoTags,`CEFR-${c.cefr}`])];
      if(JSON.stringify(next)!==JSON.stringify(c.tags||[])){c.tags=next;changed=true;}
    }
    if(changed) save();
  }

  function ratingValue(r){ return r==='easy'?100:r==='good'?88:r==='hard'?58:0; }
  function directionScore(card,direction){
    const hist=logs().filter(x=>x.id===card.id&&x.direction===direction).slice(-10);
    const sch=card.schedules?.[direction]||{};
    const reps=Number(sch.reps||0),interval=Number(sch.interval||0),lapses=Number(sch.lapses||0);
    if(!hist.length && !reps) return 0;
    const maturity=reps?clamp(Math.round(42+Math.log2(interval+1)*11+Math.min(6,reps)*4-lapses*7),5,96):0;
    if(!hist.length) return maturity;
    const recent=Math.round(hist.reduce((a,x)=>a+ratingValue(x.rating),0)/hist.length);
    return clamp(Math.round(recent*.78+maturity*.22),0,100);
  }
  function cardSkills(card){ return {recognition:directionScore(card,'recognition'),production:directionScore(card,'production')}; }
  function deckSkill(id,direction){
    const studied=cards(id).filter(c=>Number(c.schedules?.[direction]?.reps||0)>0);
    if(!studied.length)return 0;
    return Math.round(studied.reduce((a,c)=>a+directionScore(c,direction),0)/studied.length);
  }

  function todayCount(id){ const today=core.dayKey();return logs().filter(x=>x.deckId===id&&dayOfLog(x)===today).length; }
  function weekLogs(offset=0){
    const start=addDays(startOfWeek(),offset*7),end=addDays(start,6),a=key(start),b=key(end);
    return logs().filter(x=>{const d=dayOfLog(x);return d>=a&&d<=b;});
  }
  function weekCount(id,offset=0){ return weekLogs(offset).filter(x=>x.deckId===id).length; }

  function injectStyles(){
    if(document.getElementById('rf18Style'))return;
    const st=document.createElement('style');st.id='rf18Style';st.textContent=`
      .rf18-goals{display:grid;grid-template-columns:1fr 1fr;gap:8px}.rf18-goal{background:var(--surface2);border:1px solid var(--line);border-radius:12px;padding:10px}.rf18-goal-head{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:11px;font-weight:800}.rf18-goal-num{font-size:18px;color:var(--ink);letter-spacing:-.03em}.rf18-mini{height:5px;background:var(--line);border-radius:999px;overflow:hidden;margin:7px 0 4px}.rf18-mini>i{display:block;height:100%;background:linear-gradient(90deg,var(--primary),var(--accent));border-radius:999px}.rf18-small{font-size:9.5px;color:var(--muted)}
      .rf18-skill{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:8px 0 10px}.rf18-skill>div{background:var(--surface2);border:1px solid var(--line);border-radius:11px;padding:8px 9px}.rf18-skill b{display:block;font-size:15px;color:var(--ink)}.rf18-skill span{font-size:9.5px;color:var(--muted)}.rf18-cefr{display:inline-flex;align-items:center;border-radius:999px;padding:4px 7px;background:#edf1ff;color:#3f51a4;font-size:9.5px;font-weight:850;border:1px solid rgba(63,81,164,.12)}html[data-recall-theme="dark"] .rf18-cefr{background:#293250;color:#cbd3ff;border-color:#394567}
      .rf18-dashboard{display:grid;gap:12px}.rf18-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.rf18-kpi{background:var(--surface2);border-radius:12px;padding:10px;text-align:center}.rf18-kpi b{display:block;font-size:20px;letter-spacing:-.03em}.rf18-kpi span{font-size:9.5px;color:var(--muted)}
      .rf18-heat-wrap{overflow-x:auto;padding:4px 0 2px}.rf18-heat{display:grid;grid-template-rows:repeat(7,11px);grid-auto-flow:column;grid-auto-columns:11px;gap:3px;width:max-content}.rf18-day{width:11px;height:11px;border-radius:3px;background:var(--surface2);border:1px solid rgba(0,0,0,.025)}.rf18-day[data-l="1"]{background:color-mix(in srgb,var(--primary) 22%,var(--surface))}.rf18-day[data-l="2"]{background:color-mix(in srgb,var(--primary) 42%,var(--surface))}.rf18-day[data-l="3"]{background:color-mix(in srgb,var(--primary) 67%,var(--surface))}.rf18-day[data-l="4"]{background:var(--primary)}.rf18-legend{display:flex;justify-content:flex-end;align-items:center;gap:4px;margin-top:7px;font-size:9px;color:var(--muted)}
      .rf18-insights{display:grid;gap:7px}.rf18-insight{background:var(--surface2);border-radius:11px;padding:9px 10px;font-size:11px;line-height:1.45}.rf18-dup-list{display:grid;gap:8px;margin-top:10px}.rf18-dup{background:var(--surface2);border:1px solid var(--line);border-radius:12px;padding:10px}.rf18-dup-score{font-size:9px;font-weight:850;color:var(--primary);margin-bottom:6px}.rf18-dup-row{font-size:11px;line-height:1.35;margin:5px 0}.rf18-dup-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.rf18-dup-actions button{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:9px;padding:7px 9px;font-size:10px;font-weight:800}.rf18-library-metrics{margin-top:7px}.rf18-review-metrics{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:3px 2px 9px}.rf18-review-metrics .rf18-skill{margin:0;display:flex;gap:5px}.rf18-review-metrics .rf18-skill>div{padding:5px 7px}.rf18-review-metrics .rf18-skill b{display:inline;font-size:11px}.rf18-review-metrics .rf18-skill span{font-size:9px}
      @media(max-width:430px){.rf18-goals{grid-template-columns:1fr}.rf18-kpis{grid-template-columns:1fr 1fr}.rf18-kpis .rf18-kpi:last-child{grid-column:1/-1}}
    `;document.head.appendChild(st);
  }

  function goalConfig(id){ return state().settings.rf18.goals[id]; }
  function editGoal(id){
    const g=goalConfig(id),name=DECKS[id].name;
    const d=prompt(`Meta diária de ${name}:`,String(g.daily));if(d===null)return;
    const w=prompt(`Meta semanal de ${name}:`,String(g.weekly));if(w===null)return;
    g.daily=clamp(Math.round(Number(d)||g.daily),1,500);g.weekly=clamp(Math.round(Number(w)||g.weekly),1,3000);save();renderHomeGoals();renderDashboard();
  }
  function goalHtml(id){
    const g=goalConfig(id),today=todayCount(id),week=weekCount(id),dp=Math.min(100,Math.round(today/g.daily*100)),wp=Math.min(100,Math.round(week/g.weekly*100));
    return `<div class="rf18-goal"><div class="rf18-goal-head"><span>${DECKS[id].flag} ${esc(DECKS[id].name)}</span><button class="rf3-btn" data-rf18-goal="${id}" style="min-height:28px;padding:0 8px">Editar</button></div><div class="rf18-goal-num">${today}/${g.daily}</div><div class="rf18-mini"><i style="width:${dp}%"></i></div><div class="rf18-small">hoje · ${week}/${g.weekly} nesta semana (${wp}%)</div></div>`;
  }
  function renderHomeGoals(){
    const box=document.getElementById('rf2Goal');if(!box)return;
    box.innerHTML=`<div class="rf2-head" style="margin-bottom:9px"><div><b>🎯 Metas por idioma</b><div class="rf2-muted">Diária e semanal</div></div></div><div class="rf18-goals">${goalHtml('en')}${goalHtml('de')}</div>`;
    box.querySelectorAll('[data-rf18-goal]').forEach(b=>b.onclick=()=>editGoal(b.dataset.rf18Goal));
  }

  function ensureProgressView(){
    const main=document.querySelector('main.app');if(!main)return;
    if(!document.getElementById('view-rf18-progress')){
      const v=document.createElement('section');v.id='view-rf18-progress';v.className='view';v.innerHTML=`
        <div class="section"><div class="rf2-head"><div><h2 style="margin:0">Progresso</h2><div class="rf2-muted">Retenção, produção, metas e atividade</div></div><button id="rf18Back" class="secondary-btn">← Decks</button></div><div id="rf18Dashboard" class="rf18-dashboard" style="margin-top:12px"></div></div>
        <div class="section"><div class="rf2-head"><div><h2 style="margin:0">Limpeza inteligente</h2><div class="rf2-muted">Procura frases idênticas ou muito parecidas. Nenhum card é excluído automaticamente.</div></div><button id="rf18ScanDup" class="secondary-btn">Analisar</button></div><div id="rf18DupList" class="rf18-dup-list"><div class="rf2-muted">Toque em Analisar para procurar possíveis duplicadas.</div></div></div>`;
      main.appendChild(v);document.getElementById('rf18Back').onclick=()=>core.showView('decks');document.getElementById('rf18ScanDup').onclick=scanDuplicates;
    }
    const row=document.querySelector('#view-decks .sync-row');
    if(row&&!document.getElementById('rf18ProgressBtn')){const b=document.createElement('button');b.id='rf18ProgressBtn';b.className='rf2-topbtn';b.type='button';b.textContent='📈 Progresso';b.onclick=()=>{core.showView('rf18-progress');renderDashboard();};row.appendChild(b);}
  }

  function heatmapHtml(){
    const end=dateOnly(),start=addDays(end,-83),countByDay={};
    for(const l of logs()){const d=dayOfLog(l);if(d)countByDay[d]=(countByDay[d]||0)+1;}
    const vals=[];for(let i=0;i<84;i++){const d=addDays(start,i),k=key(d);vals.push(countByDay[k]||0);}
    const max=Math.max(1,...vals);
    const cells=vals.map((n,i)=>{const d=addDays(start,i),lv=n===0?0:n/max<=.25?1:n/max<=.5?2:n/max<=.75?3:4;return `<span class="rf18-day" data-l="${lv}" title="${d.toLocaleDateString('pt-BR')}: ${n} revisão(ões)"></span>`;}).join('');
    return `<div><div class="rf2-head"><b>Atividade · últimas 12 semanas</b><span class="rf2-muted">${vals.reduce((a,b)=>a+b,0)} revisões</span></div><div class="rf18-heat-wrap"><div class="rf18-heat">${cells}</div></div><div class="rf18-legend">menos <span class="rf18-day" data-l="0"></span><span class="rf18-day" data-l="1"></span><span class="rf18-day" data-l="2"></span><span class="rf18-day" data-l="3"></span><span class="rf18-day" data-l="4"></span> mais</div></div>`;
  }

  function weeklyInsights(){
    const cur=weekLogs(0),prev=weekLogs(-1),total=cur.length,prevTotal=prev.length;
    const retention=total?Math.round(cur.filter(x=>x.rating!=='again').length/total*100):0;
    const prevRetention=prev.length?Math.round(prev.filter(x=>x.rating!=='again').length/prev.length*100):0;
    const prod=total?Math.round(cur.filter(x=>x.direction==='production').length/total*100):0;
    const en=cur.filter(x=>x.deckId==='en').length,de=cur.filter(x=>x.deckId==='de').length;
    const delta=total-prevTotal;
    const againBy={};for(const x of cur.filter(x=>x.rating==='again'))againBy[`${x.deckId}|${x.id}`]=(againBy[`${x.deckId}|${x.id}`]||0)+1;
    const problems=Object.entries(againBy).filter(([,n])=>n>=2).length;
    const lines=[];
    lines.push(`<div class="rf18-insight"><b>${total} revisões nesta semana</b> · ${delta===0?'mesmo volume da semana anterior':delta>0?`${delta} a mais que na semana anterior`:`${Math.abs(delta)} a menos que na semana anterior`}.</div>`);
    lines.push(`<div class="rf18-insight"><b>Retenção ${retention}%</b>${prev.length?` · semana anterior ${prevRetention}%`:''}. Produção representou <b>${prod}%</b> do estudo.</div>`);
    const enGoal=goalConfig('en').weekly,deGoal=goalConfig('de').weekly;
    const enPct=Math.round(en/enGoal*100),dePct=Math.round(de/deGoal*100),behind=dePct<enPct?'Deutsch':'English';
    lines.push(`<div class="rf18-insight">🇺🇸 ${en}/${enGoal} · 🇩🇪 ${de}/${deGoal}. <b>${behind}</b> está mais atrás da meta semanal.</div>`);
    if(problems)lines.push(`<div class="rf18-insight"><b>${problems} card(s)</b> tiveram “Não lembrei” pelo menos duas vezes nesta semana — bons candidatos para Weak spots.</div>`);
    else lines.push(`<div class="rf18-insight">Nenhum card repetiu “Não lembrei” duas vezes nesta semana.</div>`);
    return lines.join('');
  }

  function renderDashboard(){
    ensureProgressView();const box=document.getElementById('rf18Dashboard');if(!box)return;
    const cur=weekLogs(0),ret=cur.length?Math.round(cur.filter(x=>x.rating!=='again').length/cur.length*100):0,prod=cur.length?Math.round(cur.filter(x=>x.direction==='production').length/cur.length*100):0;
    box.innerHTML=`
      <div><div class="rf2-head"><b>Metas por idioma</b><span class="rf2-muted">toque em Editar para ajustar</span></div><div class="rf18-goals" style="margin-top:8px">${goalHtml('en')}${goalHtml('de')}</div></div>
      <div><div class="rf2-head"><b>Compreensão x produção</b><span class="rf2-muted">estimado pelo seu histórico</span></div><div class="rf18-goals" style="margin-top:8px"><div class="rf18-goal"><div class="rf18-goal-head"><span>🇺🇸 English</span><span class="rf18-cefr">deck</span></div><div class="rf18-skill"><div><b>${deckSkill('en','recognition')}%</b><span>compreensão</span></div><div><b>${deckSkill('en','production')}%</b><span>produção</span></div></div></div><div class="rf18-goal"><div class="rf18-goal-head"><span>🇩🇪 Deutsch</span><span class="rf18-cefr">deck</span></div><div class="rf18-skill"><div><b>${deckSkill('de','recognition')}%</b><span>compreensão</span></div><div><b>${deckSkill('de','production')}%</b><span>produção</span></div></div></div></div></div>
      <div class="rf18-kpis"><div class="rf18-kpi"><b>${cur.length}</b><span>revisões na semana</span></div><div class="rf18-kpi"><b>${ret}%</b><span>retenção</span></div><div class="rf18-kpi"><b>${prod}%</b><span>produção</span></div></div>
      ${heatmapHtml()}
      <div><div class="rf2-head"><b>Resumo semanal</b><span class="rf2-muted">atualizado automaticamente</span></div><div class="rf18-insights" style="margin-top:8px">${weeklyInsights()}</div></div>`;
    box.querySelectorAll('[data-rf18-goal]').forEach(b=>b.onclick=()=>editGoal(b.dataset.rf18Goal));
  }

  function decorateReview(){
    const item=core.current?.();const panel=document.querySelector('#view-review .panel');if(!panel)return;
    let el=document.getElementById('rf18ReviewMetrics');
    if(!item){el?.remove();return;}
    if(!el){el=document.createElement('div');el.id='rf18ReviewMetrics';el.className='rf18-review-metrics';const meta=document.getElementById('cardmeta');meta?.insertAdjacentElement('afterend',el);}
    const m=cardSkills(item.card);el.innerHTML=`<span class="rf18-cefr">${esc(item.card.cefr||'—')}</span><div class="rf18-skill"><div><b>${m.recognition}%</b> <span>compreensão</span></div><div><b>${m.production}%</b> <span>produção</span></div></div>`;
  }

  function decorateLibrary(){
    const id=document.getElementById('libraryDeck')?.value||core.selectedDeck();const all=cards(id);
    document.querySelectorAll('#list .item').forEach(row=>{
      const front=row.querySelector('.en')?.textContent||'',back=row.querySelector('.pt')?.textContent||'';const c=all.find(x=>x.front===front&&x.back===back);if(!c)return;
      row.querySelector('.rf18-library-metrics')?.remove();const m=cardSkills(c),x=document.createElement('div');x.className='rf18-library-metrics';x.innerHTML=`<span class="rf18-cefr">CEFR ${esc(c.cefr||'—')}</span><div class="rf18-skill"><div><b>${m.recognition}%</b><span>compreensão</span></div><div><b>${m.production}%</b><span>produção</span></div></div>`;const extra=row.querySelector('.rf2-extra,.rf3-extra');if(extra)row.insertBefore(x,extra);else row.appendChild(x);
    });
  }

  function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'').replace(/[^a-z0-9äöüß\s]/gi,' ').replace(/\s+/g,' ').trim();}
  function tokens(s){return new Set(norm(s).split(' ').filter(Boolean));}
  function jaccard(a,b){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let inter=0;for(const x of A)if(B.has(x))inter++;return inter/(A.size+B.size-inter);}
  function editSimilarity(a,b){a=norm(a);b=norm(b);if(a===b)return 1;const m=a.length,n=b.length;if(!m||!n)return 0;if(Math.min(m,n)/Math.max(m,n)<.72)return 0;let prev=Array.from({length:n+1},(_,i)=>i),cur=new Array(n+1);for(let i=1;i<=m;i++){cur[0]=i;for(let j=1;j<=n;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));[prev,cur]=[cur,prev];}return 1-prev[n]/Math.max(m,n);}
  function pairKey(id,a,b){return `${id}|${[a.id,b.id].sort().join('|')}`;}
  function findDuplicates(){
    const ignored=new Set(state().settings.rf18.ignoredDuplicates||[]),out=[];
    for(const id of Object.keys(DECKS)){
      const arr=cards(id).filter(c=>!c.suspended);
      for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){
        const a=arr[i],b=arr[j],pk=pairKey(id,a,b);if(ignored.has(pk))continue;
        const na=norm(a.front),nb=norm(b.front);if(!na||!nb)continue;
        let score=na===nb?1:0;
        if(score<1){const jac=jaccard(na,nb);if(jac<.72)continue;const edit=editSimilarity(na,nb);if((jac>=.82&&edit>=.86)||edit>=.93)score=Math.max(jac,edit);}
        if(score>=.86)out.push({id,a,b,score,pk});
      }
    }
    return out.sort((x,y)=>y.score-x.score).slice(0,30);
  }
  function renderDuplicates(pairs=findDuplicates()){
    const box=document.getElementById('rf18DupList');if(!box)return;
    if(!pairs.length){box.innerHTML='<div class="rf2-muted">Nenhuma possível duplicada encontrada com o critério atual.</div>';return;}
    box.innerHTML=pairs.map((p,i)=>`<div class="rf18-dup" data-i="${i}"><div class="rf18-dup-score">${DECKS[p.id].flag} ${Math.round(p.score*100)}% de similaridade</div><div class="rf18-dup-row"><b>A:</b> ${esc(p.a.front)}</div><div class="rf18-dup-row"><b>B:</b> ${esc(p.b.front)}</div><div class="rf18-dup-actions"><button data-act="a">Suspender A</button><button data-act="b">Suspender B</button><button data-act="ignore">Não são duplicadas</button></div></div>`).join('');
    box.querySelectorAll('.rf18-dup').forEach(el=>{const p=pairs[Number(el.dataset.i)];el.querySelector('[data-act="a"]').onclick=()=>{p.a.suspended=true;save();renderDuplicates();core.renderLibrary?.();};el.querySelector('[data-act="b"]').onclick=()=>{p.b.suspended=true;save();renderDuplicates();core.renderLibrary?.();};el.querySelector('[data-act="ignore"]').onclick=()=>{state().settings.rf18.ignoredDuplicates=[...new Set([...(state().settings.rf18.ignoredDuplicates||[]),p.pk])];save();renderDuplicates();};});
  }
  function scanDuplicates(){const btn=document.getElementById('rf18ScanDup');if(btn){btn.disabled=true;btn.textContent='Analisando…';}setTimeout(()=>{renderDuplicates();if(btn){btn.disabled=false;btn.textContent='Analisar novamente';}},30);}

  function refresh(){ applyCefr();ensureProgressView();renderHomeGoals();decorateReview(); }

  const baseRender=core.getRender?.();if(baseRender)core.setRender(function(...args){const r=baseRender(...args);queueMicrotask(()=>{ensureProgressView();renderHomeGoals();decorateReview();});return r;});
  const baseReview=core.getRenderReview?.();if(baseReview)core.setRenderReview(function(...args){const r=baseReview(...args);queueMicrotask(decorateReview);return r;});
  const baseLibrary=core.getRenderLibrary?.();if(baseLibrary)core.setRenderLibrary(function(...args){const r=baseLibrary(...args);queueMicrotask(decorateLibrary);return r;});
  const baseSync=core.getSyncAll?.();if(baseSync)core.setSyncAll(async function(...args){const r=await baseSync(...args);applyCefr();renderHomeGoals();return r;});

  ensureState();injectStyles();refresh();
})();
