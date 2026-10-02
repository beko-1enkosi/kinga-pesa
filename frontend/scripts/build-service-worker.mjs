import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';

// Precache the production app shell only. No API caching or background sending.
const assets = (await readdir(new URL('../dist/assets/', import.meta.url)))
  .filter(name => /\.(js|css)$/.test(name)).map(name => `/assets/${name}`);
const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const version = createHash('sha256').update('v2:' + html + assets.join('|')).digest('hex').slice(0, 12);
const source = `
const CACHE = 'kingapesa-shell-${version}';
const ASSETS = ${JSON.stringify(['/index.html', ...assets])};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('kingapesa-shell-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && ['/', '/index.html', '/demo', '/demo/', '/login', '/login/', '/app', '/app/', '/send', '/send/'].includes(url.pathname)) {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then(cache => cache.match('/index.html'))));
  } else if (ASSETS.includes(url.pathname) && url.pathname !== '/index.html') {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request, { ignoreVary: true })) || fetch(request)));
  }
});
`;
await writeFile(new URL('../dist/sw.js', import.meta.url), source);
console.log('Built offline app-shell cache (API requests excluded).');
