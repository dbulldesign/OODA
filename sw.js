/* OODA service worker — makes the app load and run offline.
   Strategy: network-first for same-origin requests (so deploys stay fresh),
   falling back to the cache (and to index.html for navigations) when offline.
   Cross-origin calls (Todoist / GitHub APIs) are left to the network and are
   handled by the app's offline queue. */
const CACHE = 'ooda-v3';
const SHELL = ['./', './index.html', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // let API calls hit the network
  e.respondWith(
    fetch(req).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
      return resp;
    }).catch(() =>
      caches.match(req).then(hit => hit || caches.match('./index.html'))
    )
  );
});
