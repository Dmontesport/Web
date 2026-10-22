// D'Monte service worker: keeps the installed app working without connection.
// - App, manifest and data.enc.js: network first (always up to date when online), the saved copy when offline.
// - img/*.js and vid/*.js are named after a hash of their content, so a saved copy never goes stale: cache first.
// Everything stays encrypted; the password is still needed to open the catalogue.
const CACHE = "dmonte-v1";
const SHELL = ["./", "./index.html", "./data.enc.js", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("dmonte-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;   // GitHub API calls are never cached
  if (/\/(img|vid)\/[0-9a-f]{32}\.js$/.test(url.pathname)) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }
  e.respondWith(fetch(url.href, { cache: "no-cache", credentials: "same-origin" }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(async () => (await caches.match(req, { ignoreSearch: true })) || (req.mode === "navigate" && (await caches.match("./"))) || Response.error()));
});
