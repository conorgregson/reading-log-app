# Roadmap

This roadmap outlines the development priorities for **Readr**.
It balances the current lightweight version with a clear path toward a full-stack MERN application.

---

## 🎯 Goals

- Provide a minimal, offline-first reading log (v1.0).
- Gradually evolve into a MERN-based app with cloud sync and advanced features.
- Maintain clarity and simplicity at each stage.

---

## 📌 Milestones

### ✅ Version 1.0 — Core MVP Release

- [x] Core CRUD (Add books, display list)
      _AC:_ I can add a book and see it in the list; it stays after refresh.
- [x] Import/Export JSON backups
      _AC:_ Export downloads a JSON file; importing the same file restores books.
- [x] Persist data in localStorage
      _AC:_ Books remain after closing/reopening browser.
- [x] Seed data for demos
      _AC:_ Demo books show up on first use.
- [x] SemVer release tagging
      _AC:_ A `v1.0.0` tag after completion, with short release notes.

Released: Sep 2025

---

### ✅ Version 1.1 — Usability & Goals Update

- [x] Sorting and filtering
      _AC:_ Sort by title/author/date; filter by status (e.g., “Reading”).
- [x] Clear messages for import/export
      _AC:_ Shows “Import successful” or “Error: invalid file.”
- [x] Expanded sample seed data
      _AC:_ At least 10 demo books with different statuses.
- [x] Small UI fixes
      _AC:_ Buttons spaced evenly; text easy to read.

Released: Sep 2025

---

### ✅ Version 1.2 — Branding & PWA Polish

- [x] Make installable (PWA manifest + service worker)
      _AC:_ Can install to desktop/phone; opens offline.
- [ ] JSON schema versioning (prep for future updates)
      _AC:_ Backup file includes a version number. _(pushed to v1.3.0)_
- [x] Logos, favicon, and branding polish
      _AC:_ Teal and monochrome white wordmark + slogan, favicons, updated README/docs.
- [x] Toast notifications & empty states
      _AC:_ Consistent styles, goal/streak widget polished.
- [x] Social preview assets
      _AC:_ Teal (GitHUb), dark (PWA demo), monochrome white (docs/blog).
- [x] Added `BRAND_ASSETS.md` and `PWA.md` docs
      _AC:_ Brand usage guidelines + PWA install guide.

Released: Sep 2025

---

### ✅ Version 1.3 — Header & Accessibility Refresh

- [x] Consolidated header into a single `#toolbar`
      _Ac:_ App logo left, settings gear right; no duplicate headers or slogans.
- [x] Settings dropdown menu
      _Ac:_ Gear opens animated dropdown; click outside or Esc closes.
- [x] Full keyboard navigation & accessibility
      _Ac:_ ↑/↓/Home/End to move; Enter/Space to activatel menuitems have correct roles (`menuitem`, `menuitemcheckbox`).
- [x] Theme toggle with ARIA state
      _Ac:_ Switch Mode uses `menuitemcheckbox`; `aria-checked` reflects dark/light mode.
- [x] Theming tokens updated
      _Ac:_ Added `--hover-bg` with light/dark values; separated `--border` and `--track`.
- [x] Removed legacy classes
      _Ac:_ `.brand`, `.wordmark`, `.logo`, `.slogan` deleted from CSS/HTML.

Released: Sep 2025

---

### ✅ Version 1.4 — Power-User Features

- [x] Undo for mistakes
      _AC:_ Recover a book or session after delete/finish within ~6s window.
- [x] Inline editing
      _AC:_ Edit book details in-place; save/cancel flows work without re-adding.
- [x] Smarter search
      _AC:_ Support fuzzy/typo tolerance and partial tokens (“Hobbot” → Hobbit, “har pot” → Harry Potter).
- [x] Session history view
      _AC:_ Paginated table; edit/save/delete row actions; Undo restores last delete.
- [x] Install app button in Settings
      _AC:_ Green action; hybrid flow (retry if dismissed, disable after accepted).
- [x] **Install status pill beside Install app**
      _AC:_ Small badge shows Unavailable → Ready → Installed; updates live without reload.
- [x] One-click Reset Preferences
      _AC:_ Grey action in Settings; clears filters/sort and re-renders list.
- [x] Predictable updates
      _AC:_ “Check updates” reloads app when a new Service Worker takes over.
- [x] Modular refactor
      _AC:_ `app.js` slimmed down into `features/`, `utils/`, `ui/` modules; smoke tests cover Undo, Install, storage migration.

