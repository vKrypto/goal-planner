/* The build replaces these markers with a content-based version and all shell assets. */
const CACHE = 'target-planner-__BUILD_VERSION__';
const ASSETS = __PRECACHE_ASSETS__;
const ROOT = new URL('./', self.location).href;
const INDEX = new URL('index.html', ROOT).href;
self.addEventListener('install', event => {
  // Take over as soon as the new version is cached, so a broken older version can't stay stuck.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(path => new URL(path, ROOT).href))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const hadOld = (await caches.keys()).filter(key => key.startsWith('target-planner-') && key !== CACHE);
    await Promise.all(hadOld.map(key => caches.delete(key)));
    await self.clients.claim();
    // Reload pages still running the previous version (including ones stuck on a blank screen).
    if (hadOld.length) for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url).catch(() => {});
  })());
});
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(ROOT)) return;
  if (url.pathname.endsWith('/sw.js')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Pages: network first so a new deploy is picked up immediately; cached shell when offline.
    if (event.request.mode === 'navigate') {
      try { const fresh = await fetch(event.request, { cache: 'no-store' }); if (fresh.ok) return fresh; } catch { /* offline */ }
      return (await cache.match(INDEX)) || fetch(event.request);
    }
    // Hashed static assets: cache first, then network.
    return (await cache.match(event.request, { ignoreVary: true })) || fetch(event.request);
  })());
});
