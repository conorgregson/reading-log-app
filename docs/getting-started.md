# Getting Started

This guide explains how to set up and run **Readr** in two modes:  
1. **Current Vanilla Version (v1.0)** — lightweight, browser-only.  
2. **Future MERN Version (v2.x)** — React frontend with Node/Express and MongoDB backend.  

---

## ✅ Vanilla Setup (v1.0)

### Requirements
- A modern browser (Chrome, Firefox, Edge, Safari)  
- Optional: [`readinglog-seed.json`](../blob/main/readinglog-seed.json) for demo data  

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/USERNAME/reading-log-app.git
   cd reading-log-app
2. Open `index.html` in your browser. No build tools, no server — just open and use.

### Usage
- **Add book** → Log a new book.
- **Import** → Load a `.json` file into your reading log.
- **Export** → Sace your current reading log as a `.json` file.
- Data is stored in your browser's `localstorage`.

---

## 🚀 MERN Setup (v2.x, In Progress)
When the project evolves into a full-stack app, setup will include separate **client** and **server** steps

### Requirements
- Node.js (LTS version recommended)
- npm or yarn
- MongoDB Atlas account (free tier)

---

## 🔧 Configuration
Before running the MERN stack, configure your enviornment:
1. Copy the example enviornment file:
``` bash
cp .env.example .env
```
2. Open `.env` and replace placeholder values:
- `MONGODB_URI` → your MongoDB Atlas connection string.
- `JWT_SECRET` → a long, random secret string.
- `CLIENT_URL` → your frontend dev URL (default: `http://localhost:5173`).
- `PORT` → port for the Express server (default: `4000`).
⚠️ **Important**: Never commit your `.env` file. Keep it private.

---

**Frontend (React)**
1. Navigate to the React app folder:
```bash 
cd app
npm install
npm run dev
```
2. Open the development server (default: `http://localhost:5173`).

**Backend (Express + MongoDB)**
1. Navigate to the server folder:
``` bash
cd server
npm install
npm run dev
```
2. The API will run at `http://localhost:4000/api/books`.

---

## 📖 Documentation
- [Features](./features.md)
- [Design Decisions](./design-decisions.md)
- [Roadmap](./roadmap.md)
- [Troubleshooting](./troubleshooting.md)