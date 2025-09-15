# Changelog — Readr  
All notable changes to **Readr** (reading log app) will be documented in this file.  

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and we aim to follow [Semantic Versioning](https://semver.org/).  

## [v1.3.0] — UI & Accessibility Overhaul (2025-09-15)

### Added
- New **gear-triggered Settings dropdown** with animation and full keyboard navigation (↑/↓/Home/End, Enter/Space).
- **Accessibility overhaul**: ARIA roles (`menu`, `menuitem`, `menuitemcheckbox`), `aria-expanded`, `aria-checked`, screen-reader hints.
- Theme token **`--hover-bg`** with light/dark values.
- Stronger **focus-visible** states for gear and menu items.

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