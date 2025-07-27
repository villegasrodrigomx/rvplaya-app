const CACHE_NAME = 'rvplaya-app-v1';
const appShellFiles = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/images/icon-192.png',
  '/images/icon-512.png'
];

// Instalar el Service Worker y guardar el cascarón de la app en la caché
self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Guardando en caché el cascarón de la app');
      return cache.addAll(appShellFiles);
    })
  );
});

// Servir la app desde la caché cuando no hay conexión
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});