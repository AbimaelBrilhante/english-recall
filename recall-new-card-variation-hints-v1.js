(() => {
  'use strict';
  if (window.__recallNewCardVariationHintsV1) return;
  window.__recallNewCardVariationHintsV1 = true;
  const core = window.recallCore;
  if (!core) return;

  let currentKey = '';
  let hintIndex = 0;

  const EN = [
    [/\bstart by\b/i,[
      ['Eu normalmente começo verificando a qualidade dos dados.','I usually start by checking the data quality.'],
      ['Eu normalmente começo conversando com os usuários.','I usually start by talking to the users.'],
      ['Eu normalmente começo identificando as fontes de dados necessárias.','I usually start by identifying the necessary data sources.']
    ]],
    [/\bresponsible for\b/i,[
      ['Sou responsável por validar os resultados.','I am responsible for validating the results.'],
      ['Sou responsável por acompanhar a qualidade dos dados.','I am responsible for monitoring data quality.'],
      ['Sou responsável por documentar as principais regras de negócio.','I am responsible for documenting the main business rules.']
    ]],
    [/\bwould like to\b/i,[
      ['Eu gostaria de entender melhor como a equipe trabalha.','I would like to understand better how the team works.'],
      ['Eu gostaria de explicar esse projeto com mais detalhes.','I would like to explain this project in more detail.'],
      ['Eu gostaria de saber quais são os principais desafios da posição.','I would like to know what the main challenges of the position are.']
    ]],
    [/\bmake sure\b/i,[
      ['Quero ter certeza de que os números estão corretos.','I want to make sure the numbers are correct.'],
      ['Quero ter certeza de que entendi o problema.','I want to make sure I understood the problem.']
    ]],
    [/\bcould you\b/i,[
      ['Você poderia explicar isso com mais detalhes?','Could you explain that in more detail?'],
      ['Você poderia repetir a última parte?','Could you repeat the last part?']
    ]],
    [/\bneed to\b/i,[
      ['Precisamos validar os dados antes de publicar o dashboard.','We need to validate the data before publishing the dashboard.'],
      ['Precisamos entender a causa antes de mudar o processo.','We need to understand the cause before changing the process.']
    ]],
    [/\btry to\b/i,[
      ['Eu tento entender o processo antes de escolher a ferramenta.','I try to understand the process before choosing the tool.'],
      ['Eu tento manter a solução simples para os usuários.','I try to keep the solution simple for the users.']
    ]],
    [/\bone of my\b/i,[
      ['Um dos meus principais pontos fortes é entender o negócio.','One of my main strengths is understanding the business.'],
      ['Um dos meus projetos recentes envolveu automação.','One of my recent projects involved automation.']
    ]],
    [/\bthe main challenge\b/i,[
      ['O principal desafio foi entender as regras de negócio.','The main challenge was understanding the business rules.'],
      ['O principal desafio foi garantir a qualidade dos dados.','The main challenge was ensuring data quality.']
    ]],
    [/\bthe result was\b/i,[
      ['O resultado foi uma redução no trabalho manual.','The result was a reduction in manual work.'],
      ['O resultado foi um processo mais confiável.','The result was a more reliable process.']
    ]],
    [/\bfrom my perspective\b/i,[
      ['Na minha perspectiva, qualidade dos dados é o ponto mais importante.','From my perspective, data quality is the most important point.'],
      ['Na minha perspectiva, primeiro precisamos entender o processo.','From my perspective, we first need to understand the process.']
    ]],
    [/\bif i understood correctly\b/i,[
      ['Se entendi corretamente, você está perguntando sobre meu projeto mais recente.','If I understood correctly, you are asking about my most recent project.'],
      ['Se entendi corretamente, você quer saber como eu validei os resultados.','If I understood correctly, you want to know how I validated the results.']
    ]],
    [/\bexperience\b/i,[
      ['Tenho experiência trabalhando com grandes volumes de dados.','I have experience working with large datasets.'],
      ['Tenho experiência usando SQL para validação de dados.','I have experience using SQL for data validation.']
    ]],
    [/\blooking for\b/i,[
      ['Estou buscando uma oportunidade em que eu possa trabalhar mais com dados.','I am looking for an opportunity where I can work more with data.'],
      ['Estou buscando minha primeira oportunidade internacional.','I am looking for my first international opportunity.']
    ]],
    [/\bin order to\b/i,[
      ['Eu criei uma validação para reduzir erros manuais.','I created a validation in order to reduce manual errors.'],
      ['Nós consolidamos os dados para facilitar a análise.','We consolidated the data in order to make the analysis easier.']
    ]],
    [/\bas a result\b/i,[
      ['Como resultado, a equipe passou a identificar erros mais rápido.','As a result, the team started identifying errors faster.'],
      ['Como resultado, reduzimos o trabalho manual.','As a result, we reduced the manual work.']
    ]],
    [/\bwhenever possible\b/i,[
      ['Eu automatizo tarefas repetitivas sempre que possível.','I automate repetitive tasks whenever possible.'],
      ['Eu valido os resultados com os usuários sempre que possível.','I validate the results with the users whenever possible.']
    ]],
    [/\bused to\b/i,[
      ['Estou acostumado a trabalhar com grandes volumes de dados.','I am used to working with large datasets.'],
      ['Estou acostumado a explicar resultados para usuários de negócio.','I am used to explaining results to business users.']
    ]]
  ];

  const DE = [
    [/\bich möchte\b/i,[
      ['Eu gostaria de pedir um café.','Ich möchte einen Kaffee bestellen.'],
      ['Eu gostaria de pagar com cartão.','Ich möchte mit Karte bezahlen.'],
      ['Eu gostaria de marcar um horário.','Ich möchte einen Termin machen.']
    ]],
    [/\bich hätte gern\b/i,[
      ['Eu gostaria de uma água, por favor.','Ich hätte gern ein Wasser, bitte.'],
      ['Eu gostaria de um pão, por favor.','Ich hätte gern ein Brot, bitte.']
    ]],
    [/\bich brauche\b/i,[
      ['Eu preciso de ajuda.','Ich brauche Hilfe.'],
      ['Eu preciso de uma passagem para Berlim.','Ich brauche eine Fahrkarte nach Berlin.']
    ]],
    [/\bich kann\b/i,[
      ['Eu posso falar um pouco de alemão.','Ich kann ein bisschen Deutsch sprechen.'],
      ['Eu posso pagar com cartão.','Ich kann mit Karte bezahlen.']
    ]],
    [/\bwo ist\b/i,[
      ['Onde fica a estação?','Wo ist der Bahnhof?'],
      ['Onde fica o supermercado?','Wo ist der Supermarkt?']
    ]],
    [/\bkann ich\b/i,[
      ['Posso pagar aqui?','Kann ich hier bezahlen?'],
      ['Posso sentar aqui?','Kann ich hier sitzen?']
    ]]
  ];

  const FALLBACK = {
    en:[
      ['Fale sobre uma situação parecida no seu trabalho, mudando apenas uma informação.','Use the same structure to describe a similar situation at work.'],
      ['Troque o contexto: ferramenta, pessoa, problema ou resultado.','Use the same structure but change the tool, person, problem, or result.']
    ],
    de:[
      ['Use a mesma estrutura em outra situação do dia a dia.','Benutze dieselbe Struktur in einer anderen Alltagssituation.'],
      ['Troque apenas o objeto, lugar ou pedido.','Ändere nur das Objekt, den Ort oder die Bitte.']
    ]
  };

  function getDeck(){ try{return core.selectedDeck?.() || 'en';}catch{return 'en';} }
  function getCard(){ try{return core.current?.()?.card || null;}catch{return null;} }
  function ideas(card,deck){
    const text=String(card?.front||'');
    const table=deck==='de'?DE:EN;
    for(const [re,list] of table) if(re.test(text)) return list;
    return FALLBACK[deck]||FALLBACK.en;
  }
  function injectStyle(){
    if(document.getElementById('rnclHintStyle'))return;
    const s=document.createElement('style');s.id='rnclHintStyle';s.textContent=`
      .rncl-hint{margin-top:13px;padding:12px;border:1px solid rgba(129,144,255,.35);background:rgba(129,144,255,.08);border-radius:14px}
      .rncl-hint small{display:block;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#8190ff}.rncl-hint-prompt{font-size:15px;font-weight:800;line-height:1.4;margin-top:6px}.rncl-hint-actions{display:flex;gap:7px;margin-top:9px}.rncl-hint-actions button{flex:1;min-height:38px;border:1px solid var(--line,#353145);background:var(--surface,#1c1a27);color:var(--ink,#f5f3fb);border-radius:10px;font-size:10px;font-weight:850}.rncl-hint-example{margin-top:9px;padding-top:9px;border-top:1px solid var(--line,#353145);font-size:14px;font-weight:800;line-height:1.4}.rncl-hint-example.hidden{display:none}@media(max-width:430px){.rncl-hint-actions{flex-direction:column}}
    `;document.head.appendChild(s);
  }
  function patch(){
    const overlay=document.getElementById('rnclOverlay');if(!overlay)return;
    const kicker=overlay.querySelector('.rncl-kicker');
    if(!kicker || !/5\s*·\s*Faça uma variação/i.test(kicker.textContent||''))return;
    const card=getCard();if(!card)return;
    const deck=getDeck();const key=`${deck}|${card.id||card.front}`;
    if(key!==currentKey){currentKey=key;hintIndex=0;}
    const list=ideas(card,deck);if(!list.length)return;
    injectStyle();
    const host=overlay.querySelector('.rncl-card');if(!host)return;
    let box=host.querySelector('#rnclHintBox');
    if(!box){box=document.createElement('div');box.id='rnclHintBox';box.className='rncl-hint';host.appendChild(box);}
    const item=list[hintIndex%list.length];
    box.innerHTML=`<small>💡 Ideia para destravar</small><div class="rncl-hint-prompt">${item[0]}</div><div class="rncl-hint-actions">${list.length>1?'<button type="button" data-rncl-other>↻ Outra ideia</button>':''}<button type="button" data-rncl-example>Ver exemplo em ${deck==='de'?'alemão':'inglês'}</button></div><div class="rncl-hint-example hidden" id="rnclHintExample">${item[1]}</div>`;
    const other=box.querySelector('[data-rncl-other]');if(other)other.onclick=()=>{hintIndex=(hintIndex+1)%list.length;patch();};
    const ex=box.querySelector('[data-rncl-example]');if(ex)ex.onclick=()=>{const el=box.querySelector('#rnclHintExample');el?.classList.toggle('hidden');ex.textContent=el?.classList.contains('hidden')?`Ver exemplo em ${deck==='de'?'alemão':'inglês'}`:'Ocultar exemplo';};
  }
  let queued=false;
  const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patch();});};
  const obs=new MutationObserver(schedule);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{obs.observe(document.body,{childList:true,subtree:true});schedule();},{once:true});
  else {obs.observe(document.body,{childList:true,subtree:true});schedule();}
})();