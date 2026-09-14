(() => {
  'use strict';
  if (window.__recallAutoTagsV15) return;
  const core = window.recallCore;
  if (!core) return;
  window.__recallAutoTagsV15 = true;

  const state = () => core.getState();

  const GROUPS = {
    en: {
      Interview: [[1,86],[93,104]],
      Career: [[1,4],[18,23],[30,31],[37,37],[53,54],[63,63],[77,86],[93,93],[101,102]],
      Communication: [[21,27],[30,36],[51,51],[55,57],[63,63],[69,69],[104,104]],
      Data: [[2,10],[17,19],[33,35],[37,37],[41,46],[53,53],[58,58],[60,68],[72,72],[74,75],[79,84],[92,100],[103,103]],
      Automation: [[11,13],[17,17],[27,29],[37,40],[47,48],[52,52],[64,76],[79,79],[82,82],[96,98],[103,103]],
      Project: [[11,17],[28,29],[38,40],[49,52],[64,76],[87,87],[89,90],[96,98],[103,103]],
      Work: [[3,6],[14,16],[30,30],[34,40],[49,54],[59,63],[77,86],[89,90]],
      Tax: [[3,3],[19,19],[64,64],[78,78],[85,85],[97,97]],
      Tools: [[8,10],[19,19],[43,44],[81,81],[99,100]],
      Learning: [[20,20],[31,32],[49,49],[54,54],[91,91],[101,102]],
      Idioms: [[87,92]]
    },
    de: {
      A1: [[1,73]],
      Greetings: [[1,6],[9,15],[38,41],[49,49]],
      Introductions: [[7,8],[16,19],[32,36],[42,48],[65,70]],
      Communication: [[20,30],[46,49],[54,54]],
      Directions: [[31,31],[50,53]],
      Travel: [[16,17],[31,31],[42,43],[50,53],[69,71]],
      Health: [[37,37],[39,41],[49,49],[55,64]],
      Work: [[32,33],[44,45],[65,68],[71,73]],
      Family: [[35,36]]
    }
  };

  function numberFor(card, deckId) {
    const raw = String(card?.remoteId || card?.id || '');
    const m = raw.match(new RegExp(`${deckId}-(\\d{3})`));
    return m ? Number(m[1]) : null;
  }

  function inRanges(n, ranges) {
    return ranges.some(([a,b]) => n >= a && n <= b);
  }

  function autoTags(deckId, card) {
    const n = numberFor(card, deckId);
    if (!n) return ['Custom'];
    const groups = GROUPS[deckId] || {};
    const tags = Object.entries(groups)
      .filter(([,ranges]) => inRanges(n, ranges))
      .map(([tag]) => tag);
    return tags.length ? tags : ['Other'];
  }

  function applyTags() {
    const s = state();
    let changed = 0;
    for (const deckId of Object.keys(GROUPS)) {
      for (const card of (s.cards?.[deckId] || [])) {
        const existing = Array.isArray(card.tags) ? card.tags.filter(Boolean) : [];
        const merged = [...new Set([...existing, ...autoTags(deckId, card)])];
        if (merged.length !== existing.length || merged.some((t,i) => t !== existing[i])) {
          card.tags = merged;
          changed++;
        }
      }
    }
    if (changed) core.save();
    return changed;
  }

  function allKnownTags() {
    const s = state();
    return [...new Set(Object.values(s.cards || {}).flatMap(cards => (cards || []).flatMap(c => c.tags || [])))].sort((a,b) => a.localeCompare(b));
  }

  function enhanceTagPicker() {
    const input = document.getElementById('rf3Tag');
    if (!input) return false;
    let dl = document.getElementById('rf15TagOptions');
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = 'rf15TagOptions';
      document.body.appendChild(dl);
      input.setAttribute('list', 'rf15TagOptions');
    }
    dl.innerHTML = allKnownTags().map(t => `<option value="${String(t).replace(/"/g,'&quot;')}"></option>`).join('');
    return true;
  }

  function refreshUi() {
    enhanceTagPicker();
    document.querySelectorAll('.rf3-version').forEach(el => el.textContent = 'Recall v15.0');
    if (core.getCurrentView?.() === 'library') core.renderLibrary?.();
  }

  applyTags();
  refreshUi();

  const baseSync = core.getSyncAll?.();
  if (baseSync) {
    core.setSyncAll(async function(...args) {
      const ok = await baseSync(...args);
      if (ok) {
        applyTags();
        refreshUi();
      }
      return ok;
    });
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    enhanceTagPicker();
    document.querySelectorAll('.rf3-version').forEach(el => el.textContent = 'Recall v15.0');
    if (tries > 20 || document.getElementById('rf3Tag')) clearInterval(timer);
  }, 200);
})();
