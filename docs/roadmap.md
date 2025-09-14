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

### 👨🏻‍💻 Version 1.3 — Power-User Features
- [ ] Undo for deletes/finishes
  _AC:_ Toast with "Undo" restores book/session if clicked.
- [ ] Inline editing of book details
  _AC:_ Change title, author, genre, or status without re-adding.
- [ ] Reading session history view
  _AC:_ Table of sessions with edit/delete options.
- [ ] Smarter search (multi-token, fuzzy)
  _AC:_ "har pot" matches "Harry Potter."
- [ ] In-app install button (`beforeinstallprompt`)
  _AC:_ User can install directly from toolbar.
- [ ] JSON schema versioning
  _AC:_ Backup file includes version; import migrates older versions.
- [ ] Keyboard shortcuts & QoL
  _AC:_ Arrow keys increment/decrement goals; Enter saves; dark mode logo polish.

Planned: Q4 2025

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

### 🎨 Version 2.3 — UI & Experience
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
- Statistics dashboard (books read per month, genres, etc.)
- Data visualization (charts of reading progress)
- Export to additional formats (CSV, Markdown, PDF)
- Integration with external APIs (e.g., Goodreads)
- Team collaboration features (shared reading groups)

---

## 🤝 Contributing to the Roadmap
- Check [open issues](https://github.com/conorgregson/reading-log-app/issues) ofr active discussions.
- Suggest new features via the [feature request template](https://github.com/conorgregson/reading-log-app/issues/new?template=feature_request.md).
- Contributions welcome for both the current vanilla JS app and the future MERN build.