Released: Sep 2025

---

### ✅ Version 1.5 — Book Enhancements

- [x] Add Series / Stand-alone flag for books
  - _AC_: User can mark book as part of a series or stand-alone.
- [x] Add Digital/ Physical flag for books
  - _AC_: User can mark book as physical or digital.
- [x] Optional IBSN field
  - _AC_: ISBN field is optional and stored if provided.
- [x] Dropdown auto-suggest in logs based on author, series, genre
  - _AC_: When typing in logs, suggestions appear from existing metadata.
- [x] Switch status flow: Planned → Reading → Finished (buttons styled to match theme/mode)
  - _AC_: User can change status via consistent theme-colored buttons
- [x] Bulk edit for status/genre
  - _AC:_ Select multiple books and change their status or genre at once.
- [x] A11y: field labels and bulk-edit modals fully operable via keyboard

Released: Sep 2025

---

### ✅ Version 1.6 — Search & Filters

- [x] Add dedicated **Search button** (in addition to instant search)
  - _AC:_ Search can be triggered explicitly via button.
- [x] Autocomplete suggestions for queries (author, title, series, genre)
  - _AC:_ Typing in search shows dropdown of likely matches.
- [x] Advanced filters (multi-select for genre/status)
  - _AC:_ User can filter by multiple genres or statuses simultaneously.
- [x] Save favorite searches/filters
  - _AC:_ User can save a filter combo and reapply it with one click.
- [x] Clear all filters button
  - _AC:_ Reset restores unfiltered book list instantly.

Released: Oct 2025

---

### ✅ Version 1.7 — Goals & Layout Polish

[x] Extra spacing between daily goal inputs and progress bar

- _AC:_ Inputs and progress bar visually separated for clarity.
- [x] Better layout for book goals (monthly/yearly targets grouped visually)
  - _AC:_ Monthly and yearly goal inputs clearly grouped with save button.
- [x] Browse **past goals** from previous months/years
  - _AC:_ User can view and scroll through archived goals.
- [x] Weekly/monthly summaries + streak indicators
  - _AC:_ App shows summaries and highlights streak progress.
- [x] Goal reminder notifications (optional)
  - _AC:_ User can opt in to daily/weekly reminders about goals.
- [x] A11y: summaries and streaks announced by screen readers

Released: Nov 2025

---

### 📖 Version 1.8 — Sessions & History

- [ ] Search across past reading sessions
  - _AC:_ Sessions view supports keyword/date search.
- [ ] Filter sessions by book or date range
  - _AC:_ Sessions can be narrowed by book title or date range.
- [ ] Accessibility upgrades for history table (ARIA labels, keyboard support)
  - _AC:_ History table fully navigable by screen reader and keyboard.
- [ ] Session import/export improvements
  - _AC:_ Sessions included in JSON backups; import gracefully handles missing fields.
- [ ] Quick-add session shortcut
  - _AC:_ User can log a session with fewer clicks via “+ Session” button in toolbar.

Planned Q4 2025

---

### 🎨 Version 1.9 — Visualization & Motivation

- [ ] Basic charts (per-book progress, per-day trend)
  - _AC:_ User can view charts generated from session data.
- [ ] Badges for hitting goals (gamification light)
  - _AC:_ App awards visible badges for milestone completions.
- [ ] Keyboard shortcuts for quick session logging
  - _AC:_ User can press shortcut keys to add sessions without using mouse.
- [ ] Shareable progress snapshot
  - _AC:_ Export/share an image of current stats (books read, streaks).
- [ ] A11y: badges and charts have alternative text summaries

Planned Q4 2025

---

### 🚀 Version 2.0 — React Frontend (MERN Start)

- [ ] Scaffold React app (with JSX)
      _AC:_ `npm run dev` starts without errors; root component renders; README has “How to run."
- [ ] Port Add/Import/Export as React components
      _AC:_ All three features behave the same as v1.0.0; import rejects invalid JSON.
- [ ] Choose styling framework (Bootstrap or Tailwind; match teal theme)
      _AC:_ One shared Button (or Card) component implemented; teal `#008080` used consistently.
- [ ] CI: type check (optional TS), lint, unit tests on PRs
      _AC:_ `npm test` passes locally; `npm run lint` or precommit hooks catch obvious issues.

Planned: Q4 2025

---

### 🌐 Version 2.1 — Express API + MongoDB

- [ ] Setup Node/Express backend
      _AC:_ `npm start` serves `/health` → 200 JSON `{status:"ok"}`.
