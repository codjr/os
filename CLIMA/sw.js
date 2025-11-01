const CACHE='sun-multi-v2';
const ASSETS=['./','./index.html','./style.css','./main.js','./manifest.json','./icons/sun-192.png','./icons/sun-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(k=>Promise.all(k.map(n=>n!==CACHE&&caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener('fetch',e=>{
  const {request}=e;
  e.respondWith(
    caches.match(request).then(r=>r||fetch(request).catch(()=>r))
  );
});
