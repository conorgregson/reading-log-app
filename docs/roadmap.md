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

### ✅ Version 1.0 — Vanilla Release
- [x] Core CRUD (Add books, display list)
- [x] Import/Export JSON backups
- [x] Persist data in localStorage
- [x] Seed data for demos

---

### 🔄 Version 1.1 — Usability Improvements
- [ ] Sorting and filtering options
- [ ] Better error handling (clear import/export messages)
- [ ] Expanded sample seed data
- [ ] UI polish (spacing, accessibility tweaks)

Planned: Q3 2025

---

### 🚀 Version 2.0 — React Frontend (MERN Start) 
- [ ] Scaffold React app (with JSX)
- [ ] Port Add/Import/Export as React components 
- [ ] Choose styling framework (Bootstrap or Tailwind)
- [ ] Match teal theme and minimal design

Planned: Q4 2025

---

### 🌐 Version 2.1 — Express API + MongoDB
- [ ] Setup Node/Express backend
- [ ] Define `Book` model in MongoDB
- [ ] CRUD API routes for books
- [ ] Connect React frontend to API
- [ ] Import/Export via API 

Planned: Q1 2026

---

### 🔑 Version 2.2 — Authentication (Optional but recommended)
- [ ] Add per-user accounts (JWT or OAuth)
- [ ] Scope reading logs to users
- [ ] Secure routes and API access

Planned: Q2 2026

---

### 🎨 Version 2.3 — UI & Experience
- [ ] Dark mode toggle
- [ ] Notes/annotations per book
- [ ] Responsive design (Bootstrap/Tailwind layouts)
- [ ] Empty states & toasts for better UX

Planned: Q2 2026

---

### 🌍 Version 3.0 — Deployment & Growth
- [ ] Deploy backend (Render, Railway, or Fly.io)
- [ ] Deploy frontend (Netlify or Vercel)
- [ ] Environment variable setup for API URLs
- [ ] CI/CD pipeline with GitHub Actions
- [ ] Public demo with live data sync

Planned: Q3 2026

---

## 🔮 Long-Term Ideas
- Mobile-friendly PWA for offline-first support
- Tags and categories for books
- Statistics dashboard (books read/month, genres, etc.)
- Data visualization (charts of reading progress)
- Export to additional formats (CSV, Markdown, PDF)
- Integration with external APIs (e.g., Goodreads)
- Team collaboration features (shared reading groups)

---

## 🤝 Contributing to the Roadmap
- Check [open issues](https://github.com/conorgregson/reading-log-app/issues).
- Suggest new features via [feature requests](https://github.com/conorgregson/reading-log-app/issues/new?template=feature_request.md).
- Contributions welcome for both current vanilla app and future MERN build.