- [ ] Define `Book` model in MongoDB
      _AC:_ Schema includes: title, author, status, createdAt; rejects empty title/author.
- [ ] CRUD API routes for books (+ pagination)
      _AC:_ POST/GET/PUT/DELETE return proper status codes; GET supports `?page=&limit=`.
- [ ] Connect React frontend to API
      _AC:_ List loads from API; adding a book updates UI without manual refresh.
- [ ] Import/Export via API
      _AC:_ POST `/import` accepts backup JSON; GET `/export` returns current books.
- [ ] Security baseline: HTTPS-only doc + Helmet/CORS/rate limiting
      _AC:_ Helmet enabled, CORS restricted to frontend URL, basic rate limiting applied.

Planned: Q1 2026

---

### 🔑 Version 2.2 — Authentication (Optional but recommended)

- [ ] Add per-user accounts (JWT or OAuth)
      _AC:_ Signup/login works; passwords hashed; tokens signed with secret.
- [ ] Scope reading logs to users
      _AC:_ Users only sees and modify their own books; 401/403 returned otherwise.
- [ ] Secure routes and API access
      _AC:_ Auth middleware validates tokens; refresh/expiry rules documented.
- [ ] Token storage strategy documented
      _AC:_ One-paragraph note in README explains where tokens live (cookie vs storage) and why.

Planned: Q2 2026

---

### 👨🏻‍💻 Version 2.3 — UI & Experience

- [ ] Dark mode toggle
      _AC:_ Toggle persists across reload; system preference respected on first load.
- [ ] Notes/annotations per book
      _AC:_ Add/edit/delete a note inline; notes persist in DB.
- [ ] Responsive design (Bootstrap/Tailwind layouts)
      _AC:_ Works on ~360px wide; no horizontal scroll; tap targets ≥ 44px.
- [ ] Empty states & toasts for better UX
      _AC:_ Empty list shows a friendly hint; add/delete triggers a toast.

Planned: Q2 2026

---

### 🌍 Version 3.0 — Deployment & Growth

- [ ] Deploy backend (Render, Railway, or Fly.io)
      _AC:_ Public URL `/health` is 200; env vars set server-side.
- [ ] Deploy frontend (Netlify or Vercel)
      _AC:_ Public URL loads app and communicates with live API.
- [ ] Environment variable setup for API URLs
      _AC:_ No hard-coded localhost in production build; README lists `.env` keys.
- [ ] CI/CD pipeline (build, test, deploy)
      _AC:_ README explains deployment process; minimal script included.
- [ ] Public demo with live data sync
      _AC:_ Demo account works; reset/demo steps documented.

Planned: Q3 2026

---

## 🔮 Long-Term Ideas

- Tags and categories for books
  _AC:_ User can add/remove free-form tags and select one category per book.
  _AC:_ Tags autocomplete from existing tags; new tags can be created inline.
  _AC:_ Filter panel supports multi-select by tags and single-select by category.
  _AC:_ Tag and category choices persist across app reloads and appear in backups/exports.
  _AC:_ Bulk edit lets user add/remove a tag to multiple selected books.
  _AC:_ A11y: tag editor is fully keyboard-operable (Tab, Enter to confirm, Backspace to remove); screen readers announce “tag added/removed”.

- Statistics dashboard (books read per month, genres, etc.)
  _AC:_ Dashboard shows monthly books read, total pages/minutes, top genres, average session length for a selected time range.
  _AC:_ Time range selector supports presets (This month, Last 3 months, Year to date) and custom dates.
  _AC:_ Metrics update instantly when the range changes (≤150ms on typical datasets).
  _AC:_ Clicking a metric or chart segment deep-links to the filtered Books/Sessions view.
  _AC:_ Data remains correct after import/migration; missing fields are handled gracefully (excluded and noted).
  _AC:_ A11y: each card has an accessible name/description; charts include text summaries for screen readers.

- Data visualization (charts of reading progress)
  _AC:_ Provide at least these charts: Line (daily/weekly reading time or pages), Bar (books completed per month), Donut/Pie (genre distribution).
  _AC:_ Hover tooltips show exact values; legends toggle series on/off.
  _AC:_ Export chart image (PNG/SVG) and data (CSV) per chart.
  _AC:_ Charts reflect active filters (date range, tags, category, status).
  _AC:_ Performance: charts render ≤300ms for 2k+ sessions on mid-range devices.
  _AC:_ A11y: keyboard focusable data points/legend toggles; “Describe chart” text available for screen readers.

