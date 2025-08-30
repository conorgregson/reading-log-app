// *Genres/sub-genres*
// F = Fantasy
// SF = Science Fiction
// M = Mystery
// HF = Historial Fiction
// CB = Graphic Novel
// GD = Grimdark
// CY = Cyberpunk
// CR = Crime
// CF = Classic Fantasy
// UF = Urban Fantasy
// HU = Humor
// SP = Superpowers
// SO = Space Opera
// MS = Military Science Fiction
// CL = Classics
// AS = Asian Asthetic
// MY = Mythology
// R = Robots
// V = Vampires
// Z = Zombies
// D = Dystopian
// PA = Post-Apocalypse
// A = Apocalypse
// YA = Young Adult
// C = Children's
// H = Horror
// AH = Alt History
// HS = History
// 
// MA = Manga
// SH = Shonen
// SE = Seinen
// IS = Isekai


// *Function*
// Search function
// Add title
// Add author
// Add series/stand-alone
// Add book number in series
// Add genre
// Date started
// Date finished
// Number of pages
// Own/Borrowed
// Physical/Digital
// Finished
// Number of book owned
// Number of books read
// Rating
// Alphabetical order
// Newly Added
// Series tab
// All books tab
// Genre tab
// Filter function
// Lists number of books in genre
// Lists number of books in series
// Light mode/dark mode

/* 
========================================================
Reading Log — Phase 0 Plan (expanded)
========================================================

Goal
  - Track books & reading progress with local persistence (Phase 1).
  - Upgrade path to React/MERN without changing core data model.

Entities (stored)
  Book {
    id: number,                // Date.now()
    title: string,             // required
    author: string,            // required
    series?: string,           // empty = standalone
    seriesNumber?: number,
    genre?: string,
    pagesTotal?: number,
    ownedOrBorrowed?: "owned" | "borrowed",
    format?: "physical" | "digital",
    status: "planned" | "reading" | "finished",
    coverUrl?: string,         // or Data URL
    isbn?: string,
    rating?: number,           // 1–5
    notes?: string,
    plannedMonth?: "YYYY-MM",  // for TBR
    startedAt?: string,        // ISO
    finishedAt?: string,       // ISO
    collectionIds?: string[],  // link to Collections
    createdAt: string,         // ISO
    updatedAt: string          // ISO
  }

  ReadingLog {
    id: number,
    bookId: number,
    date: string,              // ISO (session date)
    pagesRead?: number,
    minutes?: number,
    note?: string
  }

  Collection {
    id: string,
    name: string,
    description?: string,
    createdAt: string
  }

  Profile {
    id: string,
    displayName?: string,
    dailyGoal?: { type: "pages" | "minutes", value: number },
    monthlyGoal?: { month: "YYYY-MM", books?: number, pages?: number }[],
    yearlyGoal?: { year: number, books?: number, pages?: number }[],
    theme?: "light" | "dark" | "system"
  }

Storage (localStorage)
  Key: "readinglog.v2"
  Shape: { books: Book[], logs: ReadingLog[], collections: Collection[], profile: Profile }

Computed (derive at render time; do NOT store)
  - Book progress: sum(log.pagesRead) → percent, pagesLeft, ETA
  - Streaks/goals: current & max streak from daily totals
  - Profile rollups: totals (owned/borrowed/read/pages), best reads per year
  - Max pages/day & per year; max books per year
  - Series & genre summaries: counts by group

MVP Features (Phase 1)
  - Add/Delete book; status update (planned/reading/finished)
  - Search: title/author/series/genre/isbn (case-insensitive)
  - Filters: author/genre/series/status/ownedOrBorrowed/format
  - Sort: title A↕, createdAt new↕, author A↕, series A↕
  - Reading logs: add session (pages or minutes); default date = today
  - Progress bar, % read, pages left (computed)
  - Daily goal indicator; light/dark theme; responsive layout
  - TBR month view; optional cover upload (URL or Data URL)

Nice-to-have (Phase 1.1)
  - Multi-select filters, clear-all, confirm delete + undo
  - Series/Genres grouped views with counts
  - Export/Import JSON, keyboard shortcuts, a11y pass
  - Badges (computed only)

Future
  - Phase 2: React + Tailwind; goal calendar
  - Phase 3: MERN API + auth; import from localStorage
*/

