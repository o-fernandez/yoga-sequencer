const CACHE = "yoga-sequencer-v3";

// v3: network-first for everything except hashed build assets. The old
// cache-first strategy could serve a stale page HTML whose embedded payload
// no longer matched the deployed chunks, silently breaking hydration. Now the
// cache is an offline fallback only — while online the app is never stale.

self.addEventListener("install", (e) => {
  // Precache the app shell so offline works from the first visit.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  // API responses (device sync) must never be served from cache.
  if (url.pathname.startsWith("/api/")) return;

  // Content-hashed build assets never change under the same URL — cache-first
  // is safe and saves the network round-trip.
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(e.request).then(
          (cached) =>
            cached ||
            fetch(e.request).then((res) => {
              if (res.ok) cache.put(e.request, res.clone());
              return res;
            })
        )
      )
    );
    return;
  }

  // Pages, RSC payloads, icons: network-first, cache as the offline fallback.
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      fetch(e.request)
        .then((res) => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(async () => {
          const cached = await cache.match(e.request);
          if (cached) return cached;
          // Offline navigation to a never-visited URL: fall back to the app
          // shell — the data is all in localStorage, so the library still works.
          if (e.request.mode === "navigate") {
            const shell = await cache.match("/");
            if (shell) return shell;
          }
          return Response.error();
        })
    )
  );
});
