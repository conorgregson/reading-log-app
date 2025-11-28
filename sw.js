// Service Worker for Readr v1.7.0
const VERSION = "v1.7.0";
const CACHE_STATIC = `readr-static-${VERSION}`;
const CACHE_RUNTIME = `readr-runtime-${VERSION}`;
const MAX_RUNTIME_ENTRIES = 60;

// Core app shell to precache (plain paths; SW version in cache name handles busting)
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./storage.js", // shim for backward-compat
  "./features/a11y.js",
  "./features/search-ui.js",
  "./features/settings.js",
  "./features/books.js",
  "./features/import.js",
  "./features/tooltip.js",
  "./features/profile.js",
  "./features/sessions.js",
  "./ui/wire-import-export.js",
  "./utils/dom.js",
  "./utils/constants.js",
  "./utils/search.js",
  "./utils/aggregate.js",
  "./utils/formatMs.js",
  "./utils/download.js",
  "./utils/validate.js",
  "./utils/storage.js",
  "./utils/autosuggest.js",
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
  "./images/social-card-dark-stacked.png",
];

// ---------- Helpers ----------
async function pruneCache(cacheName, maxEntries) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(
    keys.slice(0, keys.length - maxEntries).map((k) => c.delete(k))
  );
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
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE_STATIC && k !== CACHE_RUNTIME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// ---------- Message: Allow page to trigger skipWaiting ----------
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// NOTE: page handles reload via navigator.serviceWorker.controllerchange

// ---------- Fetch routing ----------
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only cache GETs
  if (request.method !== "GET") return;

  // Only handle http(s)
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // 1) SPA navigation → index.html (network-first, fallback to cache)
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
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
      })()
    );
    return;
  }

  // 2) JSON → network-first (fresh backups/imports), fallback to cached/offline
  const isJSON =
    request.url.endsWith(".json") ||
    request.headers.get("Accept")?.includes("application/json");

  if (isJSON) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request, { cache: "no-store" });
        } catch {
          const cached = await caches.match(request, { ignoreSearch: false });
          return (
            cached ||
            new Response(JSON.stringify({ error: "offline" }), {
              status: 503,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
      })()
    );
    return;
  }

  // 3) Static assets (CSS/JS/images/fonts) → Stale-While-Revalidate
  const isRuntimeCacheable =
    ["style", "script", "image", "font"].includes(request.destination) ||
    /\.(?:css|js|png|jpg|jpeg|svg|gif|ico|webp|woff2?|ttf|otf)$/i.test(
      url.pathname
    );

  if (isRuntimeCacheable) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_RUNTIME);
        // Ignore search so plain/cached path matches even if ?v= is present/absent
        const cached = await cache.match(request, { ignoreSearch: true });

        const network = fetch(request)
          .then((resp) => {
            if (
              resp &&
              resp.ok &&
              (resp.type === "basic" || resp.type === "cors")
            ) {
              cache
                .put(request, resp.clone())
                .then(() => pruneCache(CACHE_RUNTIME, MAX_RUNTIME_ENTRIES));
            }
            return resp;
          })
          .catch(() => null);

        return cached || (await network) || Response.error();
      })()
    );
    return;
  }

  // 4) Default → try cache (ignore ?v=), then network
  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { ignoreSearch: true });
      return cached || fetch(request);
    })()
  );
});
