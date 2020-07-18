---
---
function ManipPDF(meta) {
  this.pdfMeta = {};
  this.loadingState = 0;
  this.pdfList = null;

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
  updateMeta: function(id, url, name, bytes, count) {
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (!bytes) return 'n/a';
    var i = ~~(Math.log2(bytes) / 10);
    var size = (bytes/(1024 ** i)).toFixed(i ? 2 : 0) + ' ' + sizes[i];
    this.pdfMeta[id] = {
      count: count,
      size: size,
      name: name,
      url: url
    }
  },
  updatePreviews: function(previews){
    for(var i = 0; i < previews.length; i+=1) {
      this.viewControl.appendChild(previews[i]);
    }
    this.pdfList = new Sortable(
      this.viewControl, { handle: '.handle' }
    );
    this.processWrap.dataset.state = this.loadingState = 0;
  },
  pageHandler: function(event) {
    const dataset = event.currentTarget.dataset;
    if(!dataset.hasOwnProperty('id')) {
      return;
    }
    var classList = event.currentTarget.classList;
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
    if(targetClassList.contains('status')) {
      delete this.pdfMeta[dataset.id];
      event.currentTarget.parentElement.removeChild(event.currentTarget);
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
    }
  },
  previewPage: function(pdfId, pdfPage) {
    const vp = pdfPage.getViewport({scale: 1});
    const scale = Math.min(128 / vp.width, 128 / vp.height) || 1;
    const thumbWrap = Object.assign(document.createElement('div'), {
      className: 'ui_thumbwrap'
    });
    const canvas = Object.assign(document.createElement("canvas"),{
      height: vp.height * scale, 
      width: vp.width * scale
    });
    var pdfMeta = this.pdfMeta[pdfId] || {}
    thumbWrap.dataset.id = pdfId;
    thumbWrap.appendChild(Object.assign(document.createElement('div'),{
      className: 'filename',
      innerText: pdfMeta.name
    }));
    thumbWrap.appendChild(Object.assign(document.createElement('div'),{
      className: 'size-count',
      innerText: pdfMeta.size+", "+pdfMeta.count+" Page"+(pdfMeta.count === 1 ? '' : 's')
    }));
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
      title: 'Remove PDF'
    }));
    thumbWrap.addEventListener('click', this.pageHandler.bind(this));
    return pdfPage.render({
      canvasContext: canvas.getContext("2d"), 
      viewport: pdfPage.getViewport({scale: scale})
    }).promise.then(function(){return thumbWrap});
  },
  previewFile: function(file) {
    var pdfId = Math.random().toString(36).substr(2);
    var pdfUrl = window.URL.createObjectURL(file);
    var boundUpdateMeta = this.updateMeta.bind(this, pdfId, pdfUrl, file.name, file.size);
    var boundPreviewPage = this.previewPage.bind(this, pdfId);

    return window
      .pdfjsLib
      .getDocument(pdfUrl)
      .promise
      .then(
        function(pdfDoc) {
          boundUpdateMeta(pdfDoc.numPages);
          return pdfDoc.getPage(1);
        }
      )
      .then(
        boundPreviewPage
      );
  },
  stage: function(event){
    var files = event.target.files;
    if(!files.length) {
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

    this.processWrap.dataset.state = this.loadingState = 1;
    if(this.pdfList && this.pdfList.destroy) {
      this.pdfList.destroy();
      this.pdfList = null;
    }

    var previewArray = Array.prototype.map.call(
      files,
      this.previewFile.bind(this)
    );
    return Promise.all(previewArray).then(this.updatePreviews.bind(this));
  },
  process: function() {
    if(!Object.keys(this.pdfMeta).length) {
      alert('Select a File!');
      return;
    }
    this.processWrap.dataset.state = this.loadingState = 1;
    var that = this;
    var pdfPromises = [window.PDFLib.PDFDocument.create()];
    var pdfRotations = []
    var pdfThumbs = document.querySelectorAll('.ui_thumbwrap');
    for(var i = 0; i < pdfThumbs.length; i+=1) {
      var pdfThumbData = pdfThumbs[i].dataset;
      pdfRotations.push(pdfThumbData.rotIndex);
      pdfPromises.push(
        fetch(this.pdfMeta[pdfThumbData.id].url)
          .then(function(res){
            return res.arrayBuffer()
          })
          .then(function(pdfBytes){
            return window.PDFLib.PDFDocument.load(pdfBytes)
          })
      );
    }
    Promise.all(pdfPromises).then(function(pdfFiles){
      var pdfDest = pdfFiles[0];
      var copyPromise = [];
      for(var i = 1; i < pdfFiles.length; i+=1) {
        var pdfSource = pdfFiles[i];
        var pdfPageCount = pdfSource.getPageCount();
        copyPromise.push(
          pdfDest.copyPages(pdfSource, Array(pdfPageCount).fill().map(function(i,j){return j}))
        );
      }
      return Promise.all(copyPromise).then(function(copyPages){
        var copyPromise = [];
        for(var i = 0; i < copyPages.length; i+=1) {
          for(var j = 0; j < copyPages[i].length; j+=1) {
            var copyPage = copyPages[i][j];
            copyPage.setRotation(
              window.PDFLib.degrees(
                (copyPage.getRotation().angle + ~~pdfRotations[i] * 90) % 360
              )
            )
            copyPromise.push(
              pdfDest.addPage(copyPages[i][j])
            ); 
          }
        }
        return Promise.all(copyPromise);
      }).then(function(){
        return pdfDest.save()
      }).then(function(pdfBytes){
        that.processWrap.dataset.state = that.loadingState = 0;
        download(pdfBytes, Math.random().toString(36).substr(2)+".pdf", "application/pdf")
      });
    });
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
  var mergeLoad = function(){
    manipPDF.init();
    window.removeEventListener('load', mergeLoad);
  }
  window.addEventListener('load',mergeLoad);
}