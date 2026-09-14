(() => {
  'use strict';
  if (window.__recallReviewLayoutV161) return;
  const core = window.recallCore;
  if (!core) return;
  window.__recallReviewLayoutV161 = true;

  function applyReviewLayout() {
    const panel = document.querySelector('#view-review .panel');
    const flash = document.getElementById('flashcard');
    const rating = document.getElementById('rating');
    if (!panel || !flash || !rating) return;

    // A avaliação deve ser a primeira ação disponível depois de virar o card.
    if (flash.nextElementSibling !== rating) flash.insertAdjacentElement('afterend', rating);

    // Mantém as ferramentas auxiliares abaixo da avaliação.
    const ordered = [
      document.getElementById('promptHint'),
      document.getElementById('audioRow'),
      document.getElementById('rf3ReviewTools'),
      document.getElementById('rf3RecordBox'),
      document.getElementById('rf3CurrentNote')
    ].filter(Boolean);

    let anchor = rating;
    for (const el of ordered) {
      if (anchor.nextElementSibling !== el) anchor.insertAdjacentElement('afterend', el);
      anchor = el;
    }

    const side = document.getElementById('sideLabel');
    const flip = document.getElementById('flipLabel');
    const isBack = flash.classList.contains('back');
    if (side) side.textContent = isBack ? 'RESPOSTA' : 'FRENTE';
    if (flip) flip.textContent = isBack ? 'Ver frente' : 'Ver resposta';
  }

  function updateVersion() {
    document.querySelectorAll('.rf3-version').forEach(el => el.textContent = 'Recall v16.1');
  }

  const baseReview = core.getRenderReview?.();
  if (baseReview) {
    core.setRenderReview(function(...args) {
      const result = baseReview(...args);
      applyReviewLayout();
      updateVersion();
      return result;
    });
  }

  const baseRender = core.getRender?.();
  if (baseRender) {
    core.setRender(function(...args) {
      const result = baseRender(...args);
      applyReviewLayout();
      updateVersion();
      return result;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyReviewLayout();
      updateVersion();
    }, { once: true });
  } else {
    applyReviewLayout();
    updateVersion();
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    applyReviewLayout();
    updateVersion();
    if (tries > 20) clearInterval(timer);
  }, 200);
})();
