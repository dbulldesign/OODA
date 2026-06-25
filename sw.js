/* OODA service worker — makes the app load and run offline.
   Strategy: network-first for same-origin requests (so deploys stay fresh),
   falling back to the cache (and to index.html for navigations) when offline.
   Cross-origin calls (Todoist / GitHub APIs) are left to the network and are
   handled by the app's offline queue. */
const CACHE = 'ooda-v1.1.0';   // keep in sync with APP_VERSION in index.html
const SHELL = ['./', './index.html', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  // Pre-cache the shell, but do NOT skipWaiting here: a new worker waits so the
  // page can show an "update available" prompt and activate it on the user's say-so.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(()=>{}));
});

// the page posts this when the user clicks "Update & reload"
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
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
