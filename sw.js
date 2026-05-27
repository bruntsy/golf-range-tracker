const CACHE = 'range-tracker-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './js/config.js',
  './js/app.js',
  './js/supabase.js',
  './js/auth.js',
  './js/home.js',
  './js/session.js',
  './js/analysis.js',
  './js/settings.js',
  './js/offline.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Only handle http/https — ignore chrome-extension and other schemes
  if (!url.protocol.startsWith('http')) return;

  // Network-first for Supabase API
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  // Cache-first for local assets
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

// Background sync for queued shots
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-shots') {
    e.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SYNC_SHOTS' }));
      })
    );
  }
});
