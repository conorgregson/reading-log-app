// Quick smoke tests for versioned backups + migration

import { migrateBackup, importBackup, exportBackup, SCHEMA_VERSION } from "../utils/storage.js";

// tiny assert helpers
function ok(cond, msg) {
  if (!cond) throw new Error("❌ " + msg);
  console.log("✅", msg);
}
function eq(a, b, msg) { ok(Object.is(a, b), `${msg} (expected ${b}, got ${a})`); }

export async function runStorageSmoke() {
  console.group("Storage / Migration smoke");

  // Clean slate
  localStorage.clear();

  // --- 1) v0 → v1 migration shape ---
  const v0 = {
    version: 0,
    logs: [
      { id: "b1", title: "Harry Potter", author: "Rowling", status: "reading", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "b2", title: "Dune", author: "Herbert", status: "unread" }, // missing createdAt on purpose
    ]
  };

  const mig = migrateBackup(v0);
  eq(mig.version, SCHEMA_VERSION, "Migrated backup is at current SCHEMA_VERSION");
  ok(Array.isArray(mig.items) && mig.items.length === 2, "Migrated items present");
  ok(mig.items.every(b => b.id && b.title && b.author), "Items minimally shaped");

  // --- 2) importBackup() persists items + meta ---
  const imported = importBackup(v0); // should migrate then save
  ok(Array.isArray(imported.warnings), "importBackup returns warnings array");
  eq(imported.version, SCHEMA_VERSION, "importBackup returns current version");
  ok(!!localStorage.getItem("readr.logs.v1"), "Logs saved to localStorage");
  const meta = JSON.parse(localStorage.getItem("readr.meta.v1") || "{}");
  eq(typeof meta.count, "number", "META has count");
  ok(!!meta.savedAt, "META has savedAt");
  ok(meta.version === SCHEMA_VERSION, "META records version");

  // --- 3) exportBackup() includes version + items round-trip ---
  const backup = exportBackup();
  eq(backup.version, SCHEMA_VERSION, "exportBackup includes version");
  ok(Array.isArray(backup.items), "exportBackup returns items array");
  ok(backup.items.length === 2, "exportBackup item count matches");

  // --- 4) Import of already-current version (idempotent) ---
  const imported2 = importBackup(backup);
  eq(imported2.version, SCHEMA_VERSION, "Re-import of v1 stays v1");
  ok(Array.isArray(imported2.items), "Re-import returns items array");
  ok(Array.isArray(imported2.warnings), "Re-import also returns warnings array");

  console.log("🎉 Storage/migration smoke passed.");
  console.groupEnd();
}
