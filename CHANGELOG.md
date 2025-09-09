# Changelog — Readr  
All notable changes to **Readr** (reading log app) will be documented in this file.  

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and we aim to follow [Semantic Versioning](https://semver.org/).  

## [Unreleased]  

### Docs
- Add Live Demo links/badges to root and /docs READMEs.

### Infrastructure
- Enable GitHub Pages for live demo.

### Planned  
- Sorting and filtering options for books  
- Clearer error/success messages for import/export  
- Expanded sample seed data  
- Small UI fixes (spacing, accessibility, consistency)  

---

## [v1.1.0] - 2025-09-08
### Added
- Genre field for books, with a datalist so you can pick from existing genres or type a new one. 
- Search that matches across title, author, **series**, genre, and ISBN.
- Multi-select filters for Status, Author, Genre, and Series.
- Book-count goals: set monthly and yearly targets; progress updates when you mark a book as finished.
- “Mark Finished” action on each book entry.

### Changed
- Sorting now defaults to `Newest` (`createdAt:desc`) and supports Title/Author/Series ascending/descending.
- UI lists rebuild immediately on search, filter, sort, and TBR controls.

### Fixed
- Option builders for Author/Genre/Series are generated from current books without duplicates.
- Corrected data attributes for list actions (`data-delete`, `data-finish`) so buttons behave reliably.
- Cleaned up init to avoid duplicate event listeners.

### Notes
- Backup/Import remains compatible; new fields like `genre`, `finishedAt`, and `bookGoals` are stored in the existing keys.

---

## [v1.0.0] — 2025-09-07
### Added
- Vanilla release: add/display books with localStorage persistence.
- JSON backup & import (Download/Import).
- Daily Goal with inline validation; color-changing progress bar (red / amber / green); streak counters.
- Theme toggle including **System** mode with live OS sync.
- Accessibility pass: real labels via `.sr-only`, visible `:focus-visible` outlines, and a `<noscript>` banner.
- Search, sort, and basic multi-select filters; optional TBR month filter.

### Changed
- Date handling uses local `dayKey()` so sessions count for the correct “today.”
- Progress bar now applies state classes to reflect goal percentage.

### Fixed
- `storage.js`: `backupAll()` keys; `downloadJSON()` anchor scope; stricter import validation.
- `app.js`: `loadBooks()` parse typo; `computeStreaks()` logic; theme button label; `matchMedia` string; safe `render()` calls; UTC→local date mismatch; progress color toggling.

---

## [v0.1.0] — 2025-09-02  
### Added  
- **Core App**: Vanilla JavaScript skeleton with `index.html`, `index.js`, and `style.css`.  
- **Persistence**: `localStorage` used to store reading log data between sessions.  
- **Import/Export**: JSON backup/import functionality for reading logs.  
- **Seed Data**: Included `readinglog-seed.json` with three example books.  
- **CHANGELOG.md** to track notable changes.  
- **README**: Community badges for Contributing, Code of Conduct, and “Security: Report a Vulnerability”.  
- **Security policy**: Rules of Engagement, Severity & Target Timelines table, In-Scope/Out-of-Scope examples, Safe Harbor, Researcher Credit, and CVE/advisory note; added Table of Contents.  
- **Bug report template**: Security note + advisory link, Console/Network capture, Sample Data (import/export), Severity, Reproducibility, Workaround, Related Issues/PRs, Additional Context.  
- **Feature request template**: Non-Goals, User Story, Acceptance Criteria, optional UI/UX section, Data Model/Storage changes, Success Metrics, A11y & Security considerations, Risks/Dependencies, Scope/Size estimate, Release Notes, and checklist items (docs + CHANGELOG).  
- **PR template**: Links to README/CONTRIBUTING, Breaking changes prompt, expanded change types (e.g., Refactor/Chore), checklist items for a11y, security considerations, and CHANGELOG updates.  
- **Project Structure (README)** now lists `CHANGELOG.md`.  

### Changed  
- **Naming**: Standardized on “**Readr — Reading Log App**” (first mention), then “Readr”.  
- **Root README**: Updated tagline, setup tracks, and documentation links.  
- **README**: Clarified Installation & Usage; expanded Import/Export with JSON shape; kept Features/Roadmap badge rows; corrected internal paths; added Troubleshooting and Accessibility notes.  
- **Security policy**: Copyedits and clarity improvements; standardized em dashes.  
- **Issue/PR templates**: Headings and wording updated to say “in Readr”; consistent em-dash style; added quick links to README/CONTRIBUTING.  

### Fixed  
- JSON import now properly validates and confirms with “Import successful!” message.  
- Broken relative links in PR template (`../` instead of `../../`).  
- Typos (e.g., “reporoduce”→“reproduce”, “phising”→“phishing”, “degredation”→“degradation”, “ad”→“add”).  
- Quotation mark in “Workaround: None”.  
- “Self-XSS” capitalization; minor punctuation and spacing.  

### Security  
- Documented **private vulnerability reporting via GitHub Security Advisories** (`/security/advisories/new`) instead of email.  
