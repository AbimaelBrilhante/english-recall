(() => {
  'use strict';

  const AUDIO_CACHE_KEY = 'recallAudioHealthV1';
  const LAST_SYNC_KEY = 'recallLastSyncV1';
  const LAST_AUDIO_SCAN_KEY = 'recallLastAudioScanV1';
  const AUDIO_TTL = 24 * 60 * 60 * 1000;
  const $pf = id => document.getElementById(id);

  function ensurePowerState() {
    state.settings ||= {};
    state.settings.power ||= {};
    const p = state.settings.power;
    if (!Number.isFinite(Number(p.dailyGoal)) || Number(p.dailyGoal) < 1) p.dailyGoal = 20;
    p.dailyGoal = Number(p.dailyGoal);
    for (const deckId of Object.keys(DECKS)) {
      for (const card of (state.cards[deckId] || [])) {
        if (typeof card.favorite !== 'boolean') card.favorite = false;
        if (typeof card.suspended !== 'boolean') card.suspended = false;
        if (!Array.isArray(card.tags)) card.tags = [];
      }
    }
    save();
  }

  function injectStyles() {
    if (document.getElementById('powerFeaturesStyle')) return;
    const style = document.createElement('style');
    style.id = 'powerFeaturesStyle';
    style.textContent = `
      .pf-goal{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:12px 14px;margin:-2px 0 14px}
      .pf-goal-head{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;color:var(--muted);font-weight:800}
      .pf-goal-head b{color:var(--ink);font-size:13px}.pf-goal-edit{border:0;background:transparent;color:var(--primary);font-weight:900;padding:4px 0}
      .pf-goal-track{height:7px;background:var(--surface2);border-radius:999px;overflow:hidden;margin-top:8px}.pf-goal-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--primary2));border-radius:999px;transition:width .25s ease}
      .pf-toolbar-btn{min-height:46px;border-radius:14px;padding:0 14px;font-weight:800;border:0;background:#efedf8;color:var(--primary)}
      html[data-recall-theme="dark"] .pf-toolbar-btn{background:#312d4f;color:#d7d0ff}
      .pf-section-title{display:flex;align-items:center;justify-content:space-between;gap:10px}.pf-section-title h2{margin:0}.pf-small{font-size:11px;color:var(--muted)}
      .pf-health-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:12px}.pf-health-card{background:var(--surface2);border-radius:15px;padding:12px}.pf-health-card b{display:block;font-size:22px;color:var(--primary)}.pf-health-card span{font-size:11px;color:var(--muted)}
      .pf-status{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:900;margin-top:7px}.pf-status.ok{background:#e8f7ef;color:#11714b}.pf-status.missing{background:#fff0f0;color:#a4313e}.pf-status.unknown{background:var(--surface2);color:var(--muted)}
      html[data-recall-theme="dark"] .pf-status.ok{background:#18392c;color:#8ee0b9}html[data-recall-theme="dark"] .pf-status.missing{background:#43242b;color:#ffadb8}
      .pf-leech{display:inline-flex;margin-top:7px;background:#fff2df;color:#9a5a00;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:900}html[data-recall-theme="dark"] .pf-leech{background:#4a3520;color:#ffd28f}
      .pf-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.pf-tag{background:var(--surface2);color:var(--muted);border-radius:999px;padding:4px 8px;font-size:10px;font-weight:800}
      .pf-library-filters{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 10px}.pf-library-filters select{width:100%;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:12px;padding:10px;font-size:13px}
      .pf-item-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.pf-item-actions button{min-height:36px;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:var(--ink);padding:0 10px;font-size:12px;font-weight:800}.pf-item-actions button.on{background:var(--primary);color:#fff;border-color:var(--primary)}
      .pf-current-fav{float:right;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:12px;min-width:40px;height:36px;font-size:18px;margin-top:-4px}.pf-current-tags{clear:both;display:flex;gap:5px;flex-wrap:wrap;margin:6px 2px 0}
      .pf-list{display:grid;gap:8px;margin-top:10px}.pf-list-item{background:var(--surface2);border-radius:13px;padding:10px 11px;font-size:12px;line-height:1.35}.pf-list-item b{display:block;color:var(--ink);margin-bottom:2px}.pf-list-item span{color:var(--muted)}
      .pf-hf-now{background:var(--surface2);border-radius:18px;padding:18px;margin-top:12px;text-align:center}.pf-hf-now .lang{font-size:11px;color:var(--muted);font-weight:900;text-transform:uppercase;letter-spacing:.08em}.pf-hf-now .phrase{font-size:24px;line-height:1.2;font-weight:850;color:var(--accent);margin:12px 0}.pf-hf-now .hint{font-size:12px;color:var(--muted)}
      .pf-hf-controls{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.pf-hf-controls button{min-height:48px;border:0;border-radius:14px;font-weight:900}.pf-hf-start{background:var(--primary);color:#fff}.pf-hf-stop{background:var(--surface2);color:var(--ink)}
      .pf-inline-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.pf-inline-grid .field{margin-bottom:10px}
      @media(max-width:430px){.pf-health-grid{grid-template-columns:1fr 1fr}.pf-library-filters,.pf-inline-grid{grid-template-columns:1fr}.pf-hf-now .phrase{font-size:21px}}
    `;
    document.head.appendChild(style);
  }

  function audioCache() {
    try { return JSON.parse(localStorage.getItem(AUDIO_CACHE_KEY)) || {}; } catch (_) { return {}; }
  }
  function saveAudioCache(cache) { localStorage.setItem(AUDIO_CACHE_KEY, JSON.stringify(cache)); }
  function audioId(card, deckId) {
    const candidate = card?.remoteId || card?.id || '';
    if (new RegExp(`^${deckId}-\\d+$`).test(candidate)) return candidate;
    const m = String(candidate).match(new RegExp(`(${deckId}-\\d+)$`));
    return m ? m[1] : null;
  }
  function audioPath(card, deckId) {
    const id = audioId(card, deckId);
    return id ? `./audio/${deckId}/${encodeURIComponent(id)}.caf` : null;
  }
  function cachedAudioStatus(card, deckId) {
    const path = audioPath(card, deckId);
    if (!path) return { state: 'unknown', path: null };
    const hit = audioCache()[path];
    if (!hit) return { state: 'unknown', path };
    return { state: hit.ok ? 'ok' : 'missing', path, checkedAt: hit.checkedAt };
  }
  async function checkAudio(card, deckId, force=false) {
    const path = audioPath(card, deckId);
    if (!path) return null;
    const cache = audioCache();
    const hit = cache[path];
    if (!force && hit && Date.now() - Number(hit.checkedAt || 0) < AUDIO_TTL) return hit.ok;
    let ok = false;
    try {
      const res = await fetch(`${path}?health=${Date.now()}`, { method: 'HEAD', cache: 'no-store' });
      ok = res.ok;
    } catch (_) { ok = false; }
    cache[path] = { ok, checkedAt: Date.now() };
    saveAudioCache(cache);
    return ok;
  }
  async function runPool(tasks, limit=6) {
    let index = 0;
    const workers = Array.from({ length: Math.min(limit, tasks.length || 1) }, async () => {
      while (index < tasks.length) {
        const i = index++;
        try { await tasks[i](); } catch (_) {}
      }
    });
    await Promise.all(workers);
  }
  async function scanAudio(force=true) {
    const btn = $pf('pfAudioScan');
    if (btn) { btn.disabled = true; btn.textContent = 'Verificando…'; }
    const tasks = [];
    for (const deckId of Object.keys(DECKS)) {
      for (const card of (state.cards[deckId] || [])) {
        if (!audioPath(card, deckId)) continue;
        tasks.push(() => checkAudio(card, deckId, force));
      }
    }
    await runPool(tasks, 6);
    localStorage.setItem(LAST_AUDIO_SCAN_KEY, String(Date.now()));
    if (btn) { btn.disabled = false; btn.textContent = '↻ Verificar áudios'; }
    renderHealth();
    if (currentView === 'library') renderLibrary();
  }

  function isLeech(card) {
    const lapses = Number(card?.schedules?.recognition?.lapses || 0) + Number(card?.schedules?.production?.lapses || 0);
    const logs = (state.reviewLog || []).filter(r => r.id === card.id).slice(-10);
    const again = logs.filter(r => r.rating === 'again').length;
    const hard = logs.filter(r => r.rating === 'hard').length;
    return lapses >= 3 || (again >= 2 && again + hard >= 4);
  }

  function ensureGoalUI() {
    if ($pf('pfGoal')) return;
    const summary = document.querySelector('.summary');
    if (!summary) return;
    const el = document.createElement('section');
    el.id = 'pfGoal';
    el.className = 'pf-goal';
    el.innerHTML = `<div class="pf-goal-head"><span>Meta diária</span><span><b id="pfGoalText">0/20</b> · <button id="pfGoalEdit" class="pf-goal-edit" type="button">editar</button></span></div><div class="pf-goal-track"><div id="pfGoalFill" class="pf-goal-fill"></div></div>`;
    summary.insertAdjacentElement('afterend', el);
    $pf('pfGoalEdit').addEventListener('click', () => {
      const current = state.settings.power.dailyGoal || 20;
      const raw = prompt('Quantas revisões por dia?', String(current));
      if (raw === null) return;
      const n = Math.max(1, Math.min(500, Math.round(Number(raw) || current)));
      state.settings.power.dailyGoal = n;
      save();
      updateGoal();
    });
  }
  function updateGoal() {
    ensureGoalUI();
    const goal = Number(state.settings.power.dailyGoal || 20);
    const done = todayStudyCount();
    if ($pf('pfGoalText')) $pf('pfGoalText').textContent = `${done}/${goal}`;
    if ($pf('pfGoalFill')) $pf('pfGoalFill').style.width = `${Math.min(100, Math.round(done / goal * 100))}%`;
  }

  function ensureTopButtons() {
    const row = document.querySelector('#view-decks .sync-row');
    if (!row) return;
    if (!$pf('pfHealthBtn')) {
      const b = document.createElement('button'); b.id = 'pfHealthBtn'; b.type = 'button'; b.className = 'pf-toolbar-btn'; b.textContent = '🩺 Saúde';
      b.addEventListener('click', () => { showView('health'); renderHealth(); if (shouldBackgroundScan()) scanAudio(false); });
      row.appendChild(b);
    }
    if (!$pf('pfHandsfreeBtn')) {
      const b = document.createElement('button'); b.id = 'pfHandsfreeBtn'; b.type = 'button'; b.className = 'pf-toolbar-btn'; b.textContent = '🎧 Hands-free';
      b.addEventListener('click', () => { showView('handsfree'); renderHandsfreeSettings(); });
      row.appendChild(b);
    }
  }

  function ensureViews() {
    if (!$pf('view-health')) {
      const sec = document.createElement('section');
      sec.id = 'view-health'; sec.className = 'view';
      sec.innerHTML = `
        <div class="section">
          <div class="pf-section-title"><h2>Saúde e sincronização</h2><button id="pfHealthBack" class="secondary-btn" type="button">← Decks</button></div>
          <p>Confere frases, áudios gravados, favoritos, suspensões e cards problemáticos.</p>
          <div id="pfHealthSummary"></div>
          <div class="sync-row" style="margin-top:12px"><button id="pfAudioScan" class="primary-btn" type="button">↻ Verificar áudios</button><button id="pfSyncNow" class="secondary-btn" type="button">↻ Sincronizar decks</button></div>
          <div id="pfHealthTimes" class="msg"></div>
        </div>
        <div class="section"><h2>⚠️ Frases difíceis</h2><p>Cards com vários esquecimentos ou dificuldade recorrente.</p><div id="pfLeechList" class="pf-list"></div></div>`;
      document.querySelector('main.app').appendChild(sec);
      $pf('pfHealthBack').addEventListener('click', () => showView('decks'));
      $pf('pfAudioScan').addEventListener('click', () => scanAudio(true));
      $pf('pfSyncNow').addEventListener('click', async () => { await syncAll(true); localStorage.setItem(LAST_SYNC_KEY, String(Date.now())); renderHealth(); });
    }

    if (!$pf('view-handsfree')) {
      const sec = document.createElement('section');
      sec.id = 'view-handsfree'; sec.className = 'view';
      sec.innerHTML = `
        <div class="section">
          <div class="pf-section-title"><h2>🎧 Hands-free</h2><button id="pfHfBack" class="secondary-btn" type="button">← Decks</button></div>
          <p>Modo contínuo para carro ou academia. Não altera a repetição espaçada.</p>
          <div class="pf-inline-grid">
            <div class="field"><label>Deck</label><select id="pfHfDeck" class="setting"><option value="en">🇺🇸 English</option><option value="de">🇩🇪 Deutsch</option></select></div>
            <div class="field"><label>Fonte</label><select id="pfHfSource" class="setting"><option value="due">Revisões de hoje</option><option value="favorites">Favoritos</option><option value="all">Todas as frases</option></select></div>
            <div class="field"><label>Pausa para repetir</label><select id="pfHfPause" class="setting"><option value="3">3 segundos</option><option value="5" selected>5 segundos</option><option value="7">7 segundos</option><option value="10">10 segundos</option></select></div>
            <div class="field"><label>Repetições do áudio</label><select id="pfHfRepeats" class="setting"><option value="1">1 vez</option><option value="2" selected>2 vezes</option></select></div>
          </div>
          <div class="toggle"><span>Falar tradução em português</span><input id="pfHfTranslation" type="checkbox"></div>
          <div id="pfHfNow" class="pf-hf-now"><div class="lang">Pronto</div><div class="phrase">Escolha as opções e inicie</div><div class="hint">O app mantém a tela ativa quando o iPhone permitir.</div></div>
          <div class="pf-hf-controls"><button id="pfHfStart" class="pf-hf-start" type="button">▶ Iniciar</button><button id="pfHfStop" class="pf-hf-stop" type="button" disabled>■ Parar</button></div>
        </div>`;
      document.querySelector('main.app').appendChild(sec);
      $pf('pfHfBack').addEventListener('click', () => { stopHandsfree(); showView('decks'); });
      $pf('pfHfStart').addEventListener('click', startHandsfree);
      $pf('pfHfStop').addEventListener('click', stopHandsfree);
    }
  }

  function formatTs(ts) {
    if (!ts) return 'nunca';
    try { return new Date(Number(ts)).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }); } catch (_) { return '—'; }
  }
  function shouldBackgroundScan() {
    const last = Number(localStorage.getItem(LAST_AUDIO_SCAN_KEY) || 0);
    return Date.now() - last > AUDIO_TTL;
  }
  function deckHealth(deckId) {
    const cards = state.cards[deckId] || [];
    let ok=0, missing=0, unknown=0, fav=0, suspended=0, leeches=0;
    for (const c of cards) {
      const st = cachedAudioStatus(c, deckId).state;
      if (st==='ok') ok++; else if (st==='missing') missing++; else unknown++;
      if (c.favorite) fav++;
      if (c.suspended) suspended++;
      if (isLeech(c)) leeches++;
    }
    return { cards: cards.length, ok, missing, unknown, fav, suspended, leeches };
  }
  function renderHealth() {
    ensureViews();
    const sum = $pf('pfHealthSummary');
    if (!sum) return;
    let html = '';
    for (const deckId of Object.keys(DECKS)) {
      const h = deckHealth(deckId), d = DECKS[deckId];
      html += `<div class="section" style="margin:10px 0 0;padding:13px"><div class="pf-section-title"><h2>${d.flag} ${d.name}</h2><span class="pf-small">${h.cards} frases</span></div><div class="pf-health-grid"><div class="pf-health-card"><b>${h.ok}</b><span>áudios OK</span></div><div class="pf-health-card"><b>${h.missing}</b><span>áudios ausentes</span></div><div class="pf-health-card"><b>${h.fav}</b><span>favoritos</span></div><div class="pf-health-card"><b>${h.suspended}</b><span>suspensos</span></div></div>${h.unknown?`<div class="msg">${h.unknown} áudio(s) ainda não verificado(s).</div>`:''}</div>`;
    }
    sum.innerHTML = html;
    const lastSync = localStorage.getItem(LAST_SYNC_KEY);
    const lastScan = localStorage.getItem(LAST_AUDIO_SCAN_KEY);
    $pf('pfHealthTimes').textContent = `Última sincronização: ${formatTs(lastSync)} · última verificação de áudio: ${formatTs(lastScan)}`;
    const list = $pf('pfLeechList');
    const all=[];
    for (const deckId of Object.keys(DECKS)) for (const card of (state.cards[deckId]||[])) if (isLeech(card)) all.push({deckId,card});
    if (!all.length) list.innerHTML = '<div class="empty">Nenhuma frase problemática no momento.</div>';
    else list.innerHTML = all.slice(0,25).map(({deckId,card})=>`<div class="pf-list-item"><b>${DECKS[deckId].flag} ${escapeHtml(card.front)}</b><span>${Number(card.schedules.recognition.lapses||0)+Number(card.schedules.production.lapses||0)} esquecimento(s) registrado(s)</span></div>`).join('');
  }

  function escapeHtml(s){return String(s||'').replace(/[&<>\"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':'&quot;'}[ch]));}

  function ensureLibraryFilters() {
    const head = document.querySelector('#view-library .library-head');
    if (!head || $pf('pfLibraryFilters')) return;
    const wrap = document.createElement('div');
    wrap.id = 'pfLibraryFilters'; wrap.className = 'pf-library-filters';
    wrap.innerHTML = `<select id="pfSpecialFilter"><option value="all">Todos</option><option value="favorites">⭐ Favoritos</option><option value="leeches">⚠️ Difíceis</option><option value="suspended">⏸ Suspensos</option></select><select id="pfTagFilter"><option value="">Todas as tags</option></select>`;
    head.insertAdjacentElement('afterend', wrap);
    $pf('pfSpecialFilter').addEventListener('change', renderLibrary);
    $pf('pfTagFilter').addEventListener('change', renderLibrary);
  }
  function updateTagOptions(deckId) {
    ensureLibraryFilters();
    const select = $pf('pfTagFilter'); if (!select) return;
    const current = select.value;
    const tags = [...new Set((state.cards[deckId]||[]).flatMap(c=>c.tags||[]))].sort((a,b)=>a.localeCompare(b));
    select.innerHTML = '<option value="">Todas as tags</option>' + tags.map(t=>`<option value="${escapeHtml(t)}">#${escapeHtml(t)}</option>`).join('');
    if (tags.includes(current)) select.value = current;
  }
  function libraryFilteredCards(deckId) {
    const q = ($('search')?.value || '').trim().toLowerCase();
    const special = $pf('pfSpecialFilter')?.value || 'all';
    const tag = $pf('pfTagFilter')?.value || '';
    return (state.cards[deckId]||[]).filter(c => {
      if (q && !c.front.toLowerCase().includes(q) && !c.back.toLowerCase().includes(q)) return false;
      if (special === 'favorites' && !c.favorite) return false;
      if (special === 'leeches' && !isLeech(c)) return false;
      if (special === 'suspended' && !c.suspended) return false;
      if (tag && !(c.tags||[]).includes(tag)) return false;
      return true;
    }).sort((a,b)=>a.created-b.created);
  }
  function decorateLibrary() {
    ensureLibraryFilters();
    const deckId = $('libraryDeck')?.value || selectedDeck();
    updateTagOptions(deckId);
    const rows = [...document.querySelectorAll('#list .item:not(.hidden)')];
    const cards = libraryFilteredCards(deckId);
    rows.forEach((row,i)=>{
      const card = cards[i]; if (!card) return;
      row.dataset.cardId = card.id;
      const old = row.querySelector('.pf-enhanced'); if (old) old.remove();
      const box = document.createElement('div'); box.className = 'pf-enhanced';
      const st = cachedAudioStatus(card, deckId).state;
      const label = st==='ok'?'🔊 Áudio OK':st==='missing'?'⚠️ Áudio ausente':'… Áudio não verificado';
      const cls = st==='ok'?'ok':st==='missing'?'missing':'unknown';
      box.innerHTML = `<span class="pf-status ${cls}">${label}</span>${isLeech(card)?'<span class="pf-leech">⚠️ Frase difícil</span>':''}<div class="pf-tags">${(card.tags||[]).map(t=>`<span class="pf-tag">#${escapeHtml(t)}</span>`).join('')}</div><div class="pf-item-actions"><button type="button" data-pf="fav" class="${card.favorite?'on':''}">${card.favorite?'★ Favorita':'☆ Favoritar'}</button><button type="button" data-pf="suspend" class="${card.suspended?'on':''}">${card.suspended?'▶ Retomar':'⏸ Suspender'}</button><button type="button" data-pf="tags">🏷 Tags</button></div>`;
      row.appendChild(box);
      box.querySelector('[data-pf="fav"]').addEventListener('click',()=>{card.favorite=!card.favorite;save();renderLibrary();updateCurrentCardExtras();});
      box.querySelector('[data-pf="suspend"]').addEventListener('click',()=>{card.suspended=!card.suspended;save();currentItem=null;render();renderLibrary();});
      box.querySelector('[data-pf="tags"]').addEventListener('click',()=>{const raw=prompt('Tags separadas por vírgula:',(card.tags||[]).join(', '));if(raw===null)return;card.tags=[...new Set(raw.split(',').map(x=>x.trim()).filter(Boolean))];save();renderLibrary();updateCurrentCardExtras();});
    });
  }

  function ensureCurrentCardExtras() {
    const badge = $('studyBadge');
    if (badge && !$pf('pfCurrentFav')) {
      const b = document.createElement('button'); b.id='pfCurrentFav'; b.type='button'; b.className='pf-current-fav';
      b.addEventListener('click',()=>{const item=current();if(!item)return;item.card.favorite=!item.card.favorite;save();updateCurrentCardExtras();});
      badge.insertAdjacentElement('afterend', b);
    }
    const hint = $('promptHint');
    if (hint && !$pf('pfCurrentTags')) {
      const t=document.createElement('div');t.id='pfCurrentTags';t.className='pf-current-tags';hint.insertAdjacentElement('afterend',t);
    }
  }
  function updateCurrentCardExtras() {
    ensureCurrentCardExtras();
    let item=null; try{item=current();}catch(_){return;}
    const b=$pf('pfCurrentFav'),t=$pf('pfCurrentTags');
    if (!item) { if(b)b.classList.add('hidden'); if(t)t.innerHTML=''; return; }
    if(b){b.classList.remove('hidden');b.textContent=item.card.favorite?'★':'☆';b.title=item.card.favorite?'Remover dos favoritos':'Adicionar aos favoritos';}
    if(t)t.innerHTML=(item.card.tags||[]).map(x=>`<span class="pf-tag">#${escapeHtml(x)}</span>`).join('')+(isLeech(item.card)?'<span class="pf-leech">⚠️ Frase difícil</span>':'');
  }

  let hfRunning=false, hfToken=0, hfWakeLock=null, hfAudio=null;
  const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
  async function requestWakeLock(){try{if('wakeLock'in navigator)hfWakeLock=await navigator.wakeLock.request('screen');}catch(_){} }
  async function releaseWakeLock(){try{await hfWakeLock?.release();}catch(_){}hfWakeLock=null;}
  function renderHandsfreeSettings(){ensureViews();$pf('pfHfDeck').value=selectedDeck();}
  function hfQueue(deckId, source){
    let cards=[];
    if(source==='favorites')cards=(state.cards[deckId]||[]).filter(c=>c.favorite&&!c.suspended);
    else if(source==='all')cards=(state.cards[deckId]||[]).filter(c=>!c.suspended);
    else{
      const seen=new Set();
      for(const item of dueNow(deckId)){if(!seen.has(item.card.id)&&!item.card.suspended){seen.add(item.card.id);cards.push(item.card);}}
    }
    return cards;
  }
  function speakPromise(text,lang,rate=1){
    return new Promise(resolve=>{
      if(!('speechSynthesis'in window)){resolve();return;}
      const u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=rate;u.onend=()=>resolve();u.onerror=()=>resolve();
      try{speechSynthesis.speak(u);}catch(_){resolve();}
      setTimeout(resolve, Math.max(2500, String(text).split(/\s+/).length*500+1600));
    });
  }
  function directAudioPromise(card,deckId){
    return new Promise(async resolve=>{
      const path=audioPath(card,deckId);
      if(!path){await speakPromise(card.front,DECKS[deckId].lang,1);resolve();return;}
      try{
        if(!hfAudio)hfAudio=new Audio();
        hfAudio.pause();hfAudio.currentTime=0;hfAudio.src=`${path}?hf=${Date.now()}`;hfAudio.playbackRate=1;
        let done=false;const finish=()=>{if(done)return;done=true;hfAudio.onended=null;hfAudio.onerror=null;resolve();};
        hfAudio.onended=finish;
        hfAudio.onerror=async()=>{if(done)return;done=true;hfAudio.onended=null;hfAudio.onerror=null;await speakPromise(card.front,DECKS[deckId].lang,1);resolve();};
        const p=hfAudio.play();if(p?.catch)p.catch(async()=>{if(done)return;done=true;await speakPromise(card.front,DECKS[deckId].lang,1);resolve();});
      }catch(_){await speakPromise(card.front,DECKS[deckId].lang,1);resolve();}
    });
  }
  async function startHandsfree(){
    stopHandsfree();
    const deckId=$pf('pfHfDeck').value, source=$pf('pfHfSource').value, pause=Number($pf('pfHfPause').value||5)*1000, repeats=Number($pf('pfHfRepeats').value||2), translation=$pf('pfHfTranslation').checked;
    const queue=hfQueue(deckId,source);
    if(!queue.length){toast('Nenhuma frase disponível para esse modo.');return;}
    hfRunning=true;const token=++hfToken;$pf('pfHfStart').disabled=true;$pf('pfHfStop').disabled=false;await requestWakeLock();
    let i=0;
    while(hfRunning&&token===hfToken){
      const card=queue[i%queue.length];
      $pf('pfHfNow').innerHTML=`<div class="lang">${DECKS[deckId].flag} ${DECKS[deckId].name} · ${i%queue.length+1}/${queue.length}</div><div class="phrase">${escapeHtml(card.front)}</div><div class="hint">Ouça e repita em voz alta</div>`;
      for(let r=0;r<repeats&&hfRunning&&token===hfToken;r++){
        await directAudioPromise(card,deckId);if(!hfRunning||token!==hfToken)break;
        if(r<repeats-1)await wait(700);
      }
      if(!hfRunning||token!==hfToken)break;
      await wait(pause);
      if(translation&&hfRunning&&token===hfToken){
        $pf('pfHfNow').querySelector('.hint').textContent=card.back;
        await speakPromise(card.back,'pt-BR',1);
        await wait(700);
      }
      i++;
    }
  }
  function stopHandsfree(){
    hfRunning=false;hfToken++;try{hfAudio?.pause();}catch(_){}try{speechSynthesis.cancel();}catch(_){}releaseWakeLock();
    if($pf('pfHfStart'))$pf('pfHfStart').disabled=false;if($pf('pfHfStop'))$pf('pfHfStop').disabled=true;
    if($pf('pfHfNow'))$pf('pfHfNow').innerHTML='<div class="lang">Pausado</div><div class="phrase">Hands-free parado</div><div class="hint">Toque em iniciar para continuar.</div>';
  }

  function patchCore() {
    const baseCandidateItems = candidateItems;
    candidateItems = function(deckId=selectedDeck(), cutoff=Date.now(), mode=selectedMode(deckId)) {
      return baseCandidateItems(deckId, cutoff, mode).filter(item => !item.card.suspended);
    };

    const baseRenderLibrary = renderLibrary;
    renderLibrary = function(){
      baseRenderLibrary();
      const deckId=$('libraryDeck').value||selectedDeck();
      ensureLibraryFilters();updateTagOptions(deckId);
      const wanted=libraryFilteredCards(deckId);
      const original=(state.cards[deckId]||[]).filter(c=>{const q=$('search').value.trim().toLowerCase();return !q||c.front.toLowerCase().includes(q)||c.back.toLowerCase().includes(q);}).sort((a,b)=>a.created-b.created);
      const rows=[...document.querySelectorAll('#list .item')];
      rows.forEach((row,i)=>{const c=original[i];row.classList.toggle('hidden',!c||!wanted.some(x=>x.id===c.id));});
      decorateLibrary();
      $('libraryCount').textContent=`${DECKS[deckId].flag} ${DECKS[deckId].name} · ${wanted.length}/${(state.cards[deckId]||[]).length} frases`;
    };

    const baseRenderReview = renderReview;
    renderReview = function(){baseRenderReview();updateCurrentCardExtras();};

    const baseRender = render;
    render = function(){baseRender();updateGoal();if(currentView==='health')renderHealth();};

    const baseSyncAll = syncAll;
    syncAll = async function(showMessage=true){
      const ok=await baseSyncAll(showMessage);
      if(ok)localStorage.setItem(LAST_SYNC_KEY,String(Date.now()));
      return ok;
    };
  }

  function backgroundAudioScan() {
    if (!shouldBackgroundScan()) return;
    setTimeout(()=>scanAudio(false), 1800);
  }

  function init() {
    ensurePowerState();
    injectStyles();
    ensureGoalUI();
    ensureTopButtons();
    ensureViews();
    ensureLibraryFilters();
    ensureCurrentCardExtras();
    patchCore();
    updateGoal();
    renderDecks();
    updateCurrentCardExtras();
    backgroundAudioScan();
    window.addEventListener('beforeunload', stopHandsfree);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&hfRunning)requestWakeLock();});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();