(() => {
  'use strict';
  if (window.__recallModernV17) return;
  window.__recallModernV17 = true;

  const CSS_ID = 'recallModernV17Css';
  const CSS_HREF = './recall-modern-v17.css?v=171';

  function ensureCss(){
    if(document.getElementById(CSS_ID)) return;
    const link=document.createElement('link');
    link.id=CSS_ID;
    link.rel='stylesheet';
    link.href=CSS_HREF;
    document.head.appendChild(link);
  }

  function updateVersion(){
    document.querySelectorAll('.rf3-version').forEach(el=>el.textContent='Recall v17.1');
  }

  function updateThemeColor(){
    const dark=document.documentElement.dataset.recallTheme==='dark';
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute('content',dark?'#10141c':'#f4f6fa');
  }

  function init(){
    ensureCss();
    updateVersion();
    updateThemeColor();
    const obs=new MutationObserver(()=>{updateThemeColor();updateVersion();});
    obs.observe(document.documentElement,{attributes:true,attributeFilter:['data-recall-theme']});
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      updateVersion();
      if(document.querySelector('.rf3-version')||tries>30) clearInterval(timer);
    },150);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
