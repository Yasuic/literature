// Offline cache. The game runs from this cache, and fetches fresh files in the background when online,
// so a new version shows up the next time the app opens. Change VERSION on every release.
const VERSION = 'literature-v2';
const FILES = [
  './', 'index.html', 'engine.js', 'search-worker.js', 'manifest.webmanifest', 'privacy.html', 'favicon.ico',
  'fonts/fonts.css',
  'fonts/orbitron-400-latin.woff2',
  'fonts/exo2-400-latin.woff2',
  'fonts/montserrat-400-latin.woff2',
  'fonts/archivo-400-latin.woff2',
  'fonts/barlow-400-latin.woff2',
  'fonts/barlow-500-latin.woff2',
  'fonts/barlow-600-latin.woff2',
  'fonts/barlow-700-latin.woff2',
  'fonts/inter-400-latin.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'voices/voices.json',
  'voices/voice1.mp3', 'voices/voice2.mp3', 'voices/voice3.mp3', 'voices/voice4.mp3', 'voices/voice5.mp3',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then(res => {
      if (res && res.ok) cache.put(e.request, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await fresh) || cache.match('index.html');
  }));
});
