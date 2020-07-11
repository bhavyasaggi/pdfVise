---
---
function ManipPDF(meta) {
  this.pdfDoc = null;
  this.pdfBlobUrl = '';
  this.thumbnailList = false;
  this.loadingState = 0;

  var meta = meta || {};
  this.idViewControl = meta.viewControl;
  this.idInputFile = meta.inputFile;
  this.idInputProcess = meta.inputProcess;
  this.idProcessWrap = meta.processWrap;
}
Object.assign(ManipPDF.prototype,{
  init: function(){
    // Common DOMs
    this.viewControl = document.getElementById(this.idViewControl);
    this.processWrap = document.getElementById(this.idProcessWrap);
    document.getElementById(this.idInputFile).addEventListener('change', this.stage.bind(this));
    document.getElementById(this.idInputProcess).addEventListener('click', this.process.bind(this));
  },
  updateActive: function(event) {
    var dataset = event.target.parentElement.dataset;
    if(!dataset.hasOwnProperty('page')) {
      return
    }
    var classList = event.target.parentElement.classList;
    var targetClassList = event.target.classList;
    var currRot = (
      classList.contains('rot-0') 
        ? 0 
        : classList.contains('rot-1') 
          ? 1 
          : classList.contains('rot-2') 
            ? 2 
            : classList.contains('rot-3') 
              ? 3 
              : 0
    );
    if(targetClassList.contains('handle')) {
      return;
    } else if(targetClassList.contains('rotLeft')) {
      classList.remove('rot-0','rot-1','rot-2','rot-3');
      var rotIndex =(currRot+3)%4;
      classList.add('rot-'+rotIndex);
      dataset.rotIndex = rotIndex;
    } else if(targetClassList.contains('rotRight')) {
      classList.remove('rot-0','rot-1','rot-2','rot-3');
      var rotIndex =(currRot+1)%4;
      classList.add('rot-'+rotIndex);
      dataset.rotIndex = rotIndex;
    } else if(targetClassList.contains('status')) {
      classList.toggle('disabled');
      dataset.disabled = dataset.disabled === "true" ? "false" : "true";
    }
  },
  updateThumbnailLoaded: function(preview) {
    var viewControl = this.viewControl;
    preview.forEach(function(pElem){
      viewControl.appendChild(pElem);
    });
    this.thumbnailList = new Sortable(
      this.viewControl,
      {
        handle: '.handle'
      }
    );
    this.processWrap.dataset.state = this.loadingState = 0;
  },
  renderThumb: function(page) {
    var vp = page.getViewport({scale: 1})
    var scale = Math.min(128 / vp.width, 128 / vp.height) || 1;
    var thumbWrap = Object.assign(document.createElement('div'), {
      className: 'ui_thumbwrap'
    });
    var canvas = Object.assign(document.createElement("canvas"),{
      height: vp.height * scale, 
      width: vp.width * scale
    });
    thumbWrap.appendChild(canvas);
    thumbWrap.appendChild(Object.assign(document.createElement('div'),{
      className: 'handle',
      title: 'Move Page'
    }));
    thumbWrap.appendChild(Object.assign(document.createElement('div'),{
      className: 'rotLeft',
      title: 'Rotate Left'
    }));
    thumbWrap.appendChild(Object.assign(document.createElement('div'),{
      className: 'rotRight',
      title: 'Rotate Right'
    }));
    thumbWrap.appendChild(Object.assign(document.createElement('div'),{
      className: 'status',
      title: 'Remove/Add Page'
    }));
    thumbWrap.setAttribute('data-page',page._pageIndex);
    thumbWrap.addEventListener('click', this.updateActive.bind(this))
    return page.render({
      canvasContext: canvas.getContext("2d"), 
      viewport: page.getViewport({scale: scale})
    }).promise.then(function(){return thumbWrap});
  },
  parsePDF: function(pdfDoc) {
    this.pdfDoc = pdfDoc;
    var boundRenderThumb = this.renderThumb.bind(this);
    var thumbnailPromise = [];
    for (var pageNum = 0; pageNum < pdfDoc.numPages; pageNum+=1) {
      thumbnailPromise.push(
        pdfDoc.getPage(pageNum+1).then(boundRenderThumb)
      );
    }
    return Promise.all(thumbnailPromise);
  },
  stage: function(event){
    var files = event.target.files;
    if(!files[0]) {
      alert('Select a File!');
      return;
    }
    if(!this.viewControl) {
      alert("Loading Assets... Wait & try again.");
      return;
    }
    if(this.loadingState) {
      alert("Waiting on previous action... Wait & try again.");
      return;
    }
    if(this.thumbnailList && this.thumbnailList.destroy) {
      this.thumbnailList.destroy();
      this.thumbnailList = false;
    }
    var pdfFile = this.pdfBlobUrl = window.URL.createObjectURL(files[0]);
    this.viewControl.innerHTML = '';
    this.processWrap.dataset.state = this.loadingState = 1;
    var boundParsePDF = this.parsePDF.bind(this);
    var boundUpdateThumbnailLoaded = this.updateThumbnailLoaded.bind(this);
    window.pdfjsLib.getDocument(pdfFile).promise.then(boundParsePDF).then(boundUpdateThumbnailLoaded)
  },
  process: function() {
    if(!this.pdfBlobUrl) {
      alert('Select a File!');
      return;
    }
    fetch(
      this.pdfBlobUrl
    ).then(
      function(res) {
        return res.arrayBuffer();
      }
    ).then(
      function(pdfBytes) {
         return Promise.all([
          PDFLib.PDFDocument.load(pdfBytes),
          PDFLib.PDFDocument.create()
        ])
      }
    ).then(
      function(pdfDocuments) {
        var copyPageIndexes = []
        var rotatePageIndexes = []
        Array.prototype.forEach.call(
          document.querySelectorAll('.ui_thumbwrap'),
          function(cElem) {
            if(cElem.dataset.disabled!=="true") {
              copyPageIndexes.push(+cElem.dataset.page);
              rotatePageIndexes.push(cElem.dataset.rotIndex || 0);
            }
          }
        );
        return pdfDocuments[1].copyPages(pdfDocuments[0], copyPageIndexes).then(function(copiedPages){
          copiedPages.forEach(function(copyPage, copyIndex){
            copyPage.setRotation(
               PDFLib.degrees(
                (copyPage.getRotation().angle + rotatePageIndexes[copyIndex] * 90) % 360
              )
            );
            pdfDocuments[1].addPage(copyPage);
          });
        }).then(function(){
          return pdfDocuments[1].save();
        })
      }
    ).then(
      function(pdfBytes) {
        download(pdfBytes, Math.random().toString(36).substr(2)+".pdf", "application/pdf");
      }
    )
  }
});
var manipPDF = new ManipPDF({
  inputFile: 'inputFile',
  inputProcess: 'processFile',
  viewControl: 'thumbSelect',
  processWrap: 'processWrap'
});
if(document.readyState === "complete") {
  manipPDF.init();
} else {
  var sortLoad = window.addEventListener('load',function(){
    manipPDF.init();
    window.removeEventListener('load', sortLoad);
  });
}