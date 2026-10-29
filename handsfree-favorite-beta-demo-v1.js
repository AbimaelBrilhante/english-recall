(() => {
  'use strict';
  if (window.__rhfDemoSeedV1) return;
  const core=window.recallCore;
  if (!core) return;
  window.__rhfDemoSeedV1=true;

  function ensureDemoControl() {
    const view=document.getElementById('view-rf2-hands');
    if (!view || document.getElementById('rhfDemoSeed')) return;
    const count=document.getElementById('rf191HfCount');
    if (!count) return;
    const wrap=document.createElement('div');
    wrap.id='rhfDemoSeed';
    wrap.style.cssText='margin:10px 0;padding:12px;border:1px dashed #8176ce;border-radius:13px;background:var(--surface2,#f1f0f8);text-align:center;';
    const msg=document.createElement('p');
    msg.style.cssText='margin:0 0 9px;font-size:12px;line-height:1.5;color:var(--muted,#77778a);';
    msg.textContent='Ambiente de teste isolado: seus favoritos reais não aparecem aqui. Carregue 3 favoritas de demonstração para testar a estrela dentro do filtro Favoritas.';
    const button=document.createElement('button');
    button.type='button';
    button.textContent='★ Carregar 3 favoritas de teste';
    button.style.cssText='width:100%;min-height:44px;border:0;border-radius:10px;background:var(--primary,#4f46a5);color:#fff;font-weight:800;font-size:13px;';
    const status=document.createElement('div');
    status.setAttribute('role','status');
    status.style.cssText='font-size:12px;margin-top:8px;color:var(--muted,#77778a);';
    wrap.append(msg,button,status);
    count.insertAdjacentElement('afterend',wrap);
    button.onclick=async()=>{
      button.disabled=true;
      status.textContent='Preparando as favoritas de demonstração…';
      try{
        const deckId=document.getElementById('rf2HfDeck')?.value || 'en';
        const state=core.getState();
        state.cards ||= {};
        state.cards[deckId] ||= [];
        let cards=state.cards[deckId].filter(c=>!c.suspended);
        if(cards.length<3){
          await core.syncAll(false);
          cards=(core.getState().cards?.[deckId]||[]).filter(c=>!c.suspended);
        }
        if(cards.length<3){
          const examples=deckId==='de'
            ? [['Ich lerne jeden Tag Deutsch.','Eu estudo alemão todos os dias.'],['Ich möchte meine Aussprache verbessern.','Quero melhorar minha pronúncia.'],['Ich arbeite mit Daten.','Trabalho com dados.']]
            : [['I am responsible for validating the data.','Sou responsável por validar os dados.'],['I have worked with data since 2022.','Trabalho com dados desde 2022.'],['I automated the process to reduce errors.','Automatizei o processo para reduzir erros.']];
          const existing=core.getState().cards[deckId];
          examples.slice(0,3-cards.length).forEach(([front,back],i)=>{
            const now=Date.now();
            const schedule={reps:0,lapses:0,interval:0,ease:2.5,due:now};
            const card={id:'rhf-demo-'+deckId+'-'+i,remoteId:null,source:'demo-only',created:now+i,front,back,favorite:true,suspended:false,tags:[],schedules:{recognition:{...schedule},production:{...schedule}}};
            if(!existing.some(c=>c.id===card.id))existing.push(card);
          });
          cards=existing.filter(c=>!c.suspended);
        }
        let marked=0;
        for(const card of cards.slice(0,3)){
          if(card.favorite!==true){card.favorite=true;marked++;}
        }
        core.save();
        const source=document.getElementById('rf2HfSource');
        if(source){source.value='favorites';source.dispatchEvent(new Event('change',{bubbles:true}));}
        status.textContent='Pronto: 3 favoritas disponíveis neste beta. Toque em Iniciar e depois em ★ Remover dos favoritos.';
      }catch(error){
        status.textContent='Falha ao preparar o teste: '+(error.message||'erro inesperado');
      }finally{button.disabled=false;}
    };
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',ensureDemoControl,{once:true});
  }else ensureDemoControl();
  let n=0;
  const t=setInterval(()=>{ensureDemoControl();if(++n>25 || document.getElementById('rhfDemoSeed'))clearInterval(t)},250);
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#rf2HandsBtn'))setTimeout(ensureDemoControl,60);
  });
})();