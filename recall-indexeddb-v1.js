(() => {
  'use strict';
  if(window.recallIDB)return;
  const NAME='RecallLocalDataV1',STORE='snapshots',KEY='current';
  let connection=null,openPromise=null;
  function valid(s){
    return !!s&&s.version===4&&s.cards&&typeof s.cards==='object'&&
      Array.isArray(s.cards.en)&&Array.isArray(s.cards.de)&&
      Array.isArray(s.reviewLog)&&Array.isArray(s.activeDays)&&
      s.settings&&typeof s.settings==='object';
  }
  function open(){
    if(openPromise)return openPromise;
    if(!('indexedDB' in window))return Promise.reject(new Error('IndexedDB indisponível'));
    openPromise=new Promise((resolve,reject)=>{
      let req;
      try{req=indexedDB.open(NAME,1)}catch(error){reject(error);return;}
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'});};
      req.onsuccess=()=>{
        connection=req.result;
        connection.onversionchange=()=>{connection.close();connection=null;openPromise=null;};
        resolve(connection);
      };
      req.onerror=()=>reject(req.error||new Error('Não foi possível abrir o IndexedDB'));
      req.onblocked=()=>reject(new Error('O banco está bloqueado por outra janela do Recall'));
    });
    openPromise.catch(()=>{openPromise=null});
    return openPromise;
  }
  async function read(){
    const db=await open();
    return new Promise((resolve,reject)=>{
      let tx;
      try{tx=db.transaction(STORE,'readonly');}catch(error){reject(error);return;}
      const req=tx.objectStore(STORE).get(KEY);
      req.onsuccess=()=>{
        const record=req.result;
        if(!record){resolve(null);return;}
        if(!valid(record.payload)){reject(new Error('Dados IndexedDB existentes não passaram na validação'));return;}
        resolve(record.payload);
      };
      req.onerror=()=>reject(req.error||new Error('Falha ao ler o IndexedDB'));
      tx.onabort=()=>reject(tx.error||new Error('Leitura IndexedDB cancelada'));
    });
  }
  async function write(payload){
    if(!valid(payload))throw new Error('Estado incompleto: a gravação foi recusada');
    const db=await open();
    return new Promise((resolve,reject)=>{
      let tx;
      try{
        tx=db.transaction(STORE,'readwrite');
        tx.objectStore(STORE).put({id:KEY,payload,savedAt:Date.now(),schema:1});
      }catch(error){reject(error);return;}
      tx.oncomplete=()=>resolve(true);
      tx.onerror=()=>reject(tx.error||new Error('Falha de gravação IndexedDB'));
      tx.onabort=()=>reject(tx.error||new Error('Gravação IndexedDB cancelada'));
    });
  }
  async function restoreOrMigrate(raw){
    // The IndexedDB snapshot takes precedence after migration. Legacy storage
    // is intentionally retained, never deleted or rewritten here.
    const existing=await read();
    if(existing)return {state:existing,source:'indexeddb',migrated:false};
    if(raw===null||raw===undefined||raw==='')return {state:null,source:'empty',migrated:false};
    let original;
    try{original=JSON.parse(raw)}catch{throw new Error('O histórico antigo não é um JSON válido. Nenhum dado foi alterado.');}
    if(!valid(original))throw new Error('O histórico antigo está incompleto. A migração foi cancelada.');
    await write(original);
    const verified=await read();
    if(!verified || JSON.stringify(verified)!==JSON.stringify(original)){
      throw new Error('Os dados copiados não coincidem com o original; não utilizar a migração.');
    }
    return {state:verified,source:'indexeddb',migrated:true};
  }
  window.recallIDB={valid,read,write,restoreOrMigrate,dbName:NAME};
})();