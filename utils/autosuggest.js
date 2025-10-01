// Minimal, dependency-free listbox suggest with ARIA + keyboard support.

export function attachSuggest({ input, getOptions, maxItems = 8 }) {
    if (!input) return () => {};

    // --- ARIA wiring on the input (combobox pattern) ---
    const listboxId = `${input.id || `sug-${Math.random().toString(36).slice(2,8)}`}-listbox`;
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-haspopup", "listbox");
    input.setAttribute("aria-controls", listboxId);

    // Host listbox
    const box = document.createElement("div");
    box.className = "suggest-box";
    box.setAttribute("role", "listbox");
    box.id = listboxId;
    box.hidden = true;
    input.after(box);

    let items = [];
    let active = -1;
    let open = false;

    function genId(prefix) {
        return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function close() {
        box.hidden = true;
        open = false;
        active = -1;
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
    }

    function openBox() {
        if (!items.length) return close();
        box.hidden = false;
        open = true;
        input.setAttribute("aria-expanded", "true");
    }

    // render the listbox to match current `items` and `active`
    function render() {
        box.innerHTML = "";
        const frag = document.createDocumentFragment();
        items.slice(0, maxItems).forEach((text, idx) => {
            const opt = document.createElement("div");
            opt.className = "suggest-item";
            opt.id = genId("opt");
            opt.setAttribute("role", "option");
            opt.setAttribute("aria-selected", active === idx ? "true" : "false");
            if (active === idx) opt.classList.add("active");
            opt.textContent = text;
            opt.addEventListener("mousedown", (e) => {
                e.preventDefault(); // keep focus on input
                pick(idx);
            });
            opt.addEventListener("mouseenter", () => setActive(idx));
            opt.addEventListener("click", () => pick(idx));
            frag.appendChild(opt);
        });
        box.appendChild(frag);
        if (items.length && active < 0) setActive(0);
    }

    // move highlight and ARIA state to index `i`
    function setActive(i) {
        if (!items.length) return;
        active = Math.max(0, Math.min(i, items.length - 1));
        syncActive();
        box.querySelectorAll(".suggest-item")[active]?.scrollIntoView({ block: "nearest" });
    }

    function pick(idx) {
        if (idx < 0 || idx >= items.length) return;
        input.value = items[idx];
        close();
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function filter(q) {
        const all = (getOptions?.(q) ?? getOptions?.() ?? []).filter(Boolean);
        const needle = (q || "").trim().toLowerCase();
        if (!needle) {
            items = all.slice(0, maxItems);
        } else {
            // simple contains; favors prefix
            items = all
                .map((v) => String(v))
                .filter((v) => v.toLowerCase().includes(needle))
                .sort((a, b) => {
                    const ap = a.toLowerCase().startsWith(needle) ? 0 : 1;
                    const bp = b.toLowerCase().startsWith(needle) ? 0 : 1;
                    return ap - bp || a.localeCompare(b);
                });
        }
        active = -1;
        render();
    }

    // Events
    input.addEventListener("input", () => {
        filter(input.value);
        openBox();
    });
    input.addEventListener("focus", () => {
        filter(input.value);
        openBox();
    });
    input.addEventListener("blur", () => {
        // slight delay so mousedown can run
        setTimeout(close, 100);
    });
    input.addEventListener("keydown", (e) => {
        if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            filter(input.value);
            openBox();
            e.preventDefault();
            return;
        }
        if (!open) return;
        if (e.key === "ArrowDown") {
            active = Math.min(active + 1, Math.max(items.length - 1, 0));
            syncActive();
            e.preventDefault();
        } else if (e.key === "ArrowUp") {
            active = Math.max(active - 1, 0);
            syncActive();
            e.preventDefault();
        } else if (e.key === "Enter") {
            if (active >= 0) { 
                pick(active); 
                e.preventDefault(); 
            }
        } else if (e.key === "Escape") {
            close();
            e.preventDefault();
        } else {
            // let typing/editing keys pass through
        }
    });

    const onDocClick = (evt) => {
        if (evt.target !== input && !box.contains(evt.target)) close();
    };
    document.addEventListener("click", onDocClick);

    function syncActive() {
        const opts = box.querySelectorAll(".suggest-item");
        opts.forEach((el, idx) => {
            el.classList.toggle("active", idx === active);
            el.setAttribute("aria-selected", idx === active ? "true" : "false");
            if (idx === active) input.setAttribute("aria-activedescendant", el.id);
        });
    }

    // Return a disposer so callers can re-init on dynamic UIs
    return () => {
        document.removeEventListener("click", onDocClick);
        box.remove();
    };
}

// Helper for unique, sorted field suggestions from a book array
export function uniqueFieldValues(books, field) {
  const set = new Set();
  for (const b of books || []) {
    const v = (b?.[field] || "").toString().trim();
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}