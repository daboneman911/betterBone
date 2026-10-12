// Bump VERSION on every deploy so installed copies pick up the new shell.
const VERSION = 'v20261011-2043';
const SHELL_CACHE = `repcoach-shell-${VERSION}`;
const IMG_CACHE = 'repcoach-img-v1'; // not versioned: the images are pinned to a commit and never change

const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/charts.js', 'js/constants.js', 'js/data.js', 'js/history.js', 'js/nav.js',
  'js/planner.js', 'js/store.js', 'js/ui.js',
  'js/views/exercise.js', 'js/views/library.js', 'js/views/onboarding.js', 'js/views/plan.js',
  'js/views/progress.js', 'js/views/settings.js', 'js/views/today.js', 'js/views/workout.js',
  'data/exercises.json',
  'icons/icon-192.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('repcoach-shell-') && key !== SHELL_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Exercise images: cache-first. They're only fetched when viewed, so the
  // offline set is whatever you've already looked at.
  if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/free-exercise-db@')) {
    event.respondWith((async () => {
      const cache = await caches.open(IMG_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  // App shell: serve from cache instantly, refresh in the background.
  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(req, { ignoreSearch: true })
      || (req.mode === 'navigate' ? await cache.match('index.html') : undefined);
    const network = fetch(req).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(err => {
      if (cached) return cached;
      throw err;
    });
    if (cached) { event.waitUntil(network.catch(() => {})); return cached; }
    return network;
  })());
});
