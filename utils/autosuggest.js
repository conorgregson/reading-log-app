// Minimal, dependency-free listbox suggest with ARIA + keyboard support.

// getOptions may now return either:
//  - flat:    ["Dune","Frank Herbert",...]
//  - grouped: [{ label:"Title",  items:[...strings] },
//              { label:"Author", items:[...strings] }, ...]
export function attachSuggest({ input, getOptions, maxItems = 8, onPick } = {}) {
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

    // items = pickable strings (for keyboard nav and pick())
    let items = [];
    // groups = [{ label, items: [...] }] when grouped, otherwise null
    let groups = null;
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

    // render the listbox to match current `items` / `groups` and `active`
    function render() {
        box.innerHTML = "";
        const frag = document.createDocumentFragment();
        if (groups && groups.length) {
            let pickIdx = 0;
            for (const g of groups) {
                if (!g?.items?.length) continue;
                const header = document.createElement("div");
                header.className = "suggest-group";
                header.setAttribute("aria-hidden", "true");
                header.textContent = g.label || "Suggestions";
                frag.appendChild(header);
                for (const text of g.items) {
                    const idx = pickIdx++;
                    const opt = document.createElement("div");
                    opt.className = "suggest-item";
                    opt.id = genId("opt");
                    opt.setAttribute("role", "option");
                    opt.setAttribute("aria-selected", active === idx ? "true" : "false");
                    if (active === idx) opt.classList.add("active");
                    opt.textContent = text;
                    opt.addEventListener("mousedown", (e) => { e.preventDefault(); pick(idx); });
                    opt.addEventListener("mouseenter", () => setActive(idx));
                    opt.addEventListener("click", () => pick(idx));
                    frag.appendChild(opt);
                }
            }
        } else {
            items.slice(0, maxItems).forEach((text, idx) => {
                const opt = document.createElement("div");
                opt.className = "suggest-item";
                opt.id = genId("opt");
                opt.setAttribute("role", "option");
                opt.setAttribute("aria-selected", active === idx ? "true" : "false");
                if (active === idx) opt.classList.add("active");
                opt.textContent = text;
                opt.addEventListener("mousedown", (e) => { e.preventDefault(); pick(idx); });
                opt.addEventListener("mouseenter", () => setActive(idx));
                opt.addEventListener("click", () => pick(idx));
                frag.appendChild(opt);
            });
        }

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
        const val = items[idx];
        input.value = val;
        // optional external hook (lets callers run search immediately)
        try { onPick && onPick(val); } catch {}
        close();
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function isGrouped(list) {
        return Array.isArray(list) && !!list.length && typeof list[0] === "object" && Array.isArray(list[0].items);
    }

    function normalizeGrouped(all) {
        // Cap to maxItems across ALL groups, in incoming order
        const out = [];
        let total = 0;
        for (const g of all) {
            if (!g?.item?.length) continue;
            const take = Math.max(0, Math.min(maxItems - total, g.items.length));
            if (!take) break;
            out.push({ label: g.label, items: g.items.slice(0, take) });
            total += take;
        }
        // build flat pickable list
        const flat = out.flatMap((g) => g.items);
        return { groups: out, flat }; 
    }

    function filter(q) {
        const raw = (getOptions?.(q) ?? getOptions?.() ?? []);
        const all = Array.isArray(raw) ? raw : [];
        const needle = (q || "").trim().toLowerCase();
        if (isGrouped(all)) {
            // assume caller already ranked/filtered; just cap & render with headers
            const norm = normalizeGrouped(all);
            groups = norm.groups;
            items = norm.flat;
        } else {
            groups = null;
            if (!needle) {
                items = all.filter(Boolean).slice(0, maxItems).map(String);
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