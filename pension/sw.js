/* Service worker for the pension wizard.
 *
 * Purpose: an agent sitting with a client somewhere with no signal can still
 * open the wizard, compute Section 134, and produce the filled PDFs — the
 * engine and the blank Guardian forms are already on the device.
 *
 * Strategy: network-first for the page itself (so a redeploy is picked up on
 * the next online visit), cache-first for the versioned static assets.
 * Bump CACHE when the wizard changes.
 */
const CACHE = 'rrb-pension-v4';

const ASSETS = [
  './',
  './index.html',
  './how-it-works.html',   // the film — an agent shows it in a boardroom, where the signal is worst
  './start.html',          // the launch page, minus its video
  './assets/film-poster.jpg',
  './manifest.webmanifest',
  /* The .mp4 and .webm are deliberately NOT here. They are 11 MB together, and
     precaching them would spend that on every device that ever opens the
     wizard. The animated film above covers the no-signal case. */
  './assets/pdf-lib.min.js',
  './assets/pdf.min.js',
  './assets/pdf.worker.min.js',
  './assets/RRB_Declaration1_blank.pdf',
  './assets/RRB_Declaration2_blank.pdf',
  './assets/RRB_Salary_blank.pdf',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // One bad entry must not fail the whole install.
      .then((cache) => Promise.allSettled(ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // fonts, CDN fallback — leave alone
  if (url.pathname.startsWith('/api/')) return; // RIA is always live or not at all

  // The page: fresh when online, cached when not.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit || caches.match('./'))),
    );
    return;
  }

  // Everything else: serve from cache, fill the cache in the background.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }),
    ),
  );
});
