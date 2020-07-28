---
---
"use strict";
function ManipPDF(meta) {
  this.pdfMeta = {};
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
    if(this.thumbnailList && this.thumbnailList.destroy) {
      this.thumbnailList.destroy();
      this.thumbnailList = false;
    }    
    this.processWrap.dataset.state = this.loadingState = 1;
    var that = this;
    Array.prototype.forEach.call(files, function(file){
      var uId = Math.random().toString(36).substr(2);
      var pdfFile = window.URL.createObjectURL(file);
      that.pdfMeta[uId] = {
        name: file.name,
        url: pdfFile
      }
      window
        .pdfjsLib
        .getDocument(pdfFile)
        .promise
        // Managing PDF Document
        .then(function(pdfDoc){
          that.pdfMeta[uId].doc = pdfDoc;
          var thumbnailPromise = [];
          for (var pageNum = 0; pageNum < pdfDoc.numPages; pageNum+=1) {
            thumbnailPromise.push(
              pdfDoc.getPage(pageNum+1)
            );
          }
          return Promise.all(thumbnailPromise);
        })
        // Managing PDF Pages
        .then(function(pdfPages){
          return pdfPages.map(function(page){
            var vp = page.getViewport({scale: 1})
            var scale = Math.min(128 / vp.width, 128 / vp.height) || 1;
            var thumbWrap = Object.assign(document.createElement('div'), {
              className: 'ui_thumbwrap'
            });
            var canvas = Object.assign(document.createElement("canvas"),{
              height: vp.height * scale, 
              width: vp.width * scale
            });
            thumbWrap.dataset.id = uId;
            thumbWrap.dataset.page = page._pageIndex;            
            thumbWrap.addEventListener('click', that.updateActive);

            that.viewControl.appendChild(thumbWrap);

            thumbWrap.appendChild(canvas);
            thumbWrap.appendChild(Object.assign(document.createElement('div'),{
              className: 'filename',
              innerText: that.pdfMeta[uId].name
            }));
            thumbWrap.appendChild(Object.assign(document.createElement('div'),{
              className: 'size-count',
              innerText: "Page: "+page._pageIndex
            }));
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
            
            return page.render({
              canvasContext: canvas.getContext("2d"), 
              viewport: page.getViewport({scale: scale})
            }).promise;
          })
        })
        // Managing PDF Thumbnails
        .then(function(){          
          that.thumbnailList = new Sortable(
            that.viewControl,
            { handle: '.handle' }
          );
          that.processWrap.dataset.state = that.loadingState = 0;
          document.getElementById(that.idInputProcess).parentElement.classList.add('active');
        });
    });    
  },
  process: function() {
    if(!Object.keys(this.pdfMeta).length) {
      alert('Select a File!');
      return;
    }
    this.processWrap.dataset.state = this.loadingState = 1;

    var that = this;

    var pdfPromises = [window.PDFLib.PDFDocument.create()]
    var pdfMap = {};
    var pdfOrder = []
    Array.prototype.forEach.call(
      document.querySelectorAll('.ui_thumbwrap'),
      function(pdfThumb) {
        var id = pdfThumb.dataset.id;
        var page = ~~pdfThumb.dataset.page;
        var rotIdx = ~~pdfThumb.dataset.rotIndex;
        pdfMap[id] = pdfMap[id] || {};
        pdfMap[id][page] = rotIdx;
        pdfOrder.push({
          id: id, page: page
        })
        if(!pdfMap[id].hasOwnProperty("_doc")){
          pdfMap[id]._doc = null;
          pdfPromises.push(
            fetch(that.pdfMeta[id].url)
              .then(function(res){
                return res.arrayBuffer()
              })
              .then(function(pdfBytes){
                return window.PDFLib.PDFDocument.load(pdfBytes)
              })
              .then(function(pdfDoc){
                pdfMap[id]._doc = pdfDoc;
                return pdfDoc;
              })
          );
        }
      }
    );

    Promise
      .all(pdfPromises)
      .then(function(pdfs){
        var newPdf = pdfs[0];
        var copyPromises = [];        

        Object.keys(pdfMap).forEach(function(pdfId) {
          var sourcePdf = pdfMap[pdfId]._doc;
          var sourcePages = Object.keys(pdfMap[pdfId]).map(function(val){ return parseInt(val, 10); }).filter(function(val){ return !isNaN(val); });

          var copyPromise = newPdf.copyPages(sourcePdf, sourcePages).then(function(copyPages){            
            for(var i = 0; i < copyPages.length; i+=1) {
              var copyPage = copyPages[i];
              var pageNum = sourcePages[i];
              var pageRot = ~~pdfMap[pdfId][pageNum];
              copyPage.setRotation(
                window.PDFLib.degrees(
                  (copyPage.getRotation().angle + pageRot * 90) % 360
                )
              );
              pdfMap[pdfId]["_"+pageNum] = copyPage;
            }
            return copyPages;
          });

          copyPromises.push(copyPromise);
        });

        return Promise.all(copyPromises).then(function(){ return newPdf; });
      })
      .then(function(pdfDest) {
        pdfOrder.forEach(function(pdfMeta){
          var newPage = pdfMap[pdfMeta.id]["_"+pdfMeta.page];
          if(newPage) {
            pdfDest.addPage(newPage);
          }          
        });
        return pdfDest.save();
      })
      .then(function(pdfBytes){
        that.processWrap.dataset.state = that.loadingState = 0;
        download(pdfBytes, Math.random().toString(36).substr(2)+".pdf", "application/pdf");
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
  var sortLoad = window.addEventListener('load',function(){
    manipPDF.init();
    window.removeEventListener('load', sortLoad);
  });
}