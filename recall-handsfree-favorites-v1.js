(() => {
  'use strict';
  if (window.__recallHandsfreeFavoriteV1) return;
  const core = window.recallCore;
  if (!core) return;
  window.__recallHandsfreeFavoriteV1 = true;

  let current = null;

  function cardNow() {
    if (!current) return null;
    return (core.getState().cards?.[current.deckId] || [])
      .find(card => card.id === current.cardId) || null;
  }

  function ensureButton() {
    const panel = document.querySelector('#view-rf2-hands .rf2-hfnow');
    if (!panel) return null;
    let button = document.getElementById('rhfFavorite');
    if (button) return button;

    if (!document.getElementById('rhfFavoriteStyle')) {
      const style = document.createElement('style');
      style.id = 'rhfFavoriteStyle';
      style.textContent = '#rhfFavorite{display:none;min-height:46px;width:100%;max-width:340px;margin:15px auto 0;padding:10px 16px;border-radius:13px;border:1px solid var(--primary,#6755c8);background:var(--surface,#fff);color:var(--ink,#242233);font-size:14px;font-weight:800;touch-action:manipulation}#rhfFavorite[data-favorite="true"]{background:var(--primary,#6755c8);color:#fff}#rhfFavoriteNote{display:none;margin:8px auto 0;max-width:340px;font-size:11px;color:var(--muted,#6c6c7d);line-height:1.4;text-align:center}';
      document.head.appendChild(style);
    }
    button = document.createElement('button');
    button.id = 'rhfFavorite';
    button.type = 'button';
    button.setAttribute('aria-label','Favoritar frase atual');
    const note = document.createElement('div');
    note.id = 'rhfFavoriteNote';
    note.setAttribute('role','status');
    note.setAttribute('aria-live','polite');
    panel.append(button, note);

    button.addEventListener('click', () => {
      const card = cardNow();
      if (!card) return;
      const previous = card.favorite === true;
      card.favorite = !previous;
      try {
        core.save();
      } catch (error) {
        card.favorite = previous;
        render();
        const el = document.getElementById('rhfFavoriteNote');
        if (el) { el.style.display='block'; el.textContent='Não foi possível salvar. Tente novamente.'; }
        return;
      }
      render();
      const el = document.getElementById('rhfFavoriteNote');
      if (el) {
        el.style.display='block';
        el.textContent = card.favorite
          ? 'Adicionada aos favoritos da Biblioteca.'
          : 'Removida dos favoritos. A fila atual continua; a mudança vale na próxima sessão.';
      }
    });
    return button;
  }

  function render() {
    const button=ensureButton();
    if (!button) return;
    const card=cardNow();
    const note=document.getElementById('rhfFavoriteNote');
    if (note) { note.textContent=''; note.style.display='none'; }
    if (!card) {
      button.style.display='none';
      return;
    }
    const selected=card.favorite===true;
    button.style.display='block';
    button.dataset.favorite=String(selected);
    button.setAttribute('aria-pressed',String(selected));
    button.setAttribute('aria-label',selected?'Remover frase atual dos favoritos':'Adicionar frase atual aos favoritos');
    button.textContent=selected ? '★ Remover dos favoritos' : '☆ Favoritar esta frase';
  }

  window.addEventListener('recall:handsfree-card', event => {
    const {deckId,cardId}=event.detail || {};
    if (!deckId || !cardId) return;
    current={deckId,cardId};
    render();
  });

  document.addEventListener('click', event => {
    if (event.target?.closest?.('#rf2HfStop,#rf2HandsBack,#rf2HfStart')) {
      current=null;
      render();
    }
  }, true);
})();