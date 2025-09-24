# Changelog — Readr  
All notable changes to **Readr** (reading log app) will be documented in this file.  

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and we aim to follow [Semantic Versioning](https://semver.org/).  

## [v1.4.1] — Button & Progress Fixes (2025-09-24)

### Fixed
- Corrected Settings menu button IDs so **Backup data**, **Import data**, and **Reset Preferences** now work as intended.
- Progress bar thresholds updated: properly transitions **red → yellow → green** at defined milestones.
- Ensured Switch Mode and Clear Cache remain functional after cache/service worker refresh.

### Changed
- Added four new **screenshots** to the README:
  - Main UI
  - Daily Goal, Book Goals, Add Reading Session, and Session History
  - Books list (populated)
  - Dark mode

---

## [v1.4.0] — Power-User Features (2025-09-23)

### Added
- Undo for mistakes → recover a book or session after delete/finish
- Inline editing for book details
- Smarter fuzzy search (typo + partial token tolerance)
- Session history view with table, edit/delete, and pagination
- Install app button in Settings, styled green with hybrid state handling
- **Install status pill → small live badge beside Install app showing Unavailable, Ready, or Installed**
- One-click Reset Preferences in Settings
- Predictable updates → Check updates reloads when a new Service Worker takes over

### Changed
- Modular refactor: slimmed down `app.js` into dedicated modules under `features/`, `utils/`, and `ui/`
- Reset Preferences styled grey for clear affordance
- Global focus ring (teal / aqua in dark mode) and hover underline for links
- Dev smoke tests added for Undo, Install button, and storage migration
- New release tooling: `dev/bump-version.js` auto-bumps SW cache + HTML script query params

### Fixed
- Search highlights now map normalized matches back to original text (accents/dashes)
- Tooltip positioning corrected on resize/scroll (no stale values)
- Service Worker hardened: cache version bumped, modules precached, no unsafe calls
- Import validator corrected: OR logic, proper `items` key, normalized statuses
- Session history pagination labels + Next/Prev use shared `totalPages`

### Notes
- No breaking changes — existing backups continue to work
- First load after deploy refreshes pre-cache; already-open tabs auto-reload on SW `controllerchange`
- Reset Preferences clears `readr:filters:v1` and re-renders list
- Undo applies only to the most recent delete/finish (~6s)
- Backups include version field; old backups migrate automatically
- Release process: bump SW VERSION, update `?v=` query params, then run `npm run release:check`

---

## [v1.3.3] — Bug Fixes (2025-09-16)

### Fixed
- Restored daily goal progress bar updates after logging sessions.
- Fixed missing color states (green/amber/red) on progress bar fill.
- Corrected render behavior in module mode by replacing `window.render` guards with direct calls.
- Added CSS height rule to ensure progress bar fill is visible.
- Minor UI consistency fixes (book filters refresh on new book add).

---

## [v1.3.2] — Security & Bugfixes (2025-09-15)

### Fixed
- Replaced `innerHTML` in `showToast()` with safe DOM construction to eliminate XSS risk.
- Updated `wireImportExport` to pass toast `details` safely without injecting HTML.
- Corrected `<ul>` list items in `renderTodayTooltip()` (now using `<li>` instead of `<strong>`).
- Small typo in tooltip heading ("Todays's entries" → "Today’s entries").
- Minor keyboard navigation bug in settings menu (ArrowUp now uses correct index clamping).

### Notes
- Patch release only; no new features introduced.
- Recommended update for anyone using v1.3.x to ensure secure rendering.

---

## [v1.3.1] — UI Polish & Service Worker Fixes (2025-09-15)

### Changed
- Settings gear label and icon now follow theme text color (dark/light adaptive).
- Added subtle hover/focus polish to gear: background pulse + icon brightens/rotates.
- Reduced-motion users now see simplified opacity/background fade (no spin/pulse).
- Service worker updated to `v1.3.1` with corrected cache versioning.
- Asset URLs (`styles.css`, `app.js`, `storage.js`) now use query-string versioning to ensure live demo updates.

### Notes
This patch release improves **visual polish and accessibility** of the Settings gear, while fixing **service worker caching issues** so GitHub Pages updates reliably show the latest styles and scripts.

---

## [v1.3.0] — UI & Accessibility Overhaul (2025-09-15)

### Added
- New **gear-triggered Settings dropdown** with animation and full keyboard navigation (↑/↓/Home/End, Enter/Space).
- **Accessibility overhaul**: ARIA roles (`menu`, `menuitem`, `menuitemcheckbox`), `aria-expanded`, `aria-checked`, screen-reader hints.
- Theme token **`--hover-bg`** with light/dark values.
- Stronger **focus-visible** states for gear and menu items.
- **Refined menu item interactions**: hover/focus now show a teal accent bar with bold text; active/checked items (e.g., theme toggle) display a persistent bar and stronger emphasis.

### Changed
- **Header** consolidated to a single `#toolbar` with app logo left, Settings gear right.
- **Theme toggle** now uses `menuitemcheckbox` with `aria-checked` to reflect state.
- **Border vs track colors** differentiated for better visual hierarchy.
- CSS selectors simplified (`.r-btn--sm` instead of `.r-btn.r-btn--sm`).

### Removed
- Old header/brand classes: `.brand`, `.wordmark`, `.logo`, `.slogan`.
- Proxy import/export buttons (`#import-btn`, `#export-btn`) in favor of direct menu buttons.

### Notes
This release refreshes the **UI foundation and accessibility**, making the app easier to navigate with keyboard/screen readers and cleaner to extend in future releases.

---

## [v1.2.0] — Branding & PWA Polish (2025-09-14)

### Added
- New teal and monochrome white logos, favicons, and social preview images.
- `BRAND_ASSETS.md` with branding guidelines.
- `PWA.md` with initial PWA documentation.
- Toast notifications for import/export success/errors.
- Update prompt when a new version is available via service worker.
- Project structure refinements:
    - `dev/` folder (`smoke.js`).
    - Added folder (`assets/`) with (`diagrams/`) and (`screenshot/`) folders to `docs/` folder.
    - `features/` folder (`import.js`).
    - `images/` folder (favicons and logos).
    - `ui/` folder (`wire-import-export.js`).
    - `utils/` folder (`aggregate.js`, `download.js`, `formatMs.js`, `storage.js`, `validate.js`).
    - Root-level `manifest.json` and `sw.js`.

### Changed
- Polished UI: goal widget, streak tracker, empty states.
- Improved filters and daily goal interactions.
- Refined dark mode styles

### Fixed
- Service worker cache updates now trigger reliably.
- Minor UI inconsistencies in spacing and alignment.

### Notes
- Passed Lighthouse audits for PWA, accessibility, and SEO.
- Sets the stage for v1.3.0 "Power-User Features."

---

## [v1.1.0] — Usability & Goals Update (2025-09-08)

### Added
- Reading goals widget with daily target setting.
- Filter options for finished, unfinished, and TBR books.
- Expanded see data for initial testing.

### Changed
- Improve import/export flow with clearer messaging.
- Refined book list rendering for better performance.

### Fixed
- Edge cases with empty book lists showing incorrectly.
- Minor style inconsistencies across browsers.

### Notes
- Backup/Import remains compatible
- New fields like `genre`, `finishedAt`, and `bookGoals` are stored in the existing keys.

---

## [v1.0.0] — Core MVP Release (2025-09-07)

### Added
- Core reading log functionality: add, edit, remove books.
- Track pages/minutes read with daily aggregation.
- JSON backup and import with localStorage persistence.
- Theme toggle for light/dark mode.

### Changed
- Improved input validation on book forms.

### Fixed
- Prevented invalid JSON imports from crashing the app.

---

## [v0.1.0] — Project Setup & Templates (2025-09-02)

### Added  
- Initial project skeleton (vanilla JS, HTML, CSS).
- Seed data file for quick testing.
- Documentation and metadata files:
    - `CHANGELOG.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `README.md`, `LICENSE`.
- `.github/` folder with:
    - `SECURITY.md`, `pull_request_template.md`.
    - `ISSUE_TEMPLATE/` folder with `bug_report.md`, `feature_request.md`.
    - `codeql.yml` for code scanning setup.
- `docs/` folder with:
    - `README.md`, `design-decisions.md`, `features.md`, `getting-started.md`, `roadmap.md`, `troubleshooting.md`.
- Basic GitHub Actions workflow for linting.

### Security  
- Documented **private vulnerability reporting via GitHub Security Advisories** (`/security/advisories/new`) instead of email.