/* The build replaces these markers with a content-based version and all shell assets. */
const CACHE = 'target-planner-__BUILD_VERSION__';
const ASSETS = __PRECACHE_ASSETS__;
const ROOT = new URL('./', self.location).href;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(path => new URL(path, ROOT).href))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('target-planner-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(ROOT)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Static shell assets are identical across Origin request headers.
    // Keep each application version coherent until the user accepts an update.
    if (event.request.mode === 'navigate') return (await cache.match(new URL('index.html', ROOT).href)) || fetch(event.request);
    return (await cache.match(event.request, { ignoreVary: true })) || fetch(event.request);
  })());
});
