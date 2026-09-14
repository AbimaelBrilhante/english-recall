(() => {
  'use strict';
  if (window.__recallVersionV172) return;
  window.__recallVersionV172 = true;

  const VERSION = '17.2';
  const core = window.recallCore;

  function enforceVersion() {
    document.documentElement.dataset.recallAppVersion = VERSION;
    document.querySelectorAll('.rf3-version').forEach(el => {
      const wanted = `Recall v${VERSION}`;
      if (el.textContent !== wanted) el.textContent = wanted;
    });
  }

  if (core) {
    const baseRender = core.getRender?.();
    if (baseRender) {
      core.setRender(function(...args) {
        const result = baseRender(...args);
        queueMicrotask(enforceVersion);
        return result;
      });
    }

    const baseReview = core.getRenderReview?.();
    if (baseReview) {
      core.setRenderReview(function(...args) {
        const result = baseReview(...args);
        queueMicrotask(enforceVersion);
        return result;
      });
    }

    const baseLibrary = core.getRenderLibrary?.();
    if (baseLibrary) {
      core.setRenderLibrary(function(...args) {
        const result = baseLibrary(...args);
        queueMicrotask(enforceVersion);
        return result;
      });
    }

    const baseSync = core.getSyncAll?.();
    if (baseSync) {
      core.setSyncAll(async function(...args) {
        const result = await baseSync(...args);
        enforceVersion();
        return result;
      });
    }
  }

  enforceVersion();

  const observer = new MutationObserver(() => enforceVersion());
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  setInterval(enforceVersion, 1500);
})();
