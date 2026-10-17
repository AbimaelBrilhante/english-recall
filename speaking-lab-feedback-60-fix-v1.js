(() => {
'use strict';
if (window.__slFeedback60FixV1) return;
window.__slFeedback60FixV1 = true;
if ((window.__slFeedbackMode || '') !== '60-second') return;

function patchSavedMarker(){
  if (document.querySelector('.ok')) return;
  const candidates = [...document.querySelectorAll('div,span,p')];
  const marker = candidates.find(el => /^\s*✓?\s*Resposta salva\b/i.test((el.textContent || '').trim()) && el.closest('.card'));
  if (marker && !marker.classList.contains('ok')) marker.classList.add('ok');
}

let queued = false;
function schedule(){
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; patchSavedMarker(); });
}

const obs = new MutationObserver(schedule);
function start(){
  obs.observe(document.body,{childList:true,subtree:true,characterData:true});
  schedule();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();