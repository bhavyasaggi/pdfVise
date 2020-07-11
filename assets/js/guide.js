---
---
var guidePDF = (function(){
  var init, next, action, currStep = 0;
  action = function() {
    document.querySelector('.guide_step1').classList.remove('bright');
    document.querySelector('.guide_step2').classList.remove('bright');
    try {
        currStep = ~~localStorage.getItem('guide_step')
    } catch(e) {}
    switch(~~currStep) {
      case 3:
      case 2:
        document.querySelector('.ui_process').classList.add('bright');
        document.querySelector('.guide_step2').classList.add('bright');
        break;
      case 1:
      case 0:
        currStep = 1;
        document.querySelector('.ui_source').classList.add('bright');
        document.querySelector('.guide_step1').classList.add('bright');
      default:
        break;
    }
  }
  next = function() {
    currStep = ~~currStep < 2 ? 2 : 4;
    try {
        localStorage.setItem('guide_step', currStep)
    } catch(e) {}
    action();
  }
  init = function() {          
    // pdfJS Worker Setup
    window.pdfjsLib = window['pdfjs-dist/build/pdf'];
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@2.4.456/build/pdf.worker.min.js';
    action();
    document.body.removeEventListener('click', next);
    document.body.addEventListener('click', next);
  }
  return { init: init, next: next }
})();
if(document.readyState === "complete") {
  guidePDF.init();
} else {
  var guideLoad = function(){
    guidePDF.init();
    window.removeEventListener('load', guideLoad);
  }
  window.addEventListener('load',guideLoad);
}