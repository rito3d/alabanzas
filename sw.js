// Guarda la app en el celular para que abra rápido y sin internet.
const CACHE='discipulado-v1';
const BASE=['./','index.html','manifest.json','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(BASE)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET')return;
  const propio=u.origin===location.origin, libs=u.hostname==='www.gstatic.com'||u.hostname.endsWith('fonts.googleapis.com')||u.hostname.endsWith('fonts.gstatic.com');
  if(!propio&&!libs)return; // los datos de Firebase no pasan por aquí
  e.respondWith(fetch(e.request).then(r=>{const copia=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copia));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));
});
