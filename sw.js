/* Lullbrook service worker — app shell precached, sounds cached on first play. */

const SHELL_CACHE = 'lullbrook-shell-v3';
const SOUND_CACHE = 'lullbrook-sounds-v1';

const SHELL = [
  '.',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/audio.js',
  'js/data.js',
  'js/icons.js',
  'fonts/fraunces.woff2',
  'fonts/fraunces-italic.woff2',
  'icons/icon.svg',
  'manifest.webmanifest',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL_CACHE && k !== SOUND_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;

  // sounds: cache-first, stored the first time a sound is played
  if (url.pathname.includes('/sounds/')) {
    e.respondWith(
      caches.open(SOUND_CACHE).then(async cache => {
        const hit = await cache.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      })
    );
    return;
  }

  // shell: cache-first with network fallback (and background refresh of index)
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request))
  );
});
