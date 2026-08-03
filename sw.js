const CACHE_PREFIX = 'voeding-pwa-';
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `${CACHE_PREFIX}static-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/styles.css',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
  './src/app.js',
  './src/ui/render.js',
  './src/data/ingredients.js',
  './src/data/recipes.js',
  './src/engine/nutrition.js',
  './src/engine/planner.js',
  './src/storage/db.js',
  './src/storage/backup.js'
];

const INDEX_URL = new URL('./index.html', self.location.href).href;
const SCOPE_PATH = new URL(self.registration.scope).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);
  const isWithinApp = requestUrl.origin === self.location.origin
    && requestUrl.pathname.startsWith(SCOPE_PATH);

  if (!isWithinApp) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function handleNavigation(request) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    return (await caches.match(request))
      || (await caches.match(INDEX_URL))
      || (await caches.match(new URL('./', self.location.href).href))
      || new Response('Deze pagina is offline niet beschikbaar.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    if (response.ok && (response.type === 'basic' || response.type === 'default')) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    return new Response('Offline en niet in de lokale cache.', {
      status: 504,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}
