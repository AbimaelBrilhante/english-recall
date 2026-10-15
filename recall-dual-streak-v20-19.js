(() => {
'use strict';
if(window.__recallDualStreakV2019)return;
window.__recallDualStreakV2019=true;
const core=window.recallCore;if(!core)return;
const BASE=128;
const ANCHOR='2026-10-15';
const DAY=86400000;
const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function parseDay(s){const [y,m,d]=s.split('-').map(Number);const x=new Date(y,m-1,d);x.setHours(0,0,0,0);return x;}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);x.setHours(0,0,0,0);return x;}
function currentStreak(set){if(!set.size)return 0;let d=new Date();d.setHours(0,0,0,0);if(!set.has(key(d)))d=addDays(d,-1);let n=0;while(set.has(key(d))){n++;d=addDays(d,-1);}return n;}
function journeyStreak(){const active=new Set(core.getState()?.activeDays||[]);const today=new Date();today.setHours(0,0,0,0);const anchor=parseDay(ANCHOR);if(today<=anchor)return BASE;let last;if(active.has(key(today)))last=today;else{const y=addDays(today,-1);if(y.getTime()===anchor.getTime())last=anchor;else if(active.has(key(y)))last=y;else return 0;}let inc=0;for(let d=addDays(anchor,1);d<=last;d=addDays(d,1)){if(!active.has(key(d)))return currentStreak(active);inc++;}return BASE+inc;}
function style(){if(document.getElementById('rdsStyle'))return;const s=document.createElement('style');s.id='rdsStyle';s.textContent='.rds-card{display:flex;align-items:center;gap:12px;border:1px solid var(--line);background:linear-gradient(135deg,var(--surface),var(--surface2));border-radius:18px;padding:13px 15px;margin:0 0 14px}.rds-icon{width:46px;height:46px;border-radius:14px;background:var(--surface2);display:grid;place-items:center;font-size:22px}.rds-copy{flex:1}.rds-copy small{display:block;color:var(--muted);font-size:10px;font-weight:800}.rds-copy b{display:block;color:var(--ink);font-size:20px;margin-top:2px}.rds-copy span{display:block;color:var(--muted);font-size:9px;margin-top:2px}.rds-now{font-size:11px;color:var(--primary2);font-weight:900}';document.head.appendChild(s);}
function render(){style();const root=document.getElementById('rv20Home');if(!root)return;let el=document.getElementById('rdsCard');if(!el){el=document.createElement('section');el.id='rdsCard';el.className='rds-card';root.insertAdjacentElement('afterbegin',el);}const journey=journeyStreak();const recall=(()=>{const set=new Set(core.getState()?.activeDays||[]);return currentStreak(set);})();el.innerHTML=`<div class="rds-icon">🏆</div><div class="rds-copy"><small>Sequência geral</small><b>${journey} dias</b><span>continuação do seu histórico anterior</span></div><div class="rds-now">Recall ${recall}d</div>`;}
const obs=new MutationObserver(()=>render());
function start(){render();const root=document.getElementById('rv20Home');if(root)obs.observe(root,{childList:true});setInterval(render,1500);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();