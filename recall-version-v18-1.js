(() => {
  'use strict';
  if (window.__recallVersionV181) return;
  window.__recallVersionV181 = true;
  const VERSION='20.1';
  function enforce(){
    document.documentElement.dataset.recallAppVersion=VERSION;
    document.querySelectorAll('.rf3-version').forEach(el=>{
      const wanted=`Recall v${VERSION}`;
      if(el.textContent!==wanted)el.textContent=wanted;
    });
  }
  enforce();
  const obs=new MutationObserver(enforce);
  obs.observe(document.body,{childList:true,subtree:true,characterData:true});
  setInterval(enforce,1500);
})();