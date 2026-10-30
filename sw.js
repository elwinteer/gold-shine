/* Service worker – Gold Shine Presupuestos.
   IMPORTANTE: cada vez que subas cambios a GitHub, cambiá el número de VERSION
   (por ejemplo 1.0.1). Así los teléfonos muestran el aviso "Actualizar". */
const VERSION = '1.1.0';
const CACHE = 'gs-presupuestos-' + VERSION;

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/data.js',
  'js/store.js',
  'js/pdf.js',
  'js/app.js',
  'vendor/pdf-lib.min.js',
  'vendor/pdfjs/pdf.min.mjs',
  'vendor/pdfjs/pdf.worker.min.mjs',
  'img/logo.png',
  'img/logo-pdf.png',
  'img/icon-192.png',
  'img/icon-512.png',
  'img/icon-maskable-512.png',
  'img/apple-touch-icon.png',
  'img/favicon-64.png',
  'fonts/Poppins-Regular.ttf',
  'fonts/Poppins-Medium.ttf',
  'fonts/Poppins-Bold.ttf'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('gs-presupuestos-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

// Responde rápido desde la caché y actualiza en segundo plano.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        network.catch(() => {});
        return cached;
      }
      const res = await network;
      if (res) return res;
      if (req.mode === 'navigate') return cache.match('index.html');
      return new Response('', { status: 504 });
    })
  );
});
