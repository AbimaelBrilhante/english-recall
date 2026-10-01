(() => {
  'use strict';
  if (window.__recallRepairV207) return;
  window.__recallRepairV207 = true;

  const STORE='englishRecallPwaV4';
  const BACKUP='englishRecallPwaV4RepairBackup';

  function style(){
    if(document.getElementById('rv207RepairStyle')) return;
    const s=document.createElement('style');
    s.id='rv207RepairStyle';
    s.textContent=`
      #rv207RepairBtn{
        width:40px;height:40px;min-width:40px;border:1px solid var(--line);
        border-radius:15px;background:var(--surface);color:var(--ink);
        display:grid;place-items:center;font:inherit;font-size:16px;
        box-shadow:var(--rv20-home-shadow,0 4px 16px rgba(0,0,0,.08));
        padding:0;touch-action:manipulation;
      }
      #rv207RepairBtn[disabled]{opacity:.55}
    `;
    document.head.appendChild(s);
  }

  async function repair(){
    const btn=document.getElementById('rv207RepairBtn');
    const raw=localStorage.getItem(STORE);

    if(!raw){
      alert('Não encontrei o histórico local do Recall. O reparo foi cancelado para não arriscar seus dados.');
      return;
    }

    try{ JSON.parse(raw); }
    catch{
      alert('O histórico local não passou na validação. O reparo foi cancelado.');
      return;
    }

    const ok=confirm(
      'Reparar o Recall?\n\n' +
      'Isso limpa apenas o cache e o service worker do app. ' +
      'Seu histórico, SRS, streak, cards e gravações não serão apagados.'
    );
    if(!ok) return;

    if(btn){
      btn.disabled=true;
      btn.textContent='…';
    }

    try{
      // Backup extra antes de qualquer ação. O app principal continua usando STORE.
      localStorage.setItem(BACKUP,raw);

      if('caches' in window){
        const keys=await caches.keys();
        await Promise.all(keys.map(k=>caches.delete(k)));
      }

      if('serviceWorker' in navigator){
        const regs=await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r=>r.unregister()));
      }

      const u=new URL(location.href);
      u.search='';
      u.hash='';
      u.searchParams.set('repair',String(Date.now()));
      location.replace(u.toString());
    }catch(err){
      if(btn){
        btn.disabled=false;
        btn.textContent='🛠';
      }
      alert('Não consegui concluir o reparo. Seus dados locais foram preservados.');
    }
  }

  function addButton(){
    style();
    if(document.getElementById('rv207RepairBtn')) return;
    const host=document.querySelector('.topstats') || document.querySelector('.topbar');
    if(!host) return;

    const b=document.createElement('button');
    b.id='rv207RepairBtn';
    b.type='button';
    b.title='Reparar app';
    b.setAttribute('aria-label','Reparar app');
    b.textContent='🛠';
    b.addEventListener('click',repair);
    host.insertBefore(b,host.firstChild);
  }

  function cleanRepairQuery(){
    try{
      const u=new URL(location.href);
      if(!u.searchParams.has('repair')) return;
      setTimeout(async()=>{
        try{
          const reg=await navigator.serviceWorker?.getRegistration?.();
          if(reg) await reg.update();
        }catch{}
        u.searchParams.delete('repair');
        history.replaceState({},'',u.pathname+(u.search||'')+u.hash);
      },1200);
    }catch{}
  }

  function init(){
    addButton();
    cleanRepairQuery();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();