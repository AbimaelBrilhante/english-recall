(() => {
  'use strict';

  function cleanLegacyVoiceUI() {
    const diagnostics = document.getElementById('recallVoiceDiagnostics');
    if (diagnostics) diagnostics.remove();

    const testVoice = document.getElementById('testVoice');
    if (testVoice) {
      const wrapper = testVoice.parentElement;
      if (wrapper && wrapper.children.length === 1) wrapper.remove();
      else testVoice.remove();
    }

    const refresh = document.getElementById('refreshVoices');
    if (refresh) refresh.remove();
  }

  function init() {
    cleanLegacyVoiceUI();
    setTimeout(cleanLegacyVoiceUI, 250);
    setTimeout(cleanLegacyVoiceUI, 900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
