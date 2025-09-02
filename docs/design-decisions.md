# Design Decisions

This page explains the technical and design choices behind **Readr**, including current trade-offs and long-term plans for scaling into a full-stack app.

---

## 🖥️ Current Technology Stack (v1.0)

### Vanilla JavaScript
- **Decision**: Use plain JavaScript, HTML, and CSS>
- **Rationale**: Keeps the project lightweight and dependency-free, ideal for a learning/demo project.
- **Trade-off**: Less abstraction and tooling compared to React and Vue.

### localStorage for Persistence
- **Decision**: Store data in the browser's `localStorage`.
- **Rational**: Provides instant offline-first persistence without a backend.
- **Trade-off**: Limited to ~5MB and not accessible across devices.

### JSON for Data Portability
- **Decisions**: Use `.json` files for import/export of the reading log.
- **Rational**: JSON is human-readable, widely supported, and matches the app's internal data structures.
- **Trade-off**: Requires manual import/export and has no built-in sync.

---

## 🎨 User Interface

### Minimal UI
- **Decisions**: Keep the interface simple with core buttons (Add, Import, Export).
- **Rational**: Prioritize ease of use and low barrier to entry.
- **Trade-off**: Fewer customization options (tags, categories, etc.).

### Color Scheme
- **Decisions**: Teal (#008080) chosen as the primary accent color.
- **Rational**: Calming and readable against the white background.
- **Trade-off**: Less vibrant than alternatives, but consistent with a minimal theme.


---

## ⚖️ Current Trade-offs

- **Simplicity vs. Features**: Started small to ensure reliability before adding complexity.
- **Local Storage vs. Cloud Sync**: Chose simplicity over multi-device sync for the first release.
- **Frameworks vs. Vanilla JS**: Avoided framework overhead to emphasize clarity and portability.

---

## 🔮 Future Architecture Plans (MERN Upgrade)

While v1.0 focuses on simplicity, the long-term plan is to evolve into a **full-stack MERN application**:

### React (with JSX)
- **Why**: Component-based UI for scalability and state management.
- **Benefit**: Cleaner structure, easier to extend with features like sorting, filtering, and dark mode.
- **Trade-off**: Adds build tooling and dependency management.

### Express + Node.js
- **Why**: Provide an API layer for reading log data.
- **Benefit**: Enables cloud sync, per-user data, and a clear separation of concerns.
- **Trade-off**: Requires server hosting and deployment management.

### MongoDB (Atlas)
- **Why**: Flexible, document-based database that matches JSON structure.
- **Benefit**: Natural fit for the app's current data format, scalable for growth.
- **Trade-off**: Introduces complexity beyond the browser-only model.

### Styling (Bootstrap or Tailwind)
- **Why**: Faster UI development with responsive layouts and professional design.
- **Benefit**: Improves look-and-feel, mobile responsiveness, and accessibility.
- **Trade-off**: Requires learning additional styling conventions. 

---

## Transition Strategy
1. Maintain the **vanilla version** as a lightweight demo (`/legacy`).
2. Build a new **React frontend** that initially works with `localStorage`.
3. Add an **Express + MongoDB backend** for persistent cloud storage and per-user accounts.
4. Enhance UI with Bootstrap or Tailwind for responsive design.
5. Deploy client (Netlify/Vercel) and server (Render/Railway) with enviornment variables for config.

---

## ✅ Why This Approach Works

- **Shows intentional design**: Current tech matches project goals today.
- **Future-proof**: Clear path to scale when the project evolves.
- **Portfolio-ready**: Demonstrates both minimalism and architectural foresight.