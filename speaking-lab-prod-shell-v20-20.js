(() => {
'use strict';
if(window.__speakingLabProdShellV2020)return;
window.__speakingLabProdShellV2020=true;
const STATE_KEY='englishRecallPwaV4';
function dayKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function markRecallActive(){
  try{
    const raw=localStorage.getItem(STATE_KEY);if(!raw)return;
    const state=JSON.parse(raw);if(!state||typeof state!=='object')return;
    state.activeDays=Array.isArray(state.activeDays)?state.activeDays:[];
    const k=dayKey();
    if(!state.activeDays.includes(k)){
      state.activeDays.push(k);
      localStorage.setItem(STATE_KEY,JSON.stringify(state));
    }
  }catch(e){console.warn('[Speaking Lab] não foi possível marcar o dia ativo',e);}
}
function watchCompletedAttempt(){
  let marked=false;
  const check=()=>{
    if(marked)return;
    const text=document.body?.textContent||'';
    if(/Resposta salva/i.test(text)){markRecallActive();marked=true;}
  };
  const obs=new MutationObserver(check);
  if(document.body)obs.observe(document.body,{childList:true,subtree:true,characterData:true});
  check();
}
function addStyle(){
  const s=document.createElement('style');s.textContent='.sl-prod-back{display:inline-flex;align-items:center;gap:6px;min-height:40px;border:1px solid var(--line,#353145);background:var(--surface,#1c1a27);color:var(--ink,#f5f3fb);border-radius:12px;padding:0 13px;margin:0 0 14px;font:800 12px -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif}.beta{display:none!important}';document.head.appendChild(s);
}
function addBack(target,label){
  const main=document.querySelector('main.app')||document.body;if(!main||document.getElementById('slProdBack'))return;
  const b=document.createElement('button');b.id='slProdBack';b.className='sl-prod-back';b.textContent='‹ '+label;b.onclick=()=>{location.href=target;};main.insertAdjacentElement('afterbegin',b);
}
function patchHub(){
  document.title='Speaking Lab';
  addBack('./','Recall');
  const sixty=document.getElementById('open60');if(sixty)sixty.onclick=()=>{location.href='./60-second.html';};
  const err=[...document.querySelectorAll('button.mode')].find(b=>(b.textContent||'').includes('Error Rescue'));
  if(err){err.disabled=false;const em=err.querySelector('em');if(em)em.textContent='3–5 min';err.onclick=()=>{location.href='./error-rescue.html';};}
  const clear=document.getElementById('clear');if(clear)clear.textContent='Excluir dados do Speaking Lab';
}
function patchChild(title){document.title=title;addBack('./speaking-lab.html','Speaking Lab');}
function init(){
  addStyle();watchCompletedAttempt();
  const p=location.pathname;
  if(p.endsWith('/speaking-lab.html'))patchHub();
  else if(p.endsWith('/60-second.html'))patchChild('60-Second Challenge');
  else if(p.endsWith('/error-rescue.html'))patchChild('Error Rescue');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();