// Storage keys (v1 skeleton)
const BOOKS_KEY = "readinglog.v1";

// Future keys (Session 3+, safe to define now)
const LOGS_KEY = "readinglog.logs.v1";
const PROFILE_KEY = "readinglog.profile.v1";
const COLLECTIONS_KEY = "readinglog.collections.v1";

document.getElementById("reset-app").addEventListener("click", () => {
  if (!confirm("This will erase all the books and logs. Continue?")) 
    return;

  // Quick backup to console before wiping
  try {
    const backup = {
      books: JSON.parse(localStorage.getItem(BOOKS_KEY) || "[]"),
      logs: JSON.parse(localStorage.getItem(LOGS_KEY) || "[]"),
      profile: JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}"),
      collections:JSON.parse(localStorage.getItem(COLLECTIONS_KEY) || "[]"),
      exportedAt: new Date().toISOString()
    };
    console.log("Reading Log backup →", backup);
  } catch {}

  // Remove all known keys (safe even if they don't exist yet)
  localStorage.removeItem(BOOKS_KEY);
  localStorage.removeItem(LOGS_KEY);
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(COLLECTIONS_KEY);

  // Reset in-memory state
  books = [];
  // Only if you've added these later:
  if (typeof logs !== "undefined") {
    logs = [];
  }
  if (typeof profile !== "undefined") {
    profile = { id: "me", dailyGoal: null, theme: "system "};
  }

  // Re-render UI
  if (typeof buildFilterOptions === "function") {
    buildFilterOptions();
  }
  if (typeof buildBookOptions === "function") {
    buildBookOptions();
  }
  if (typeof updateGoalUI === "function") {
    updateGoalUI();
  }
  // Use your central render() if you have it, else renderBooks()
  if (typeof render === "function") {
    render();
  } else if (typeof renderBooks === "function") {
    renderBooks([]);
  }
});

// Backup Data
document.getElementById("backup-data").addEventListener("click", () => {
  const backup = {
      books: JSON.parse(localStorage.getItem(BOOKS_KEY) || "[]"),
      logs: JSON.parse(localStorage.getItem(LOGS_KEY) || "[]"),
      profile: JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}"),
      collections:JSON.parse(localStorage.getItem(COLLECTIONS_KEY) || "[]"),
      exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "readinglog-backup.json";
  a.click();
  URL.revokeObjectURL(url);
});

// Import Data
document.getElementById("import-data").addEventListener("click", () => {
  document.getElementById("import-file").click(); // Trigger file picker
});

document.getElementById("import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!confirm("Importing will overwrite existing books/logs/profile. Continue?")) {
      return;
    }

    // Replace localStorage with imported data (only if kes exist)
    if (data.books) {
      localStorage.setItem(BOOKS_KEY, JSON.stringify(data.books));
    }
    if (data.logs) {
      localStorage.setItem(LOGS_KEY, JSON.stringify(data.logs));
    }
    if (data.profile) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(data.profile));
    }
    if (data.collections) {
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(data.collections));
    }

    // Reload in-memory state
    if (typeof loadBooks === "function") {
      loadBooks();
    }
    if (typeof loadLogs === "function") {
      loadLogs();
    }
    if (typeof loadProfile == "function") {
      loadProfile();
    }

    // Refresh UI
    if (typeof buildFilterOptions === "function") {
      buildFilterOptions();
    } 
    if (typeof buildBookOptions === "function") {
      buildBookOptions();
    }
    if (typeof updateGoalUI === "function") {
      updateGoalUI();
    }
    if (typeof render === "function") {
      render();
    } else if (typeof renderBooks === "function") {
      renderBooks(books);
    }

    alert("Import successful!");
  } catch (error) {
    console.error("Import failed:", error);
    alert("invalid JSON file. Could not import.");
  } finally {
    e.target.value = ""; // reset file input
  }
});