// Service Worker: cache del App Shell para que la app funcione offline.
// Rutas relativas para que funcione tanto en localhost como en GitHub Pages (/<repo>/).

const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

const APP_SHELL = [
    './',
    'index.html',
    'manifest.json',
    'css/style.css',
    'img/favicon.ico',
    'img/icons/icon-192x192.png',
    'img/icons/icon-512x512.png',
    'js/app.js',
    'js/utils.js',
    'js/demos/auth.js',
    'js/demos/face.js',
    'js/demos/barcode.js',
    'js/demos/screen.js',
    'js/demos/audio.js',
    'js/demos/orientation.js',
    'js/demos/motion.js',
    'js/demos/touch.js',
    'js/demos/viewtransition.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((k) => k !== STATIC_CACHE && k !== DYNAMIC_CACHE).map((k) => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

// Network first para el app shell (así se ven los cambios al desplegar),
// con respaldo en cache cuando no hay conexión.
self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET' || !req.url.startsWith('http')) return;

    e.respondWith(
        fetch(req)
            .then((res) => {
                if (res.ok) {
                    const copy = res.clone();
                    const cacheName = req.url.startsWith(self.location.origin) ? STATIC_CACHE : DYNAMIC_CACHE;
                    caches.open(cacheName).then((cache) => cache.put(req, copy));
                }
                return res;
            })
            .catch(() => caches.match(req).then((cached) => cached || caches.match('index.html')))
    );
});
