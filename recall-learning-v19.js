(() => {
  'use strict';
  if (window.__recallLearningV19) return;
  const core = window.recallCore;
  if (!core) return;
  window.__recallLearningV19 = true;

  const VERSION = '19.0';
  const DECKS = core.DECKS;
  const state = () => core.getState();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const FAILURE_REASONS = [
    ['vocabulary','Vocabulário'],
    ['grammar','Gramática'],
    ['pronunciation','Pronúncia'],
    ['memory','Não lembrei da frase'],
    ['confused','Confundi com outra']
  ];

  const STOP = {
    en:new Set(('a an and are as at be been being but by can could did do does for from had has have he her here him his how i if in into is it its me my of on or our she should so that the their them then there they this to too us was we were what when where which who why will with would you your about after before more most some such than very just also still first main one').split(/\s+/)),
    de:new Set(('aber als am an auch auf aus bei bin bis bist da das dass dein deine dem den der die ein eine einem einen einer er es fur für hat haben ich im in ist ja mit nicht noch oder sein seine sind sie so und uns von war was wenn wie wir wo zu zum zur du ihr ihre mein meine mich mir sich').split(/\s+/))
  };

  function save(){ core.save(); }
  function cards(deckId){ return state().cards?.[deckId] || []; }
  function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'').replace(/[^a-z0-9äöüß\s-]/gi,' ').replace(/\s+/g,' ').trim(); }
  function tokenise(s){ return norm(s).split(' ').filter(Boolean); }

  function injectStyles(){
    if(document.getElementById('rf19Style')) return;
    const st=document.createElement('style');
    st.id='rf19Style';
    st.textContent=`
      .rf19-sheet{position:fixed;inset:0;z-index:9999;background:rgba(12,17,27,.42);display:flex;align-items:flex-end;justify-content:center;padding:18px;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
      .rf19-sheet-card{width:min(560px,100%);background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.20)}
      .rf19-sheet-card h3{font-size:16px;margin:0 0 5px}.rf19-sheet-card p{font-size:11px;color:var(--muted);margin:0 0 11px;line-height:1.4}
      .rf19-reasons{display:grid;grid-template-columns:1fr 1fr;gap:7px}.rf19-reason{min-height:44px;border:1px solid var(--line);background:var(--surface2);color:var(--ink);border-radius:11px;font-size:11px;font-weight:800;padding:7px}.rf19-skip{width:100%;margin-top:7px;min-height:38px;border:0;background:transparent;color:var(--muted);font-size:10.5px;font-weight:750}
      .rf19-vocab-tools{display:grid;grid-template-columns:120px 1fr;gap:8px;margin:10px 0}.rf19-vocab-list{display:grid;gap:8px}.rf19-vocab-item{border:1px solid var(--line);background:var(--surface);border-radius:13px;padding:10px 11px}.rf19-vocab-head{display:flex;justify-content:space-between;gap:9px;align-items:center}.rf19-vocab-term{font-size:13px;font-weight:850;color:var(--ink)}.rf19-vocab-count{font-size:9px;font-weight:850;color:var(--primary);background:var(--surface2);border-radius:999px;padding:4px 7px}.rf19-vocab-examples{display:none;margin-top:8px;padding-top:8px;border-top:1px solid var(--line);font-size:10.5px;line-height:1.45;color:var(--muted)}.rf19-vocab-item.open .rf19-vocab-examples{display:block}.rf19-vocab-examples div+div{margin-top:5px}
      .rf19-type-title{font-size:10px;text-transform:uppercase;letter-spacing:.11em;color:var(--muted);font-weight:850;margin:13px 1px 7px}.rf19-error-summary{border:1px solid var(--line);background:var(--surface2);border-radius:12px;padding:10px}.rf19-error-row{display:flex;justify-content:space-between;gap:8px;font-size:10.5px;padding:4px 0}.rf19-error-row b{color:var(--ink)}
      .rf19-links{display:grid;gap:7px}.rf19-link{border:1px solid var(--line);background:var(--surface2);border-radius:12px;padding:9px}.rf19-link-top{display:flex;justify-content:space-between;gap:8px;align-items:center}.rf19-link b{font-size:11px}.rf19-link code{display:block;font-size:9px;color:var(--muted);word-break:break-all;margin-top:5px}.rf19-link button{border:1px solid var(--line);background:var(--surface);color:var(--primary);border-radius:9px;min-height:30px;padding:0 8px;font-size:9.5px;font-weight:800}
      @media(max-width:430px){.rf19-reasons{grid-template-columns:1fr}.rf19-vocab-tools{grid-template-columns:105px 1fr}}
    `;
    document.head.appendChild(st);
  }

  // ---------- 5. Why did I miss it? ----------
  function persistFailure(snapshot, reason){
    const s=state();
    const card=(s.cards?.[snapshot.deckId]||[]).find(c=>c.id===snapshot.cardId);
    if(card){
      card.failureReasons ||= {};
      card.failureReasons[reason]=Number(card.failureReasons[reason]||0)+1;
      card.lastFailureReason=reason;
      card.lastFailureAt=Date.now();
    }
    const log=[...(s.reviewLog||[])].reverse().find(x=>x.id===snapshot.cardId && x.rating==='again' && (!snapshot.direction || x.direction===snapshot.direction));
    if(log) log.failureReason=reason;
    save();
    renderFailureSummary();
  }

  function askFailure(snapshot){
    document.getElementById('rf19FailureSheet')?.remove();
    const sheet=document.createElement('div');
    sheet.id='rf19FailureSheet';sheet.className='rf19-sheet';
    sheet.innerHTML=`<div class="rf19-sheet-card" role="dialog" aria-modal="true"><h3>Por que você não lembrou?</h3><p>Opcional. Isso não altera o SRS; serve para identificar seu padrão de dificuldade.</p><div class="rf19-reasons">${FAILURE_REASONS.map(([k,l])=>`<button class="rf19-reason" data-reason="${k}">${l}</button>`).join('')}</div><button class="rf19-skip" data-reason="">Agora não</button></div>`;
    document.body.appendChild(sheet);
    const close=()=>sheet.remove();
    sheet.addEventListener('click',e=>{if(e.target===sheet)close();});
    sheet.querySelectorAll('[data-reason]').forEach(b=>b.onclick=()=>{const r=b.dataset.reason;if(r)persistFailure(snapshot,r);close();});
  }

  const baseRate=core.getRateCard?.();
  if(baseRate){
    core.setRateCard(function(kind){
      const item=core.current?.();
      const snapshot=item?{cardId:item.card.id,deckId:core.selectedDeck(),direction:item.direction}:null;
      const result=baseRate(kind);
      if(kind==='again'&&snapshot){
        if(result&&typeof result.then==='function') result.finally(()=>setTimeout(()=>askFailure(snapshot),40));
        else setTimeout(()=>askFailure(snapshot),40);
      }
      return result;
    });
  }

  function failureTotals(){
    const out={}; for(const [k] of FAILURE_REASONS)out[k]=0;
    for(const deckId of Object.keys(DECKS))for(const c of cards(deckId))for(const [k,n] of Object.entries(c.failureReasons||{}))out[k]=(out[k]||0)+Number(n||0);
    return out;
  }
  function renderFailureSummary(){
    const dash=document.getElementById('rf18Dashboard');if(!dash)return;
    let box=document.getElementById('rf19FailureSummary');
    const totals=failureTotals(),sum=Object.values(totals).reduce((a,b)=>a+b,0);
    if(!box){box=document.createElement('div');box.id='rf19FailureSummary';box.className='rf19-error-summary';dash.appendChild(box);}
    if(!sum){box.innerHTML='<div class="rf2-head"><b>Por que eu erro?</b><span class="rf18-small">sem dados ainda</span></div>';return;}
    const labels=Object.fromEntries(FAILURE_REASONS);
    const ranked=Object.entries(totals).filter(([,n])=>n).sort((a,b)=>b[1]-a[1]);
    box.innerHTML=`<div class="rf2-head"><b>Por que eu erro?</b><span class="rf18-small">${sum} registro(s)</span></div>${ranked.map(([k,n])=>`<div class="rf19-error-row"><span>${esc(labels[k]||k)}</span><b>${n} · ${Math.round(n/sum*100)}%</b></div>`).join('')}`;
  }

  // ---------- 7. Recurring vocabulary ----------
  function vocabulary(deckId){
    const stop=STOP[deckId]||new Set(), wordMap=new Map(), bigramMap=new Map();
    for(const card of cards(deckId).filter(c=>!c.suspended)){
      const toks=tokenise(card.front);
      const unique=new Set(toks.filter(t=>t.length>=3&&!stop.has(t)&&!/^\d+$/.test(t)));
      for(const t of unique){
        const x=wordMap.get(t)||{term:t,count:0,cards:[]};x.count++;x.cards.push(card);wordMap.set(t,x);
      }
      const seenBi=new Set();
      for(let i=0;i<toks.length-1;i++){
        const a=toks[i],b=toks[i+1];if(stop.has(a)&&stop.has(b))continue;if(a.length<2||b.length<2)continue;
        const term=`${a} ${b}`;if(seenBi.has(term))continue;seenBi.add(term);
        const x=bigramMap.get(term)||{term,count:0,cards:[]};x.count++;x.cards.push(card);bigramMap.set(term,x);
      }
    }
    const words=[...wordMap.values()].filter(x=>x.count>=3).sort((a,b)=>b.count-a.count||a.term.localeCompare(b.term)).slice(0,45);
    const chunks=[...bigramMap.values()].filter(x=>x.count>=2).sort((a,b)=>b.count-a.count||a.term.localeCompare(b.term)).slice(0,35);
    return {words,chunks};
  }

  function ensureVocabView(){
    const main=document.querySelector('main.app');if(!main)return;
    if(!document.getElementById('view-rf19-vocab')){
      const v=document.createElement('section');v.id='view-rf19-vocab';v.className='view';
      v.innerHTML=`<div class="section"><div class="rf2-head"><div><h2 style="margin:0">Vocabulário recorrente</h2><div class="rf2-muted">Palavras e chunks que aparecem em várias frases</div></div><button id="rf19VocabBack" class="secondary-btn">← Voltar</button></div><div class="rf19-vocab-tools"><select id="rf19VocabDeck" class="setting"><option value="en">🇺🇸 English</option><option value="de">🇩🇪 Deutsch</option></select><input id="rf19VocabSearch" type="search" placeholder="Filtrar palavra ou chunk"></div><div id="rf19VocabList"></div></div>`;
      main.appendChild(v);
      document.getElementById('rf19VocabBack').onclick=()=>core.showView('rf18-progress');
      document.getElementById('rf19VocabDeck').onchange=renderVocab;
      document.getElementById('rf19VocabSearch').oninput=renderVocab;
    }
    const progress=document.getElementById('view-rf18-progress');
    const back=document.getElementById('rf18Back');
    if(progress&&back&&!document.getElementById('rf19VocabBtn')){
      const b=document.createElement('button');b.id='rf19VocabBtn';b.className='secondary-btn';b.textContent='🔤 Vocabulário';b.onclick=()=>openVocab();back.insertAdjacentElement('beforebegin',b);
    }
  }

  function vocabItem(x){
    return `<div class="rf19-vocab-item" data-term="${esc(x.term)}"><div class="rf19-vocab-head"><span class="rf19-vocab-term">${esc(x.term)}</span><span class="rf19-vocab-count">${x.count} frases</span></div><div class="rf19-vocab-examples">${x.cards.slice(0,8).map(c=>`<div>• ${esc(c.front)}</div>`).join('')}</div></div>`;
  }
  function renderVocab(){
    ensureVocabView();const deckId=document.getElementById('rf19VocabDeck')?.value||'en',q=norm(document.getElementById('rf19VocabSearch')?.value||''),data=vocabulary(deckId),box=document.getElementById('rf19VocabList');if(!box)return;
    const w=data.words.filter(x=>!q||x.term.includes(q)),c=data.chunks.filter(x=>!q||x.term.includes(q));
    box.innerHTML=`<div class="rf19-type-title">Palavras recorrentes · ${w.length}</div><div class="rf19-vocab-list">${w.length?w.map(vocabItem).join(''):'<div class="rf2-muted">Nenhuma recorrência encontrada.</div>'}</div><div class="rf19-type-title">Chunks recorrentes · ${c.length}</div><div class="rf19-vocab-list">${c.length?c.map(vocabItem).join(''):'<div class="rf2-muted">Nenhum chunk recorrente encontrado.</div>'}</div>`;
    box.querySelectorAll('.rf19-vocab-item').forEach(el=>el.onclick=()=>el.classList.toggle('open'));
  }
  function openVocab(deckId=core.selectedDeck()){
    ensureVocabView();const sel=document.getElementById('rf19VocabDeck');if(sel&&DECKS[deckId])sel.value=deckId;core.showView('rf19-vocab');renderVocab();
  }

  // ---------- 12. Deep links for iPhone Shortcuts ----------
  function baseUrl(){ return `${location.origin}${location.pathname}`; }
  function deepLinks(){
    const b=baseUrl();
    return [
      ['Weak spots · English',`${b}?open=weak&deck=en`],
      ['Chunks · English',`${b}?open=chunks&deck=en`],
      ['Hands-free · English',`${b}?open=handsfree&deck=en&mode=recognition`],
      ['Interview',`${b}?open=interview`],
      ['Deutsch A1',`${b}?open=cefr&deck=de&level=A1`],
      ['Vocabulário · English',`${b}?open=vocab&deck=en`]
    ];
  }
  async function copyText(text,button){
    try{await navigator.clipboard.writeText(text);const old=button.textContent;button.textContent='Copiado';setTimeout(()=>button.textContent=old,1000);}catch{prompt('Copie o link:',text);}
  }
  function ensureShortcutSection(){
    const view=document.getElementById('view-settings');if(!view||document.getElementById('rf19ShortcutLinks'))return;
    const s=document.createElement('div');s.id='rf19ShortcutLinks';s.className='section';
    s.innerHTML=`<h2>Atalhos do iPhone</h2><p>Use a ação “Abrir URLs” no Shortcuts. O Recall abre diretamente na área configurada.</p><div class="rf19-links">${deepLinks().map(([name,url])=>`<div class="rf19-link"><div class="rf19-link-top"><b>${esc(name)}</b><button data-copy="${esc(url)}">Copiar link</button></div><code>${esc(url)}</code></div>`).join('')}</div>`;
    view.appendChild(s);s.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>copyText(b.dataset.copy,b));
  }

  function cleanDeepLink(){
    try{history.replaceState({},'',location.pathname+location.hash);}catch{}
  }
  function ensureSessionScreen(){
    if(document.getElementById('view-rf3-session'))return true;
    const b=document.getElementById('rf3SessionBtn');if(!b)return false;b.click();return false;
  }
  function routeDeepLink(){
    const p=new URLSearchParams(location.search),open=(p.get('open')||'').toLowerCase();if(!open)return true;
    const deck=DECKS[p.get('deck')]?p.get('deck'):'en';
    if(open==='vocab'){openVocab(deck);cleanDeepLink();return true;}
    if(open==='review'){core.startSession?.(deck);cleanDeepLink();return true;}
    if(open==='handsfree'){
      const btn=document.getElementById('rf2HandsBtn');if(!btn)return false;btn.click();
      const d=document.getElementById('rf2HfDeck'),m=document.getElementById('rf2HfMode'),src=document.getElementById('rf2HfSource');
      if(d)d.value=deck;if(m){m.value=p.get('mode')==='production'?'production':'recognition';m.dispatchEvent(new Event('change',{bubbles:true}));}if(src&&p.get('source'))src.value=p.get('source');
      cleanDeepLink();return true;
    }
    if(open==='interview'){
      if(!ensureSessionScreen())return false;const b=document.getElementById('rf16Interview');if(!b)return false;b.click();cleanDeepLink();return true;
    }
    if(open==='weak'||open==='chunks'){
      if(!ensureSessionScreen())return false;const d=document.getElementById('rf3Deck');if(d)d.value=deck;const b=document.getElementById(open==='weak'?'rf16Weak':'rf16Chunks');if(!b)return false;b.click();cleanDeepLink();return true;
    }
    if(open==='cefr'){
      if(!ensureSessionScreen())return false;
      const level=/^(A1|A2|B1|B2)$/i.test(p.get('level')||'')?p.get('level').toUpperCase():'A1';
      const d=document.getElementById('rf3Deck'),type=document.getElementById('rf3Type'),source=document.getElementById('rf3Source'),mode=document.getElementById('rf3Mode'),size=document.getElementById('rf3Size'),tag=document.getElementById('rf3Tag'),msg=document.getElementById('rf3SessionMsg');
      if(!(d&&type&&source&&mode&&size&&tag))return false;
      d.value=deck;type.value='cram';source.value='tag';mode.value='production';size.value='20';tag.value=`CEFR-${level}`;if(msg)msg.textContent=`Sessão ${DECKS[deck].name} ${level} preparada pelo atalho. Toque em Iniciar sessão.`;
      cleanDeepLink();return true;
    }
    cleanDeepLink();return true;
  }

  function decorate(){ensureVocabView();ensureShortcutSection();renderFailureSummary();}
  injectStyles();decorate();

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#rf18ProgressBtn,#settingsBtn,[data-view="settings"]'))setTimeout(decorate,50);
  },true);

  let attempts=0;
  const timer=setInterval(()=>{
    decorate();
    const routed=routeDeepLink();
    if(routed&&++attempts>8)clearInterval(timer);
    else if(++attempts>60)clearInterval(timer);
  },180);

  document.documentElement.dataset.recallAppVersion=VERSION;
})();