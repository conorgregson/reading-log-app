// storage.js — Backup/Import helpers for Readr v1.0

function backupAll() {
  return {
    version: "v1",
    exportAt: new Date().toISOString(),
    books: JSON.parse(localStorage.getItem("readinglog.v1") || "[]"),
    logs: JSON.parse(localStorage.getItem("readinglog.logs.v1") || "[]"),
    profile: JSON.parse(localStorage.getItem("readinglog.profile.v1") || "null")
  };
}

function  downloadJSON(filename, dataObj) {
  const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}

function wireBackupImportUI() {
  const backupBtn = document.getElementById("backup-data");
  const importBtn = document.getElementById("import-data");
  const fileInput = document.getElementById("import-file");

  if (backupBtn) {
    backupBtn.addEventListener("click", () => {
      downloadJSON("readr-backup.json", backupAll());
      alert("Backup downloaded!");
    });
  }

  if (importBtn && fileInput) {
    importBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) {
        return
      }

      try {
        const text = await file.text();
        const json = JSON.parse(text);

        if (!json || !Array.isArray(json.books)) {
          throw new Error("Invalid JSON");
        }

        localStorage.setItem("readinglog.v1", JSON.stringify(json.books || []));
        localStorage.setItem("readinglog.logs.v1", JSON.stringify(json.logs || []));
        localStorage.setItem("readinglog.profile.v1", JSON.stringify(json.profile || null));
        
        alert("Import successful!");
        location.reload();
      } catch {
        alert("Invalid JSON file. Could not import.");
      } finally {
        fileInput.value = "";
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", wireBackupImportUI);