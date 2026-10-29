(async () => {
  const status=document.getElementById('betaStatus');
  try {
    const response=await fetch('./index.html?hf-fav-beta=1',{cache:'no-store'});
    if (!response.ok) throw new Error('Não consegui carregar o Recall.');
    let html=await response.text();
    const swBlock=/if\('serviceWorker'in navigator\)\{\s*navigator\.serviceWorker\.register[\s\S]*?\n\}/;
    if (!swBlock.test(html)) throw new Error('Registro SW inesperado; beta cancelado com segurança.');
    html=html.replace(swBlock,'/* Beta isolado: sem registrar service worker */');
    const marker='\\n})();\\n</script>';
    const idx=html.lastIndexOf(marker);
    if (idx<0) throw new Error('Ponto de injeção não encontrado.');
    const bridgeText="\\nwindow.recallCore={DECKS,DAY,$,getState:()=>state,save:()=>save(),clearCurrentItem:()=>{currentItem=null;},getCurrentView:()=>currentView,current,selectedDeck,selectedMode,selectDeck:(id,autoplay=true)=>selectDeck(id,autoplay),dayKey,endOfDay,dueNow,todayStudyCount,showView,speakText,render:()=>render(),renderLibrary:()=>renderLibrary(),syncAll:(...a)=>syncAll(...a),startSession:(deckId)=>{state.settings.selectedDeck=deckId;currentItem=null;flipped=false;sessionInitial=dueNow(deckId).length;sessionDone=0;if($('libraryDeck'))$('libraryDeck').value=deckId;if($('addDeck'))$('addDeck').value=deckId;if($('settingsDeck'))$('settingsDeck').value=deckId;if($('speed'))$('speed').value=String(state.settings.speedByDeck[deckId]||1);save();showView('review');render();maybeAutoPlayCurrent();},getCandidateItems:()=>candidateItems,setCandidateItems:f=>{candidateItems=f;},getRenderLibrary:()=>renderLibrary,setRenderLibrary:f=>{renderLibrary=f;},getRenderReview:()=>renderReview,setRenderReview:f=>{renderReview=f;},getRender:()=>render,setRender:f=>{render=f;},getSyncAll:()=>syncAll,setSyncAll:f=>{syncAll=f;},getRateCard:()=>rateCard,setRateCard:f=>{rateCard=f;},getRateSchedule:()=>rateSchedule,setRateSchedule:f=>{rateSchedule=f;}};\\n";
    html=html.slice(0,idx)+bridgeText+html.slice(idx);
    html=html.replace('</head>','<link rel="stylesheet" href="./theme-hotfix.css"><link rel="stylesheet" href="./recall-home-v20.css"></head>');
    const scripts=["voice-diagnostics.js","audio-bridge.js","home-controls.js","recall-features-v2.js","home-layout-v2.js","recall-advanced-v3.js","recall-flow-fixes-v14.js","recall-single-audio-v14-1.js","recall-auto-tags-v15.js","recall-practice-v16.js","recall-review-layout-v16-1.js","recall-modern-v17.js","recall-audio-dedupe-v17-1.js","recall-insights-v18.js","recall-cefr-v18-1.js","recall-learning-v19.js","recall-ios-pt-speech-v19-3.js","recall-handsfree-recognition-v20-11.js","recall-handsfree-production-v19-2.js","recall-cram-natural-v19-4.js","recall-study-window-v19-8.js","recall-smart-sessions-v19-9.js","recall-home-v20.js","recall-repair-v20-7.js","recall-version-v18-1.js","recall-speaking-lab-entry-v20-18.js","recall-dual-streak-v20-19.js","recall-new-card-learning-v1.js","recall-new-card-variation-hints-v1.js","recall-handsfree-favorites-v1.js"];
    html=html.replace('</body>',scripts.map(path=>'<script src="./'+path+'?hf-fav-beta=1"></script>').join('\\n')+'</body>');
    document.open();
    document.write(html);
    document.close();
  } catch(error) {
    if(status) status.textContent='Falha ao abrir o teste: '+(error.message||error);
  }
})();