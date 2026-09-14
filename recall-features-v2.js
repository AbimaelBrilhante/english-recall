(() => {
  'use strict';
  if (window.__recallFeaturesV2) return;
  const core = window.recallCore;
  if (!core) return;
  window.__recallFeaturesV2 = true;

  const AUDIO_KEY = 'recallAudioHealthV2';
  const LAST_AUDIO_KEY = 'recallLastAudioScanV2';
  const LAST_SYNC_KEY = 'recallLastSyncV2';
  const DEFAULT_LIMITS = { en: 10, de: 5 };
  const DAY = core.DAY;
  const DECKS = core.DECKS;
  const $ = core.$;
  const state = () => core.getState();
  const escapeHtml = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function save(){ core.save(); }
  function ensureState(){
    const s = state();
    s.settings ||= {};
    s.settings.power ||= {};
    s.settings.newCardLimits ||= {};
    if (!Number.isFinite(Number(s.settings.power.dailyGoal)) || Number(s.settings.power.dailyGoal) < 1) s.settings.power.dailyGoal = 20;
    for (const id of Object.keys(DECKS)) {
      const v = Number(s.settings.newCardLimits[id]);
      s.settings.newCardLimits[id] = Number.isFinite(v) && v >= 0 ? Math.round(v) : DEFAULT_LIMITS[id];
      for (const card of (s.cards[id] || [])) {
        if (typeof card.favorite !== 'boolean') card.favorite = false;
        if (typeof card.suspended !== 'boolean') card.suspended = false;
        if (!Array.isArray(card.tags)) card.tags = [];
        const reps = Number(card.schedules?.recognition?.reps || 0) + Number(card.schedules?.production?.reps || 0);
        if (!card.introducedDay && reps > 0) card.introducedDay = 'legacy';
      }
    }
    save();
  }

  function nextHard(i){ if(i<=0)return 1;if(i<=1)return 2;if(i<=2)return 4;if(i<=4)return 7;return Math.max(i+1,Math.round(i*1.45)); }
  function nextGood(i){ if(i<=0)return 1;if(i<=1)return 3;if(i<=3)return 7;if(i<=7)return 15;if(i<=15)return 35;return Math.max(i+1,Math.round(i*1.8)); }
  function nextEasy(i){ if(i<=0)return 3;if(i<=3)return 7;if(i<=7)return 18;if(i<=18)return 45;if(i<=45)return 100;return Math.max(i+2,Math.round(i*2)); }
  function tunedRateSchedule(s, kind){
    const now=Date.now();s.ease=Number(s.ease)||2.5;s.interval=Number(s.interval)||0;s.reps=Number(s.reps)||0;s.lapses=Number(s.lapses)||0;
    if(kind==='again'){s.lapses+=1;s.ease=Math.max(1.3,s.ease-.20);s.interval=0;s.due=now+10*60000;return;}
    s.reps+=1;
    if(kind==='hard'){s.ease=Math.max(1.3,s.ease-.10);s.interval=nextHard(s.interval);}
    else if(kind==='good'){s.interval=nextGood(s.interval);}
    else if(kind==='easy'){s.ease=Math.min(3.2,s.ease+.10);s.interval=nextEasy(s.interval);}
    else return;
    s.due=now+s.interval*DAY;
  }
  core.setRateSchedule(tunedRateSchedule);

  const baseCandidates = core.getCandidateItems();
  function reps(card){ return Number(card.schedules?.recognition?.reps||0)+Number(card.schedules?.production?.reps||0); }
  function unseen(card){ return !card.introducedDay && reps(card)===0; }
  function introducedToday(deckId){ const today=core.dayKey();return (state().cards[deckId]||[]).filter(c=>c.introducedDay===today).length; }
  function newLimit(deckId){ return Number(state().settings.newCardLimits[deckId] ?? DEFAULT_LIMITS[deckId]); }
  function filteredCandidates(deckId=core.selectedDeck(), cutoff=Date.now(), mode=core.selectedMode(deckId)){
    const items=baseCandidates(deckId,cutoff,mode).filter(x=>!x.card.suspended);
    const reviews=items.filter(x=>!unseen(x.card));
    const fresh=items.filter(x=>unseen(x.card));
    let remain=Math.max(0,newLimit(deckId)-introducedToday(deckId));
    if(!remain)return reviews;
    const allowed=new Set();
    for(const item of fresh){if(allowed.size>=remain)break;allowed.add(item.card.id);}
    return [...reviews,...fresh.filter(x=>allowed.has(x.card.id))];
  }
  core.setCandidateItems(filteredCandidates);

  const baseRateCard=core.getRateCard();
  core.setRateCard(function(kind){
    const item=core.current();
    if(item?.card && unseen(item.card)){item.card.introducedDay=core.dayKey();save();}
    return baseRateCard(kind);
  });

  function isLeech(card){
    const lapses=Number(card.schedules?.recognition?.lapses||0)+Number(card.schedules?.production?.lapses||0);
    const logs=(state().reviewLog||[]).filter(r=>r.id===card.id).slice(-10);
    const again=logs.filter(r=>r.rating==='again').length,hard=logs.filter(r=>r.rating==='hard').length;
    return lapses>=3 || (again>=2 && again+hard>=4);
  }

  function styles(){
    if(document.getElementById('rf2Style'))return;
    const st=document.createElement('style');st.id='rf2Style';st.textContent=`
      .rf2-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:13px 14px;margin:0 0 14px}.rf2-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.rf2-head b{font-size:13px}.rf2-muted{font-size:11px;color:var(--muted)}
      .rf2-track{height:7px;background:var(--surface2);border-radius:999px;overflow:hidden;margin-top:9px}.rf2-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--primary2));border-radius:999px}.rf2-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.rf2-box{background:var(--surface2);border:0;border-radius:13px;padding:10px;color:var(--ink);font-weight:800;text-align:left}.rf2-box small{display:block;color:var(--muted);font-weight:650;margin-top:3px;line-height:1.3}
      .rf2-topbtn{min-height:46px;border:0;border-radius:14px;padding:0 14px;background:#efedf8;color:var(--primary);font-weight:850}html[data-recall-theme="dark"] .rf2-topbtn{background:#312d4f;color:#ddd7ff}
      .rf2-status{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:10px;font-weight:850;margin:6px 5px 0 0}.rf2-ok{background:#e8f7ef;color:#11714b}.rf2-miss{background:#fff0f0;color:#a4313e}.rf2-unk{background:var(--surface2);color:var(--muted)}.rf2-leech{background:#fff2df;color:#8d5600}
      .rf2-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.rf2-actions button{min-height:35px;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:10px;padding:0 9px;font-size:11px;font-weight:800}.rf2-actions button.on{background:var(--primary);color:white;border-color:var(--primary)}
      .rf2-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}.rf2-tag{background:var(--surface2);color:var(--muted);padding:4px 7px;border-radius:999px;font-size:10px;font-weight:800}.rf2-filters{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 10px}.rf2-filters select{width:100%;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:12px;padding:10px}
      .rf2-health{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:10px}.rf2-health>div{background:var(--surface2);border-radius:14px;padding:11px}.rf2-health b{display:block;font-size:21px;color:var(--primary)}.rf2-list{display:grid;gap:8px;margin-top:10px}.rf2-list>div{background:var(--surface2);border-radius:12px;padding:10px;font-size:12px}.rf2-hfnow{background:var(--surface2);border-radius:18px;padding:18px;text-align:center;margin-top:12px}.rf2-hfnow strong{display:block;font-size:23px;color:var(--accent);margin:10px 0}.rf2-controls{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.rf2-controls button{min-height:48px;border:0;border-radius:14px;font-weight:850}.rf2-primary{background:var(--primary);color:white}.rf2-secondary{background:var(--surface2);color:var(--ink)}
      @media(max-width:430px){.rf2-grid,.rf2-filters,.rf2-controls{grid-template-columns:1fr}}
    `;document.head.appendChild(st);
  }

  function queueStats(id){
    const raw=baseCandidates(id,core.endOfDay(),core.selectedMode(id)).filter(x=>!x.card.suspended);
    const reviews=raw.filter(x=>!unseen(x.card)).length;
    const unique=[...new Set(raw.filter(x=>unseen(x.card)).map(x=>x.card.id))];
    const used=introducedToday(id),limit=newLimit(id),available=Math.min(Math.max(0,limit-used),unique.length);
    return {reviews,used,limit,available,waiting:Math.max(0,unique.length-available)};
  }

  function ensureHome(){
    const summary=document.querySelector('.summary');if(!summary)return;
    if(!document.getElementById('rf2Goal')){
      const el=document.createElement('section');el.id='rf2Goal';el.className='rf2-card';summary.insertAdjacentElement('afterend',el);
    }
    if(!document.getElementById('rf2Queue')){
      const el=document.createElement('section');el.id='rf2Queue';el.className='rf2-card';document.getElementById('rf2Goal').insertAdjacentElement('afterend',el);
    }
    const row=document.querySelector('#view-decks .sync-row');
    if(row&&!document.getElementById('rf2HealthBtn')){
      const a=document.createElement('button');a.id='rf2HealthBtn';a.className='rf2-topbtn';a.type='button';a.textContent='🩺 Saúde';a.onclick=()=>{core.showView('rf2-health');renderHealth();};row.appendChild(a);
      const b=document.createElement('button');b.id='rf2HandsBtn';b.className='rf2-topbtn';b.type='button';b.textContent='🎧 Hands-free';b.onclick=()=>{core.showView('rf2-hands');};row.appendChild(b);
    }
  }

  function renderHome(){
    ensureHome();const s=state(),goal=Number(s.settings.power.dailyGoal||20),done=core.todayStudyCount();
    const g=document.getElementById('rf2Goal');if(g)g.innerHTML=`<div class="rf2-head"><b>🎯 Meta diária</b><button id="rf2GoalEdit" class="rf2-topbtn" style="min-height:34px">${done}/${goal}</button></div><div class="rf2-track"><div class="rf2-fill" style="width:${Math.min(100,Math.round(done/goal*100))}%"></div></div>`;
    document.getElementById('rf2GoalEdit')?.addEventListener('click',()=>{const x=prompt('Quantas revisões por dia?',String(goal));if(x===null)return;s.settings.power.dailyGoal=Math.max(1,Math.min(500,Math.round(Number(x)||goal)));save();renderHome();});
    const q=document.getElementById('rf2Queue');if(q){const e=queueStats('en'),d=queueStats('de');q.innerHTML=`<div class="rf2-head"><div><b>Novas x revisões</b><div class="rf2-muted">Revisões primeiro; novas respeitam o limite diário.</div></div></div><div class="rf2-grid"><button class="rf2-box" data-limit="en">🇺🇸 ${e.used}/${e.limit} novas<small>${e.reviews} revisões · ${e.available} liberadas${e.waiting?` · ${e.waiting} aguardando`:''}</small></button><button class="rf2-box" data-limit="de">🇩🇪 ${d.used}/${d.limit} novas<small>${d.reviews} revisões · ${d.available} liberadas${d.waiting?` · ${d.waiting} aguardando`:''}</small></button></div>`;q.querySelectorAll('[data-limit]').forEach(btn=>btn.onclick=()=>{const id=btn.dataset.limit,v=newLimit(id),x=prompt(`Quantas frases novas de ${DECKS[id].name} por dia?`,String(v));if(x===null)return;s.settings.newCardLimits[id]=Math.max(0,Math.min(100,Math.round(Number(x)||0)));save();core.clearCurrentItem();core.render();});}
  }

  function audioId(card,id){const x=card.remoteId||'';return new RegExp(`^${id}-\\d+$`).test(x)?x:null;}
  function audioPath(card,id){const rid=audioId(card,id);return rid?`./audio/${id}/${encodeURIComponent(rid)}.caf`:null;}
  function audioCache(){try{return JSON.parse(localStorage.getItem(AUDIO_KEY))||{};}catch{return{};}}
  function audioState(card,id){const p=audioPath(card,id);if(!p)return'unknown';const x=audioCache()[p];return !x?'unknown':x.ok?'ok':'missing';}
  async function scanAudio(){
    const btn=document.getElementById('rf2Scan');if(btn){btn.disabled=true;btn.textContent='Verificando…';}
    const cache=audioCache(),jobs=[];
    for(const id of Object.keys(DECKS))for(const card of state().cards[id]||[]){const p=audioPath(card,id);if(p)jobs.push([p,card,id]);}
    let idx=0;await Promise.all(Array.from({length:Math.min(6,jobs.length||1)},async()=>{while(idx<jobs.length){const [p]=jobs[idx++];let ok=false;try{const r=await fetch(`${p}?health=${Date.now()}`,{method:'HEAD',cache:'no-store'});ok=r.ok;}catch{}cache[p]={ok,checkedAt:Date.now()};}}));
    localStorage.setItem(AUDIO_KEY,JSON.stringify(cache));localStorage.setItem(LAST_AUDIO_KEY,String(Date.now()));if(btn){btn.disabled=false;btn.textContent='↻ Verificar áudios';}renderHealth();core.renderLibrary();
  }

  function ensureViews(){
    const main=document.querySelector('main.app');
    if(!document.getElementById('view-rf2-health')){const v=document.createElement('section');v.id='view-rf2-health';v.className='view';v.innerHTML=`<div class="section"><div class="rf2-head"><h2>Saúde e sincronização</h2><button class="secondary-btn" id="rf2HealthBack">← Decks</button></div><p>Frases, áudios, favoritos, suspensões e cards problemáticos.</p><div id="rf2HealthSummary"></div><div class="sync-row" style="margin-top:12px"><button class="primary-btn" id="rf2Scan">↻ Verificar áudios</button><button class="secondary-btn" id="rf2Sync">↻ Sincronizar decks</button></div><div id="rf2Times" class="msg"></div></div><div class="section"><h2>⚠️ Frases difíceis</h2><div id="rf2Leeches" class="rf2-list"></div></div>`;main.appendChild(v);document.getElementById('rf2HealthBack').onclick=()=>core.showView('decks');document.getElementById('rf2Scan').onclick=scanAudio;document.getElementById('rf2Sync').onclick=async()=>{await core.syncAll(true);localStorage.setItem(LAST_SYNC_KEY,String(Date.now()));renderHealth();};}
    if(!document.getElementById('view-rf2-hands')){const v=document.createElement('section');v.id='view-rf2-hands';v.className='view';v.innerHTML=`<div class="section"><div class="rf2-head"><h2>🎧 Hands-free</h2><button class="secondary-btn" id="rf2HandsBack">← Decks</button></div><p>Modo contínuo para carro ou academia. Não altera o SRS.</p><div class="rf2-grid"><label>Deck<select id="rf2HfDeck" class="setting"><option value="en">🇺🇸 English</option><option value="de">🇩🇪 Deutsch</option></select></label><label>Fonte<select id="rf2HfSource" class="setting"><option value="due">Revisões de hoje</option><option value="favorites">Favoritos</option><option value="all">Todas as frases</option></select></label><label>Pausa<select id="rf2HfPause" class="setting"><option value="3">3 s</option><option value="5" selected>5 s</option><option value="7">7 s</option><option value="10">10 s</option></select></label><label>Repetir áudio<select id="rf2HfRepeats" class="setting"><option value="1">1x</option><option value="2" selected>2x</option></select></label></div><div class="toggle" style="margin-top:10px"><span>Falar tradução em português</span><input id="rf2HfPt" type="checkbox"></div><div class="rf2-hfnow"><span id="rf2HfLang" class="rf2-muted">Pronto</span><strong id="rf2HfPhrase">Toque em iniciar</strong><span id="rf2HfHint" class="rf2-muted"></span></div><div class="rf2-controls"><button class="rf2-primary" id="rf2HfStart">▶ Iniciar</button><button class="rf2-secondary" id="rf2HfStop">■ Parar</button></div></div>`;main.appendChild(v);document.getElementById('rf2HandsBack').onclick=()=>{stopHands();core.showView('decks');};document.getElementById('rf2HfStart').onclick=startHands;document.getElementById('rf2HfStop').onclick=stopHands;}
  }

  function renderHealth(){
    ensureViews();const cache=audioCache();let html='<div class="rf2-health">',leeches=[];
    for(const id of Object.keys(DECKS)){const cards=state().cards[id]||[];let ok=0,miss=0;for(const c of cards){const p=audioPath(c,id),x=p?cache[p]:null;if(x?.ok)ok++;else if(x&&!x.ok)miss++;if(isLeech(c))leeches.push([id,c]);}html+=`<div><b>${cards.length}</b><span>${DECKS[id].flag} ${DECKS[id].name}</span><div class="rf2-muted">🔊 ${ok} OK · ⚠️ ${miss} ausentes · ★ ${cards.filter(c=>c.favorite).length} · ⏸ ${cards.filter(c=>c.suspended).length}</div></div>`;}html+='</div>';document.getElementById('rf2HealthSummary').innerHTML=html;const list=document.getElementById('rf2Leeches');list.innerHTML=leeches.length?leeches.map(([id,c])=>`<div><b>${DECKS[id].flag} ${escapeHtml(c.front)}</b><br><span class="rf2-muted">${escapeHtml(c.back)}</span></div>`).join(''):'<div>Nenhuma frase problemática por enquanto.</div>';const fmt=k=>{const n=Number(localStorage.getItem(k)||0);return n?new Date(n).toLocaleString('pt-BR'):'ainda não';};document.getElementById('rf2Times').textContent=`Última verificação de áudio: ${fmt(LAST_AUDIO_KEY)} · Última sincronização: ${fmt(LAST_SYNC_KEY)}`;
  }

  function ensureLibraryFilters(){
    const list=document.getElementById('list');if(!list||document.getElementById('rf2Filters'))return;
    const f=document.createElement('div');f.id='rf2Filters';f.className='rf2-filters';f.innerHTML='<select id="rf2FavFilter"><option value="all">Todas as frases</option><option value="fav">★ Favoritas</option><option value="suspended">⏸ Suspensas</option><option value="leech">⚠️ Difíceis</option></select><select id="rf2TagFilter"><option value="">Todas as tags</option></select>';list.parentElement.insertBefore(f,list);f.querySelectorAll('select').forEach(x=>x.onchange=()=>core.renderLibrary());
  }
  function enhanceLibrary(){
    ensureLibraryFilters();const id=$('libraryDeck').value||core.selectedDeck(),cards=state().cards[id]||[];const tagSel=document.getElementById('rf2TagFilter');if(tagSel){const old=tagSel.value,tags=[...new Set(cards.flatMap(c=>c.tags||[]))].sort();tagSel.innerHTML='<option value="">Todas as tags</option>'+tags.map(t=>`<option value="${escapeHtml(t)}">#${escapeHtml(t)}</option>`).join('');tagSel.value=tags.includes(old)?old:'';}
    const fav=document.getElementById('rf2FavFilter')?.value||'all',tag=document.getElementById('rf2TagFilter')?.value||'';
    document.querySelectorAll('#list .item').forEach(row=>{const front=row.querySelector('.en')?.textContent||'',back=row.querySelector('.pt')?.textContent||'';const c=cards.find(x=>x.front===front&&x.back===back);if(!c)return;row.querySelector('.rf2-extra')?.remove();const ex=document.createElement('div');ex.className='rf2-extra';const a=audioState(c,id);ex.innerHTML=`<span class="rf2-status ${a==='ok'?'rf2-ok':a==='missing'?'rf2-miss':'rf2-unk'}">${a==='ok'?'🔊 Áudio OK':a==='missing'?'⚠️ Áudio ausente':'… Áudio não verificado'}</span>${isLeech(c)?'<span class="rf2-status rf2-leech">⚠️ Frase difícil</span>':''}<div class="rf2-tags">${(c.tags||[]).map(t=>`<span class="rf2-tag">#${escapeHtml(t)}</span>`).join('')}</div><div class="rf2-actions"><button data-a="fav" class="${c.favorite?'on':''}">${c.favorite?'★ Favorita':'☆ Favoritar'}</button><button data-a="suspend" class="${c.suspended?'on':''}">${c.suspended?'▶ Retomar':'⏸ Suspender'}</button><button data-a="tag">🏷 Tags</button></div>`;row.appendChild(ex);ex.querySelector('[data-a="fav"]').onclick=()=>{c.favorite=!c.favorite;save();core.renderLibrary();};ex.querySelector('[data-a="suspend"]').onclick=()=>{c.suspended=!c.suspended;save();core.clearCurrentItem();core.render();core.renderLibrary();};ex.querySelector('[data-a="tag"]').onclick=()=>{const x=prompt('Tags separadas por vírgula:',(c.tags||[]).join(', '));if(x===null)return;c.tags=[...new Set(x.split(',').map(v=>v.trim()).filter(Boolean))];save();core.renderLibrary();};const visible=(fav==='all'||(fav==='fav'&&c.favorite)||(fav==='suspended'&&c.suspended)||(fav==='leech'&&isLeech(c)))&&(!tag||(c.tags||[]).includes(tag));row.style.display=visible?'':'none';});
  }

  function updateCurrent(){
    const badge=document.getElementById('studyBadge');if(!badge)return;let btn=document.getElementById('rf2CurrentFav');if(!btn){btn=document.createElement('button');btn.id='rf2CurrentFav';btn.type='button';btn.className='rf2-topbtn';btn.style.cssText='min-height:34px;float:right;margin-left:8px';badge.insertAdjacentElement('afterend',btn);}const item=core.current();if(!item){btn.style.display='none';return;}btn.style.display='';btn.textContent=item.card.favorite?'★':'☆';btn.onclick=()=>{item.card.favorite=!item.card.favorite;save();updateCurrent();};
  }

  let hfRunning=false,hfToken=0,wake=null;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function playAudio(card,id,rate=1){const p=audioPath(card,id);if(p){try{await new Promise((resolve,reject)=>{const a=new Audio(`${p}?hf=2`);a.playbackRate=rate;a.onended=resolve;a.onerror=reject;a.play().catch(reject);});return;}catch{}}core.speakText(card.front,id,rate);await sleep(Math.max(1800,Math.min(6500,card.front.length*70)));}
  async function speakPt(text){try{await new Promise(resolve=>{const u=new SpeechSynthesisUtterance(text);u.lang='pt-BR';u.rate=1;u.onend=resolve;u.onerror=resolve;speechSynthesis.speak(u);setTimeout(resolve,7000);});}catch{}}
  function handCards(){const id=document.getElementById('rf2HfDeck').value,src=document.getElementById('rf2HfSource').value,all=state().cards[id]||[];if(src==='favorites')return [id,all.filter(c=>c.favorite&&!c.suspended)];if(src==='all')return[id,all.filter(c=>!c.suspended)];const seen=new Set(),cards=[];for(const x of core.dueNow(id)){if(!x.card.suspended&&!seen.has(x.card.id)){seen.add(x.card.id);cards.push(x.card);}}return[id,cards];}
  async function startHands(){stopHands();hfRunning=true;const token=++hfToken;try{wake=await navigator.wakeLock?.request('screen');}catch{}const [id,cards]=handCards();if(!cards.length){document.getElementById('rf2HfPhrase').textContent='Nenhuma frase nesta seleção.';hfRunning=false;return;}const pause=Number(document.getElementById('rf2HfPause').value)*1000,repeats=Number(document.getElementById('rf2HfRepeats').value),pt=document.getElementById('rf2HfPt').checked;let i=0;while(hfRunning&&token===hfToken){const c=cards[i%cards.length];document.getElementById('rf2HfLang').textContent=`${DECKS[id].flag} ${DECKS[id].name} · ${i%cards.length+1}/${cards.length}`;document.getElementById('rf2HfPhrase').textContent=c.front;document.getElementById('rf2HfHint').textContent='Repita em voz alta durante a pausa.';for(let n=0;n<repeats&&hfRunning;n++){await playAudio(c,id);await sleep(500);}if(pt&&hfRunning){await speakPt(c.back);await sleep(400);}await sleep(pause);i++;}}
  function stopHands(){hfRunning=false;hfToken++;try{speechSynthesis.cancel();}catch{}try{wake?.release();}catch{}wake=null;}

  const baseRenderLibrary=core.getRenderLibrary();core.setRenderLibrary(function(){const r=baseRenderLibrary();enhanceLibrary();return r;});
  const baseRenderReview=core.getRenderReview();core.setRenderReview(function(){const r=baseRenderReview();updateCurrent();return r;});
  const baseRender=core.getRender();core.setRender(function(){const r=baseRender();renderHome();return r;});
  const baseSync=core.getSyncAll();core.setSyncAll(async function(show=true){const ok=await baseSync(show);if(ok)localStorage.setItem(LAST_SYNC_KEY,String(Date.now()));return ok;});

  ensureState();styles();ensureViews();ensureHome();renderHome();updateCurrent();
  if(core.getCurrentView()==='library')core.renderLibrary();
})();