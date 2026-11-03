'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const webpush = require('web-push');

function abort(message){console.error(message);process.exit(1)}
const raw=process.env.RECALL_PUSH_CONFIG;
if(!raw){console.log('Notificações ainda não ativadas: segredo RECALL_PUSH_CONFIG ausente. Nenhum envio realizado.');process.exit(0)}

let config;
try{config=JSON.parse(raw)}catch{abort('RECALL_PUSH_CONFIG não contém JSON válido.')}
if(!config?.vapidPublicKey||!config?.vapidPrivateKey||!config?.subscription?.endpoint||!config?.subscription?.keys?.auth||!config?.subscription?.keys?.p256dh)abort('RECALL_PUSH_CONFIG incompleto.');

const schedule=process.env.RECALL_SCHEDULE||'';
const requested=process.env.RECALL_KIND||'';
const kind=(requested==='challenge'?'english':requested) || (
  schedule==='0 9 * * *'?'english':
  schedule==='0 12 * * *'?'german':
  schedule==='0 14 * * *'?'reminder':null
);
if(!['english','german','reminder'].includes(kind))abort('Tipo de notificação não identificado.');

function fortalezaDate(){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function messageFor(type){
  if(type==='reminder')return{
    title:'Recall · Hora de estudar',
    body:'Seu treino de hoje está te esperando. Reserve alguns minutos para praticar!',
    url:'./?open=review&deck=en',type:'reminder'
  };
  const german=type==='german';
  const deckId=german?'de':'en';
  const deckName=german?'alemão':'inglês';
  const data=JSON.parse(fs.readFileSync(`decks/${german?'german':'english'}.json`,'utf8'));
  const cards=(data.cards||[]).filter(x=>typeof x.back==='string'&&x.back.trim().length>=10&&x.back.trim().length<=105);
  if(!cards.length)abort('Deck de '+deckName+' sem frases elegíveis para desafio.');
  const seed=crypto.createHash('sha256').update(`${fortalezaDate()}|${deckId}`).digest().readUInt32BE(0);
  const card=cards[seed%cards.length];
  return {
    title:german?'Recall · Desafio de alemão':'Recall · Desafio de inglês',
    body:`Como você diria em ${deckName}: "${card.back.trim()}"?`,
    url:`./?open=review&deck=${deckId}`,
    type:german?'challenge-german':'challenge-english'
  };
}

try{
  const endpoint=new URL(config.subscription.endpoint);
  if(endpoint.protocol!=='https:')abort('Endpoint de inscrição deve usar HTTPS.');
  webpush.setVapidDetails(
    'https://abimaelbrilhante.github.io/english-recall/',
    config.vapidPublicKey,
    config.vapidPrivateKey
  );
  webpush.sendNotification(config.subscription,JSON.stringify(messageFor(kind)),{TTL:7200})
    .then(result=>console.log('Push entregue ao serviço de notificações. HTTP '+result.statusCode))
    .catch(error=>{
      const code=error.statusCode||error.code||'erro';
      console.error('Falha no envio push. Código: '+code);
      if(code===404||code===410)console.error('Inscrição expirada ou inválida: reative no iPhone e atualize o segredo.');
      process.exitCode=1;
    });
}catch(error){abort('Falha ao preparar o envio: '+(error.message||'erro'))}
