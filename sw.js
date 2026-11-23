/*
 * CloroSeguro: service worker
 * Guarda la app en el teléfono para que funcione sin internet.
 * Estrategia: responde con lo guardado y, de fondo, busca la versión nueva.
 * Al publicar cambios, sube el número de VERSION.
 */
const VERSION = 'cloroseguro-v2';
const ARCHIVOS = [
  './',
  'index.html',
  'css/estilos.css',
  'js/quimica.js',
  'js/app.js',
  'manifest.webmanifest',
  'iconos/favicon.svg',
  'iconos/icono-192.png',
  'iconos/icono-512.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  const esFuente = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !esFuente) return;

  evento.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const guardada = await cache.match(pedido, { ignoreSearch: url.origin === self.location.origin });
      const deLaRed = fetch(pedido)
        .then((respuesta) => {
          if (respuesta && (respuesta.ok || respuesta.type === 'opaque')) cache.put(pedido, respuesta.clone());
          return respuesta;
        })
        .catch(() => guardada);
      return guardada || deLaRed;
    })
  );
});
