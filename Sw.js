// Arora POD — Service Worker
// Must be served from same origin as the app for PWA installability.
// Place this file in the root of the GitHub Pages repo (same folder as index.html).

const CACHE = 'arora-pod-v3';
const SHELL = ['./'];  // cache the app shell (index.html)

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Only handle same-origin GET requests — never intercept backend calls
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;
  if (e.request.url.includes('script.google.com')) return;

  // Network-first: always try to get the latest, fall back to cache if offline
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        caches.open(CACHE).then(cache => cache.put(e.request, res.clone()));
      }
      return res;
    }).catch(() =>
      caches.open(CACHE).then(cache => cache.match(e.request))
    )
  );
});
