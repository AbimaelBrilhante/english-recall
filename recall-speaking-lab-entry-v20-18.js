(() => {
'use strict';
if(window.__recallSpeakingLabEntryV2018)return;
window.__recallSpeakingLabEntryV2018=true;
function style(){
  if(document.getElementById('slEntry2018Style'))return;
  const s=document.createElement('style');s.id='slEntry2018Style';s.textContent=`.sl-prod-entry{border:1px solid var(--line);background:linear-gradient(135deg,var(--surface),var(--surface2));border-radius:22px;padding:16px;margin:0 0 20px;display:flex;align-items:center;gap:14px;cursor:pointer}.sl-prod-icon{width:54px;height:54px;border-radius:17px;background:linear-gradient(145deg,#5f53dc,#8190ff);display:grid;place-items:center;color:#fff;font-size:26px;box-shadow:0 8px 24px rgba(80,73,190,.22)}.sl-prod-copy{flex:1}.sl-prod-copy b{display:block;font-size:18px;color:var(--ink)}.sl-prod-copy span{display:block;font-size:11px;color:var(--muted);margin-top:4px}.sl-prod-arr{font-size:25px;color:var(--primary2)}`;document.head.appendChild(s);
}
function mount(){
  style();
  const home=document.getElementById('rv20Home');
  if(!home||document.getElementById('slProdEntry'))return;
  const title=[...home.querySelectorAll('.rv20-section-title')].find(x=>(x.textContent||'').includes('Ações rápidas'));
  if(!title)return;
  const e=document.createElement('section');e.id='slProdEntry';e.className='sl-prod-entry';
  e.innerHTML='<div class="sl-prod-icon">🎙</div><div class="sl-prod-copy"><b>Speaking Lab</b><span>Treino oral B1 → B2 para entrevistas · 5–15 min</span></div><div class="sl-prod-arr">›</div>';
  e.onclick=()=>{location.href='./speaking-lab.html';};
  title.insertAdjacentElement('beforebegin',e);
}
function init(){mount();new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});setInterval(mount,1200);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();