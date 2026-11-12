(() => {
  'use strict';
  if(window.__recallStorageDiagnosticsV1)return;
  window.__recallStorageDiagnosticsV1=true;
  const STORE='englishRecallPwaV4';
  const $=id=>document.getElementById(id);
  const size=n=>n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(2)+' MB';
  const date=()=>new Date().toLocaleDateString('en-CA');
  let modal;

  function getSaved(){
    const raw=localStorage.getItem(STORE);
    if(raw===null||raw.length===0)throw new Error('Histórico local não encontrado.');
    return raw;
  }
  function source(){
    const raw=getSaved();
    let valid=false,stats={cards:0,reviews:0,days:0};
    try{
      const data=JSON.parse(raw);
      valid=data?.version===4 && !!data.cards && Array.isArray(data.reviewLog);
      if(valid){
        stats={
          cards:Object.values(data.cards).reduce((total,deck)=>total+(Array.isArray(deck)?deck.length:0),0),
          reviews:data.reviewLog.length,
          days:Array.isArray(data.activeDays)?data.activeDays.length:0
        };
      }
    }catch{}
    return {raw,valid,stats,estimatedBytes:raw.length*2};
  }
  function savedFile(){
    const info=source();
    const filename='recall-backup-local-'+date()+(info.valid?'.json':'-resgate.txt');
    return new File([info.raw],filename,{type:info.valid?'application/json':'text/plain'});
  }
  function download(){
    try{
      const file=savedFile();
      const url=URL.createObjectURL(file);
      const a=document.createElement('a');
      a.href=url;a.download=file.name;
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      $('rsdMessage').textContent='Backup gerado. Confira se foi salvo no app Arquivos, preferencialmente em No Meu iPhone.';
    }catch(error){
      $('rsdMessage').textContent='Não foi possível exportar: '+String(error.message||error);
    }
  }
  async function share(){
    try{
      const file=savedFile();
      if(!navigator.share || (navigator.canShare&&!navigator.canShare({files:[file]}))){
        download();return;
      }
      await navigator.share({title:'Backup local do Recall',files:[file]});
      $('rsdMessage').textContent='Escolha Salvar em Arquivos → No Meu iPhone e confira se o arquivo aparece na pasta.';
    }catch(error){
      if(error?.name==='AbortError')return;
      $('rsdMessage').textContent='O compartilhamento não foi concluído. Tente Baixar backup JSON.';
    }
  }
  function style(){
    if($('rsdStyle'))return;
    const s=document.createElement('style');
    s.id='rsdStyle';
    s.textContent=`
      #rsdOpen{width:40px;height:40px;min-width:40px;border:1px solid var(--line,#ddd);
        border-radius:14px;background:var(--surface,#fff);color:var(--ink,#222);
        display:grid;place-items:center;font:inherit;font-size:19px;padding:0;touch-action:manipulation}
      #rsdBanner{display:none;position:relative;margin:8px auto 14px;max-width:760px;padding:12px;
        border:2px solid #ad2447;background:#fff4f6;color:#86203a;border-radius:14px;
        font-size:13px;line-height:1.5;z-index:1}
      #rsdBanner button{margin-top:7px;padding:8px 12px;background:#86203a;border:0;
        border-radius:9px;color:white;font-weight:800}
      #rsdOverlay{position:fixed;inset:0;z-index:999999;background:rgba(17,15,31,.67);
        display:none;align-items:flex-end;justify-content:center;padding:10px}
      #rsdPanel{width:100%;max-width:560px;max-height:92vh;overflow-y:auto;
        background:var(--surface,#fff);color:var(--ink,#222);border-radius:22px;
        padding:20px;box-shadow:0 14px 65px #1118}
      #rsdPanel h2{font-size:19px;margin:0 0 12px}
      #rsdPanel p{font-size:13px;line-height:1.5;margin:9px 0}
      #rsdPanel .rsd-item{padding:10px 0;border-bottom:1px solid var(--line,#ddd);font-size:13px}
      #rsdPanel .rsd-item b{display:block;font-size:15px;margin-top:4px}
      #rsdPanel button{display:block;width:100%;margin:10px 0 0;border:0;border-radius:12px;
        background:var(--primary,#3c318c);color:white;padding:12px;font-weight:800;font-size:14px}
      #rsdPanel button.rsd-secondary{background:var(--surface2,#eee);color:var(--ink,#222)}
      #rsdMessage{min-height:24px;font-size:12px;color:var(--ink,#222)}
      #rsdPanel .rsd-caution{font-size:12px;color:#b2354b}
      #rsdHomeBtn{font:inherit}
    `;
    document.head.appendChild(s);
  }
  function makePanel(){
    if(modal)return;
    modal=document.createElement('div');
    modal.id='rsdOverlay';
    modal.innerHTML=`<section id="rsdPanel" role="dialog" aria-modal="true" aria-labelledby="rsdTitle">
      <h2 id="rsdTitle">Diagnóstico e backup do Recall</h2>
      <p>Este painel apenas lê seu histórico. Não remove, reseta nem compacta os dados.</p>
      <div id="rsdReport" aria-live="polite"></div>
      <p class="rsd-caution">O arquivo de backup pode conter frases, notas e o histórico completo de revisões. Guarde-o em local privado.</p>
      <button type="button" id="rsdShare">Compartilhar / Salvar no Arquivos</button>
      <button type="button" id="rsdDownload" class="rsd-secondary">Baixar backup JSON</button>
      <button type="button" id="rsdRefresh" class="rsd-secondary">Atualizar diagnóstico</button>
      <button type="button" id="rsdClose" class="rsd-secondary">Fechar</button>
      <p id="rsdMessage" aria-live="polite"></p>
    </section>`;
    document.body.appendChild(modal);
    $('rsdShare').addEventListener('click',share);
    $('rsdDownload').addEventListener('click',download);
    $('rsdRefresh').addEventListener('click',report);
    $('rsdClose').addEventListener('click',close);
    modal.addEventListener('click',event=>{if(event.target===modal)close();});
  }
  function line(parent,label,value){
    const el=document.createElement('div');el.className='rsd-item';
    const small=document.createElement('span');small.textContent=label;
    const big=document.createElement('b');big.textContent=value;
    el.append(small,big);parent.appendChild(el);
  }
  async function report(){
    makePanel();
    const host=$('rsdReport');host.replaceChildren();
    try{
      const v=source();
      line(host,'Histórico salvo',v.valid?'JSON válido':'Arquivo encontrado, mas não validado');
      line(host,'Tamanho estimado do JSON no localStorage',size(v.estimatedBytes)+' (aproximação)');
      if(v.valid){
        line(host,'Frases presentes no estado salvo',String(v.stats.cards));
        line(host,'Revisões registradas',String(v.stats.reviews));
        line(host,'Dias de estudo registrados',String(v.stats.days));
      }
    }catch(error){line(host,'Histórico local',String(error.message||error));}
    const fault=window.recallStorageFault;
    line(host,'Gravação nesta abertura',fault?fault.message:'Nenhuma falha de gravação detectada nesta abertura (não é teste de capacidade).');
    if(navigator.storage?.estimate){
      try{
        const estimate=await navigator.storage.estimate();
        if(Number.isFinite(estimate.usage)&&Number.isFinite(estimate.quota)){
          line(host,'Armazenamento de origem informado pelo navegador',
            size(estimate.usage)+' usados de '+size(estimate.quota)+' (não equivale à cota do localStorage)');
        }
      }catch{}
    }
  }
  function open(){
    makePanel();
    modal.style.display='flex';
    $('rsdMessage').textContent='';
    report();
  }
  function close(){if(modal)modal.style.display='none';}
  function renderBanner(){
    const fault=window.recallStorageFault;
    let banner=$('rsdBanner');
    if(!banner){
      const root=document.querySelector('main.app')||document.body;
      banner=document.createElement('div');banner.id='rsdBanner';
      banner.innerHTML='<strong>O Recall não consegue salvar o histórico neste momento.</strong><div id="rsdBannerText"></div><button type="button">Abrir diagnóstico e backup</button>';
      banner.querySelector('button').addEventListener('click',open);
      root.insertAdjacentElement('afterbegin',banner);
    }
    banner.style.display=fault?'block':'none';
    if(fault)$('rsdBannerText').textContent=fault.message+' Evite revisar novos cards até confirmar um backup.';
  }
  function addButtons(){
    style();
    const host=document.querySelector('.topstats')||document.querySelector('.topbar');
    if(host&&!$('rsdOpen')){
      const b=document.createElement('button');
      b.type='button';b.id='rsdOpen';b.title='Diagnóstico e backup';b.setAttribute('aria-label','Diagnóstico e backup');
      b.textContent='🛟';b.addEventListener('click',open);
      host.insertBefore(b,host.firstChild);
    }
    const quick=document.querySelector('#rv20Home .rv20-quick');
    if(quick&&!$('rsdHomeBtn')){
      const b=document.createElement('button');b.type='button';b.id='rsdHomeBtn';
      b.innerHTML='<span aria-hidden="true">🛟</span>Diagnóstico e backup';
      b.addEventListener('click',open);quick.appendChild(b);
    }
  }
  function init(){
    addButtons();renderBanner();
    window.addEventListener('recall-storage-fault',()=>{renderBanner();if(modal?.style.display==='flex')report();});
    const home=$('view-decks');
    if(home)new MutationObserver(addButtons).observe(home,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();