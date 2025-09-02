# Features

This page highlights the current capabilities of **Readr** and outlines features planned for future releases, including the full-stack MERN upgrade.

---

## Current Features
- **Offline-first**
    All data is stored locally in you browser with `localStorage`.

- **Add Books**
    Log new books with a simple form.

- **Import/Export JSON**
    - Export your reading log as a `.json` file for backup.
    - Import a previously saved file to restore or share your log.

- **Persistent Storage**
    Data is saved between sessions as long as localStorage is enabled.

- **Seed Data**
    A sample file (`readinglog-seed.json`) is included with three example books for quick testing.

---

## 🗓️ Planned Features (v1.1 — Vanilla Upgrades)
- Sorting and filtering options (by title, author, status)
- Improved error handling for JSON import/export
- Additional sample data for demos
- UI polish for spacing, accessibility, and consistency

---

## 🚀 MERN Features (v2.x and beyond)

### React Frontend
- Component-based UI with JSX
- Routing for pages (Home, Import/Export, etc.)
- Teal theme maintained with either **Bootstrap** or **Tailwind**

### Express + Node.js API
- RESTful endpoints for CRUD operations
- Validation for book data
- Bulk import/export endpoints

### MongoDB (Atlas)
- Flexible, JSON-like schema for books
- Scalable storage beyond local browser limits
- Query support for filtering and sorting

### Authentication (Optional)
- User accounts (JWT or OAuth)
- Per-user reading logs
- Secure API access

### Advanced UI/UX
- Dark mode toggle
- Notes/annotations per book
- Responsive mobile design
- Empty states and toast notifications

---

## 🔮 Long-Term Features
- PWA (Progressive Web App) for mobile/offline use
- Tagging and categorization for books
- Statistics dashboard (books read/month, genres, etc.)
- Export to CSV, Markdown, or PDF formats