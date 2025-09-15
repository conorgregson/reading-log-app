// Service Worker for Readr v1.3.1
const VERSION = "v1.3.1";
const CACHE_STATIC  = `readr-static-${VERSION}`;
const CACHE_RUNTIME = `readr-runtime-${VERSION}`;
const MAX_RUNTIME_ENTRIES = 60;

// Core app shell to precache (include versioned assets to bust cache)
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=1.3.0",
  "./app.js?v=1.3.0",
  "./manifest.json",
  "./images/favicon_teal.ico",
  "./images/favicon_white.ico",
  "./images/readr_icon_192.png",
  "./images/readr_icon_512.png",
  "./images/readr_logo_R_teal_master.png",
  "./images/readr_logo_R_white_master.png",
  "./images/readr_logo_R_dark_flat.png",
  "./images/readr_logo_R_dark_glow.png",
  "./images/social-card-teal-white-stacked.png",
  "./images/social-card-white-teal-stacked.png",
  "./images/social-card-dark-stacked.png"
];

// ---------- Helpers ----------
async function pruneCache(cacheName, maxEntries) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((k) => c.delete(k)));
}

// ---------- Install: Precache ----------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting(); // take control ASAP
});

// ---------- Activate: Cleanup old ----------
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k !== CACHE_STATIC && k !== CACHE_RUNTIME)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// ---------- Message: Allow page to trigger skipWaiting ----------
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ---------- Fetch routing ----------
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle http(s)
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // 1) SPA navigation → index.html (network-first, fallback to cache)
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const resp = await fetch(request);
        const copy = resp.clone();
        const cache = await caches.open(CACHE_STATIC);
        await cache.put("./index.html", copy);
        return resp;
      } catch {
        const cache = await caches.open(CACHE_STATIC);
        return (await cache.match("./index.html")) || Response.error();
      }
    })());
    return;
  }

  // 2) JSON → network-first (fresh backups/imports), fallback to cached/offline
  const isJSON = request.url.endsWith(".json")
    || request.headers.get("Accept")?.includes("application/json");

  if (isJSON) {
    event.respondWith((async () => {
      try {
        return await fetch(request, { cache: "no-store" });
      } catch {
        const cached = await caches.match(request);
        return cached || new Response(JSON.stringify({ error: "offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" }
        });
      }
    })());
    return;
  }

  // 3) Static assets (CSS/JS/images/fonts) → Stale-While-Revalidate
  const isRuntimeCacheable =
    ["style", "script", "image", "font"].includes(request.destination) ||
    /\.(?:css|js|png|jpg|jpeg|svg|gif|ico|webp|woff2?|ttf|otf)$/i.test(url.pathname);

  if (isRuntimeCacheable) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_RUNTIME);
      // IMPORTANT: do NOT ignore search params; they carry the version (?v=1.3.0)
      const cached = await cache.match(request, { ignoreSearch: false });

      const network = fetch(request).then((resp) => {
        if (resp && resp.ok && (resp.type === "basic" || resp.type === "cors")) {
          cache.put(request, resp.clone()).then(() => pruneCache(CACHE_RUNTIME, MAX_RUNTIME_ENTRIES));
        }
        return resp;
      }).catch(() => null);

      return cached || (await network) || Response.error();
    })());
    return;
  }

  // 4) Default → try cache, then network
  event.respondWith((async () => {
    const cached = await caches.match(request);
    return cached || fetch(request);
  })());
});