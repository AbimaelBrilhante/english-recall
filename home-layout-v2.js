(() => {
  'use strict';
  if (window.__recallHomeLayoutV2) return;
  window.__recallHomeLayoutV2 = true;

  function addStyles() {
    if (document.getElementById('homeLayoutV2Style')) return;
    const style = document.createElement('style');
    style.id = 'homeLayoutV2Style';
    style.textContent = `
      #view-decks #deckGrid{margin-bottom:12px}
      #view-decks #rf2Goal,
      #view-decks #rf2Queue{margin:0 0 10px;padding:10px 12px;border-radius:16px}
      #view-decks #rf2Goal .rf2-track{margin-top:7px}
      #view-decks #rf2Queue .rf2-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px;margin-top:8px}
      #view-decks #rf2Queue .rf2-box{padding:8px 9px;font-size:11.5px;border-radius:11px}
      #view-decks #rf2Queue .rf2-box small{font-size:9.5px;line-height:1.2}
      #view-decks .sync-row{margin:2px 0 8px}
      #view-decks .sync-row>button{flex:1 1 calc(50% - 4px);min-width:0;padding-left:9px;padding-right:9px}
      #view-decks #syncMsg{margin-bottom:8px}
      @media(max-width:430px){
        #view-decks #rf2Queue .rf2-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        #view-decks #rf2Queue .rf2-head .rf2-muted{font-size:10px}
      }
    `;
    document.head.appendChild(style);
  }

  function reorder() {
    const view = document.getElementById('view-decks');
    const grid = document.getElementById('deckGrid');
    const goal = document.getElementById('rf2Goal');
    const queue = document.getElementById('rf2Queue');
    const tools = view?.querySelector('.sync-row');
    const msg = document.getElementById('syncMsg');
    if (!view || !grid) return false;

    if (view.firstElementChild !== grid) view.insertBefore(grid, view.firstElementChild);
    let anchor = grid;
    for (const el of [goal, queue, tools, msg]) {
      if (!el) continue;
      if (anchor.nextElementSibling !== el) anchor.insertAdjacentElement('afterend', el);
      anchor = el;
    }
    return Boolean(goal && queue && tools);
  }

  function init() {
    addStyles();
    reorder();
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (reorder() || attempts > 30) clearInterval(timer);
    }, 150);

    const app = document.querySelector('main.app');
    if (app) {
      const observer = new MutationObserver(() => requestAnimationFrame(reorder));
      observer.observe(app, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();