# Progressive Web APP (PWA) — Readr

Readr is installable as a Progressive Web App (PWA) on desktop and mobile.

## Current Features (v1.2.0)
- ✅ **Offline-first**: reading logs, goals, and streaks saved to `localStorage` and remain accessible offline.
- ✅ **Service Worker**: caches core assets for faster reloads and offline access.
- ✅ **App Manifest**: includes correct name, theme color, and icons (`192x192`, `512x512`).
- ✅ **Installable**: passes Lighthouse PWA checks (desktop + Android)
- ✅ **Update Flow**: service worker checks for updates and prompts via toast.

## How to Install
- On **Chrome/Edge (desktop)**: click the "Install" button in the address bar.
- On **Android (Chrome)**: open the menu : → *Add to Home Screen*.
- On **iOS Safari**: use *Share → Add to Home Screen*.

---

## Planned for v1.3.0+
- Install prompt button inside the app (`beforeinstallprompt`).
- More granular runtime cache control.
- Expanded offline functionality (view/edit logs when fully offline).
- JSON schema versioning for imports/exports.