const CACHE = 'english-recall-v6-prerecorded-audio-ui-2';
const APP_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './voice-diagnostics.js',
  './audio-bridge.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

async function injectAddons(response) {
  if (!response) return response;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let text = await response.text();

  // Small cleanup add-on removes obsolete browser voice test/refresh UI.
  if (!text.includes('voice-diagnostics.js')) {
    text = text.replace('</body>', '<script src="./voice-diagnostics.js"></script>\n</body>');
  }

  if (!text.includes('audio-bridge.js')) {
    text = text.replace('</body>', '<script src="./audio-bridge.js"></script>\n</body>');
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(text, {status: response.status, statusText: response.statusText, headers});
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Deck content is network-first so newly added phrases arrive without reinstalling the PWA.
  if (url.pathname.includes('/decks/')) {
    event.respondWith(
      fetch(event.request, {cache:'no-store'})
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Prerecorded audio is network-first: replacement/new CAF files are picked up immediately,
  // while successfully played files remain available offline as a fallback.
  if (url.pathname.includes('/audio/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, {cache:'no-store'})
        .then(response => injectAddons(response))
        .catch(async () => injectAddons(await caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
