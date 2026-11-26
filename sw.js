// =============================================================
//  Service worker de Alabanzas MMM
//  Guarda la app en el teléfono para que abra rápido y sin internet.
//  Las alabanzas en sí las guarda Firebase (caché propio de Firestore).
//
//  IMPORTANTE: cada vez que cambies algún archivo de la app,
//  sube el número de VERSION para que los teléfonos se actualicen.
// =============================================================
const VERSION = 'alabanzas-v1';

const ARCHIVOS = [
  './',
  'index.html',
  'musicos.html',
  'estilo.css',
  'comun.js',
  'nube.js',
  'config.js',
  'instalar.js',
  'manifest.json',
  'icono.svg',
  'iconos/icono-192.png',
  'iconos/icono-512.png',
  'iconos/apple-touch-icon.png'
];

const FIREBASE = [
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(ARCHIVOS);
    // Firebase: si falla (sin internet), no bloquea la instalación
    await Promise.all(FIREBASE.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Archivos de la app: primero internet (para tener siempre lo último),
  // y si no hay conexión, la copia guardada.
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      try {
        const r = await fetch(req);
        if (r.ok) c.put(req, r.clone());
        return r;
      } catch {
        return (await c.match(req, { ignoreSearch: true }))
            || (req.mode === 'navigate' ? await c.match('index.html') : Response.error());
      }
    })());
    return;
  }

  // Librerías de Firebase (no cambian): primero la copia guardada.
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok) c.put(req, r.clone());
      return r;
    })());
  }
  // Todo lo demás (Firestore, login) va directo a internet, sin tocar.
});
