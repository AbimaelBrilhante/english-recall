const CACHE = 'english-recall-v10-force-refresh-1';
const APP_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './voice-diagnostics.js',
  './audio-bridge.js',
  './home-controls.js',
  './theme-hotfix.css',
  './srs-tuning.js',
  './power-features.js',
  './new-card-queue.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();

    // Force already-open/installed PWA windows to reload once under the new service worker.
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(clients.map(client => {
      try { return client.navigate(client.url); } catch (_) { return null; }
    }));
  })());
});

async function injectAddons(response) {
  if (!response) return response;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let text = await response.text();

  if (!text.includes('theme-hotfix.css')) {
    text = text.replace('</head>', '<link rel="stylesheet" href="./theme-hotfix.css?v=10">\n</head>');
  }

  if (!text.includes('voice-diagnostics.js')) {
    text = text.replace('</body>', '<script src="./voice-diagnostics.js?v=10"></script>\n</body>');
  }

  if (!text.includes('audio-bridge.js')) {
    text = text.replace('</body>', '<script src="./audio-bridge.js?v=10"></script>\n</body>');
  }

  if (!text.includes('home-controls.js')) {
    text = text.replace('</body>', '<script src="./home-controls.js?v=10"></script>\n</body>');
  }

  if (!text.includes('srs-tuning.js')) {
    text = text.replace('</body>', '<script src="./srs-tuning.js?v=10"></script>\n</body>');
  }

  if (!text.includes('power-features.js')) {
    text = text.replace('</body>', '<script src="./power-features.js?v=10"></script>\n</body>');
  }

  if (!text.includes('new-card-queue.js')) {
    text = text.replace('</body>', '<script src="./new-card-queue.js?v=10"></script>\n</body>');
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(text, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (url.pathname.includes('/decks/')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
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
      fetch(event.request, { cache: 'no-store' })
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
