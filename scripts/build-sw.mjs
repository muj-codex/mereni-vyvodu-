import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
async function walk(dir) {
  const files = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (item.isDirectory()) files.push(...(await walk(`${dir}/${item.name}`)));
    else if (item.name !== 'sw.js') files.push(`${dir}/${item.name}`);
  }
  return files;
}
const files = await walk('dist');
const hash = createHash('sha256');
for (const file of files) hash.update(await readFile(file));
const version = hash.digest('hex').slice(0, 16);
const assets = files.map((file) => './' + file.slice(5));
await writeFile(
  'dist/sw.js',
  `// Generated from the complete production build; never edit dist manually.
const CACHE = 'mereni-shell-${version}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => {
 event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
 event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('mereni-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
 const url = new URL(event.request.url);
 if(event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
 event.respondWith(caches.open(CACHE).then(async cache => {
  // Only immutable, same-origin, build-listed files enter this cache.
  // Vite/static hosts may send Vary: Origin; navigation and module loads differ.
  const cached = await cache.match(event.request, { ignoreVary: true });
  if(cached) return cached;
  if(event.request.mode === 'navigate') return (await cache.match(new URL('index.html', self.registration.scope))) || fetch(event.request);
  return fetch(event.request);
 }));
});
`,
);
console.log(`Offline precache: ${assets.length} files, version ${version}`);
