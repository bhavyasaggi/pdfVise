---
---
'use strict';
var cacheName = 'pdfVise';
var filesToCache = [
  "{{ "/favicon.ico" | absolute_url }}",
  "{{ "/404.html" | absolute_url }}",  
  {%- for page_type in site.data.type -%}
  "{{ page_type[1].link | absolute_url }}",
  {%- endfor -%}
  "{{ "/assets/js/combine.js" | absolute_url }}",
  "{{ "/assets/js/merge.js" | absolute_url }}",
  "{{ "/assets/js/sort.js" | absolute_url }}",
  "{{ "/assets/css/action.css" | absolute_url }}",
  "{{ "/assets/images/logo.jpg" | absolute_url }}",
  "{{ "/assets/icons/move.svg" | absolute_url}}",
  "{{ "/assets/icons/rotate-cw.svg" | absolute_url}}",
  "{{ "/assets/icons/rotate-ccw.svg" | absolute_url}}",
  "{{ "/assets/icons/trash.svg" | absolute_url}}",
  "{{ "/assets/icons/trash-2.svg" | absolute_url}}",
  "{{ "/assets/site.webmanifest" | absolute_url }}",
  "https://unpkg.com/pdfjs-dist@latest/build/pdf.worker.min.js",
  "https://unpkg.com/pdfjs-dist@latest/build/pdf.min.js",
  "https://unpkg.com/pdf-lib@latest/dist/pdf-lib.min.js",
  "https://unpkg.com/sortablejs@latest/Sortable.min.js",
  "https://unpkg.com/downloadjs@latest/download.min.js"
];
var neverCacheUrls = [/preview=true/];
var offlineHTML = "<html><head><title></title></head><body><h1>You Are Offline!</h1></body></html>";
// Install
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(cacheName).then(function (cache) {
      cache.addAll(filesToCache).catch(function (r) {
        return console.error('PWA: ' + String(r));
      });
    }).then(function () {
      return self.skipWaiting();
    })
  );
});
// Activate
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keyList) {
      return Promise.all(keyList.map(function (key) {
        if (key !== cacheName) {
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});
// Fetch
self.addEventListener('fetch', function(e) {
  if (!(
      // For POST requests, do not use the cache. Serve offline page if offline.
      (e.request.method === 'GET') &&
      // Return if request url protocal isn't http or https
      e.request.url.match(/^(http|https):\/\//i) &&
      // Return if the current request url is in the never cache list
      neverCacheUrls.every(function (url) {
        return this.match(url) ? false : true;
      }, e.request.url)
  )) {
    return;
  }
  if(
    !~filesToCache.indexOf(e.request.url) &&
    new URL(e.request.url).origin !== location.origin
  ) {
    return;
  }  
  e.respondWith(
    // Network First
    fetch(e.request).then(function(fetchRequest) {
      // Update Cache
      return caches.open(cacheName).then(function(cacheBox){
        cacheBox.put(e.request, fetchRequest.clone());
        return fetchRequest;
      });
    // Cache Second
    }).catch(function () {
      return caches.match(e.request).then(function(cacheResponse){
        return (
          cacheResponse || new Response(offlineHTML, {headers: {'Content-Type': 'text/html'}})
        );
      });      
    })
  );
});