- Export to additional formats (CSV, Markdown, PDF)
  _AC:_ Export dialog lets user choose CSV, Markdown, or PDF, with scope options: Books, Sessions, or Both.
  _AC:_ CSV uses stable headers and UTF-8; Markdown includes readable tables and totals; PDF is paginated with header/footer & date range.
  _AC:_ Exports respect active filters and selected time range.
  _AC:_ File names include app name, data type, and ISO date (e.g., readr-books-2025-10-01.csv).
  _AC:_ Large exports (5k+ rows) stream or chunk without freezing UI; user sees progress and success/failure toast.
  _AC:_ A11y: export flow operable with keyboard; buttons have clear labels; progress is announced to screen readers.

- Integration with external APIs (e.g., Goodreads)
  _AC:_ User can connect an external account via OAuth; connection state is visible and revocable.
  _AC:_ After connect, user can import book metadata (title, author, cover, ISBN, genres) and optionally sync reading status.
  _AC:_ Conflicts show a clear merge dialog (keep local / keep remote / merge fields); user choice is remembered per field when selected.
  _AC:_ Rate-limit and error states display actionable messages (retry/backoff) without data loss.
  _AC:_ Privacy: user consent required before any data leaves the device; a clear Disconnect & delete option removes tokens and remote copies if supported.
  _AC:_ A11y: OAuth flow and merge dialogs are labeled, focus-trapped, and fully keyboard accessible.

- Team collaboration features (shared reading groups)
  _AC:_ User can create/join a Group and invite members by link or email.
  _AC:_ Group has shared reading lists, sessions feed, and goal board; each item shows author and timestamp.
  _AC:_ Permissions: Owner/Moderator/Member roles control invite, edit, and delete actions; defaults are least-privilege.
  _AC:_ Presence/conflict: optimistic UI shows edits immediately; concurrent edits resolve with last-writer wins + non-destructive history for recovery.
  _AC:_ Notifications (in-app) for mentions, new sessions on a followed book, and milestone completions; user can mute per group.
  _AC:_ Export honors group scope (own data vs. group aggregate) and redacts private fields when required.
  _AC:_ A11y: all group actions operable via keyboard; live region announces new posts/sessions.

- Offline sync & conflict resolution
  _AC:_ Changes made offline sync automatically when back online.
  _AC:_ Conflict resolution shows clear merge options (keep local/remote/both).
  _AC:_ Sync status visible (Last synced at …).
  _AC:_ A11y: sync indicators have text equivalents for screen readers.

- Customizable home dashboard
  _AC:_ User can add/remove widgets (e.g., current streak, top genres, quick add).
  _AC:_ Widgets can be reordered via drag-and-drop (keyboard accessible).
  _AC:_ Preferences persist across sessions and devices.

- Reading reminders & notifications
  _AC:_ User can schedule reminders (daily/weekly at chosen time).
  _AC:_ Notifications integrate with browser/mobile (push API).
  _AC:_ Snooze/dismiss flows are accessible and persist user choices.

- Audiobook & media support
  _AC:_ Books can be marked as “Audiobook” or “Other media type”.
  _AC:_ Session logging supports listening time alongside pages/minutes.
  _AC:_ Stats and charts include listening data in totals.

- Custom fields & templates
  _AC:_ User can define custom fields (e.g., translator, edition, language).
  _AC:_ Fields are included in add/edit dialogs, exports, and filters.
  _AC:_ Templates allow reusing field sets when adding similar books.

- Reading challenges & public profiles
  _AC:_ User can set public yearly challenges (e.g., “Read 20 books in 2026”).
  _AC:_ Public profile URL shows selected stats/goals.
  _AC:_ Privacy controls let user toggle what’s visible (books, sessions, goals).

- AI-powered insights (optional)
  _AC:_ Generate summaries of reading habits (e.g., “Most active on Sundays”).
  _AC:_ Suggest books based on tags, genres, and past completions.
  _AC:_ Recommendations explain _why_ (transparent reasoning).
  _AC:_ Opt-in only; clear toggle to disable insights.

---

## 🤝 Contributing to the Roadmap

- Check [open issues](https://github.com/conorgregson/reading-log-app/issues) ofr active discussions.
- Suggest new features via the [feature request template](https://github.com/conorgregson/reading-log-app/issues/new?template=feature_request.md).
- Contributions welcome for both the current vanilla JS app and the future MERN build.
