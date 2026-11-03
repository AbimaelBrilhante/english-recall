(() => {
  'use strict';
  if (window.__recallPushSetupV1) return;
  window.__recallPushSetupV1 = true;

  const SETTINGS_ID = 'view-settings';
  let keys = null;
  let bundle = null;
  let readyReg = null;

  const $ = id => document.getElementById(id);
  const setStatus = message => { const el = $('recallPushStatus'); if (el) el.textContent = message; };
  const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!crypto?.subtle;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  function b64url(buffer) {
    let value='';
    for (const byte of new Uint8Array(buffer)) value += String.fromCharCode(byte);
    return btoa(value).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
  }

  function fromB64url(value) {
    const base64 = String(value).replace(/-/g,'+').replace(/_/g,'/');
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4,'='));
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  }

  async function prepare() {
    if (!supported()) return setStatus('Web Push não disponível neste navegador. No iPhone, abra o Recall pelo ícone na Tela de Início.');
    if (!standalone()) return setStatus('Abra o Recall pelo ícone da Tela de Início para ativar notificações no iPhone.');

    try {
      const pair = await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
      const publicJwk = await crypto.subtle.exportKey('jwk',pair.publicKey);
      const privateJwk = await crypto.subtle.exportKey('jwk',pair.privateKey);
      const x=fromB64url(publicJwk.x), y=fromB64url(publicJwk.y);
      const publicBytes=new Uint8Array(65);
      publicBytes[0]=4;publicBytes.set(x,1);publicBytes.set(y,33);
      keys = {publicKey:b64url(publicBytes),privateKey:privateJwk.d};
      bundle = null;
      $('recallPushAllow').disabled = false;
      $('recallPushCopy').disabled = true;
      setStatus('Chaves criadas apenas neste aparelho. Agora toque em “Autorizar notificações”.');
    } catch(error) {
      setStatus('Falha ao preparar as chaves: ' + (error?.message || error?.name || 'erro'));
    }
  }

  async function enable() {
    if (!keys) return setStatus('Primeiro prepare as chaves.');
    if (!standalone()) return setStatus('Abra o Recall pelo ícone instalado na Tela de Início.');
    try {
      // A solicitação de permissão precisa começar a partir deste toque.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return setStatus('O iPhone não autorizou notificações do Recall.');
      const reg = readyReg || await navigator.serviceWorker.ready;
      const previous = await reg.pushManager.getSubscription();
      if (previous) {
        // Evitar cancelar silenciosamente uma inscrição que já esteja ativa.
        return setStatus('Já existe inscrição push neste aparelho. Não foi substituída. Se precisar renová-la, cancele a inscrição existente primeiro.');
      }
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:fromB64url(keys.publicKey)
      });
      bundle = JSON.stringify({
        vapidPublicKey:keys.publicKey,
        vapidPrivateKey:keys.privateKey,
        subscription:subscription.toJSON()
      });
      keys=null;
      $('recallPushAllow').disabled=true;
      $('recallPushCopy').disabled=false;
      setStatus('Inscrição criada. Agora copie a configuração privada e salve como um único segredo no GitHub.');
    } catch(error) {
      setStatus('Não foi possível ativar: '+(error?.message || error?.name || 'erro'));
    }
  }

  async function copySecret() {
    if (!bundle) return;
    try {
      await navigator.clipboard.writeText(bundle);
      setStatus('Configuração copiada. No GitHub: repositório → Settings → Secrets and variables → Actions → New repository secret. Nome: RECALL_PUSH_CONFIG. Cole e salve. NÃO coloque esse conteúdo em arquivo público.');
    } catch {
      const output=$('recallPushOutput');
      output.value=bundle;
      output.hidden=false;
      output.select();
      setStatus('Copie manualmente o texto mostrado abaixo e cole somente no segredo RECALL_PUSH_CONFIG do GitHub.');
    }
  }

  async function removeSubscription() {
    if (!confirm('Desativar notificações neste iPhone? O segredo do GitHub também deverá ser excluído para interromper tentativas de envio.'))return;
    try {
      const reg=readyReg || await navigator.serviceWorker.ready;
      const sub=await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      keys=null;bundle=null;
      $('recallPushCopy').disabled=true;
      $('recallPushAllow').disabled=true;
      setStatus('Inscrição removida deste aparelho. Remova também RECALL_PUSH_CONFIG dos GitHub Actions Secrets.');
    } catch(error){setStatus('Falha ao cancelar inscrição: '+(error?.message||'erro'))}
  }

  function mount() {
    const settings=$(SETTINGS_ID);
    if (!settings || $('recallPushPanel')) return;
    const section=document.createElement('section');
    section.id='recallPushPanel';
    section.className='section';
    section.innerHTML=`
      <h2>Notificações do Recall</h2>
      <p>Diariamente, 09h: desafio em inglês. 14h: lembrete de estudo (horário de Fortaleza). GitHub Pages + GitHub Actions, sem API paga.</p>
      <p style="font-size:12px">Etapas: preparar chaves → autorizar no iPhone → copiar configuração → salvar como segredo no GitHub. A configuração contém uma chave privada: não compartilhe em conversas nem coloque em arquivos públicos.</p>
      <div style="display:grid;gap:9px;max-width:420px">
        <button type="button" class="secondary-btn" id="recallPushPrepare">1. Preparar chaves neste iPhone</button>
        <button type="button" class="secondary-btn" id="recallPushAllow" disabled>2. Autorizar notificações</button>
        <button type="button" class="primary-btn" id="recallPushCopy" disabled>3. Copiar configuração para GitHub Secret</button>
        <button type="button" class="secondary-btn" id="recallPushRemove">Desativar neste aparelho</button>
        <textarea id="recallPushOutput" hidden readonly rows="4" aria-label="Configuração privada" style="width:100%"></textarea>
      </div>
      <p id="recallPushStatus" role="status" style="font-size:12px;margin-top:10px">Não ativado neste aparelho.</p>
    `;
    settings.appendChild(section);
    $('recallPushPrepare').addEventListener('click',prepare);
    $('recallPushAllow').addEventListener('click',enable);
    $('recallPushCopy').addEventListener('click',copySecret);
    $('recallPushRemove').addEventListener('click',removeSubscription);
    if (!supported()) {
      $('recallPushPrepare').disabled=true;
      setStatus('Este navegador não oferece Web Push.');
      return;
    }
    navigator.serviceWorker.ready.then(reg=>{readyReg=reg;}).catch(()=>{});
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();
