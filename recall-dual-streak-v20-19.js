(() => {
'use strict';
if(window.__recallDualStreakV2019)return;
window.__recallDualStreakV2019=true;
const core=window.recallCore;if(!core)return;
const BASE=128;
const ANCHOR='2026-10-15';
const RECOVERY_DAY='2026-11-08';
const RECOVERY_PREVIOUS='2026-11-07';
const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function parseDay(s){const [y,m,d]=s.split('-').map(Number);const x=new Date(y,m-1,d);x.setHours(0,0,0,0);return x;}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);x.setHours(0,0,0,0);return x;}
function graceDays(){
  const s=core.getState()?.settings;
  // This recovery can only protect the one day the user explicitly approves.
  return new Set((Array.isArray(s?.streakGraceDays)?s.streakGraceDays:[]).filter(d=>d===RECOVERY_DAY));
}
function currentStreak(active,grace=graceDays()){
  if(!active.size)return 0;
  let d=new Date();d.setHours(0,0,0,0);
  if(!active.has(key(d)))d=addDays(d,-1);
  let n=0;
  while(active.has(key(d))||grace.has(key(d))){
    if(active.has(key(d)))n++;
    d=addDays(d,-1);
  }
  return n;
}
function journeyStreak(){
  const active=new Set(core.getState()?.activeDays||[]);
  const grace=graceDays();
  const today=new Date();today.setHours(0,0,0,0);
  const anchor=parseDay(ANCHOR);
  if(today<=anchor)return BASE;
  let last;
  if(active.has(key(today)))last=today;
  else{
    const yesterday=addDays(today,-1);
    if(yesterday.getTime()===anchor.getTime()||active.has(key(yesterday))||grace.has(key(yesterday)))last=yesterday;
    else return 0;
  }
  let inc=0;
  for(let d=addDays(anchor,1);d<=last;d=addDays(d,1)){
    if(active.has(key(d)))inc++;
    else if(!grace.has(key(d)))return currentStreak(active,grace);
  }
  return BASE+inc;
}
function eligibleForRecovery(){
  const s=core.getState();
  const active=new Set(s?.activeDays||[]);
  const today=key(new Date());
  return today>RECOVERY_DAY &&
    today<='2026-11-14' &&
    active.has(RECOVERY_PREVIOUS) &&
    !active.has(RECOVERY_DAY) &&
    !graceDays().has(RECOVERY_DAY);
}
function restoreOneDay(){
  if(!eligibleForRecovery())return;
  const agree=confirm('Preservar a sequência usando uma pausa excepcional no domingo, 8/11? Esse dia NÃO será registrado como estudado, e o histórico de exercícios não será alterado.');
  if(!agree)return;
  const s=core.getState();
  s.settings ||= {};
  const original=s.settings.streakGraceDays;
  const existing=Array.isArray(original)?original:[];
  s.settings.streakGraceDays=[...new Set([...existing,RECOVERY_DAY])];
  try{
    core.save();
  }catch(error){
    if(original===undefined)delete s.settings.streakGraceDays;
    else s.settings.streakGraceDays=original;
    const box=document.getElementById('rdsRecoveryError');
    if(box)box.textContent='Não foi possível salvar a proteção. Nenhuma revisão foi alterada.';
    return;
  }
  try{core.render();}catch(error){/* The saved pause will be visible on the next render. */}
  render();
}
function style(){
  if(document.getElementById('rdsStyle'))return;
  const s=document.createElement('style');s.id='rdsStyle';
  s.textContent='.rds-card{display:flex;align-items:center;gap:12px;border:1px solid var(--line);background:linear-gradient(135deg,var(--surface),var(--surface2));border-radius:18px;padding:13px 15px;margin:0 0 14px}.rds-icon{width:46px;height:46px;border-radius:14px;background:var(--surface2);display:grid;place-items:center;font-size:22px}.rds-copy{flex:1;min-width:0}.rds-copy small{display:block;color:var(--muted);font-size:10px;font-weight:800}.rds-copy b{display:block;color:var(--ink);font-size:20px;margin-top:2px}.rds-copy span{display:block;color:var(--muted);font-size:9px;margin-top:2px}.rds-now{font-size:11px;color:var(--primary2);font-weight:900}.rds-restore{display:block;margin-top:9px;padding:9px 10px;border:0;border-radius:10px;background:var(--primary);color:#fff;font-size:11px;font-weight:800}.rds-help{margin-top:4px;font-size:9px!important;font-weight:500!important}.rds-error{margin-top:4px;color:#ad2447!important}';
  document.head.appendChild(s);
}
function render(){
  style();
  const root=document.getElementById('rv20Home');if(!root)return;
  let el=document.getElementById('rdsCard');
  if(!el){
    el=document.createElement('section');
    el.id='rdsCard';el.className='rds-card';
    root.insertAdjacentElement('afterbegin',el);
  }
  if(!el.dataset.boundRestore){
    el.dataset.boundRestore='1';
    el.addEventListener('click',e=>{if(e.target?.closest?.('#rdsRestore'))restoreOneDay();});
  }
  const journey=journeyStreak();
  const recall=currentStreak(new Set(core.getState()?.activeDays||[]));
  const protectedDay=graceDays().has(RECOVERY_DAY);
  const recovery=eligibleForRecovery()
    ? '<button type="button" class="rds-restore" id="rdsRestore">Preservar sequência de 08/11</button><small class="rds-help">Protege a sequência sem registrar estudo no domingo.</small><small id="rdsRecoveryError" class="rds-error"></small>'
    : '';
  const subtitle=protectedDay?'Pausa protegida em 08/11 · dia não contado como estudado':'continuação do seu histórico anterior';
  el.innerHTML=`<div class="rds-icon">🏆</div><div class="rds-copy"><small>Sequência geral</small><b>${journey} dias</b><span>${subtitle}</span>${recovery}</div><div class="rds-now">Recall ${recall}d</div>`;
}
const obs=new MutationObserver(()=>render());
function start(){
  render();
  const root=document.getElementById('rv20Home');
  if(root)obs.observe(root,{childList:true});
  setInterval(render,1500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();