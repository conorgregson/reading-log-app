// Owns: "Today's entries" tooltip (render + positioning + events).
// Decoupled via adapters so app state stays outside.

let A = null;

export function initTooltip({ adapters }) {
  A = adapters;
  attachTooltipEvents();
}

export function renderTodayTooltip() {
  const tip = document.getElementById("today-tooltip");
  if (!tip || !A) return;

  // Clear
  tip.textContent = "";

  // Heading
  const h4 = document.createElement("h4");
  h4.textContent = "Today's entries";
  tip.appendChild(h4);

  const entries = getTodayEntries();
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No entries yet today.";
    tip.appendChild(empty);
    return;
  }

  const ul = document.createElement("ul");
  entries.forEach((entry) => {
    const li = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = entry.title;
    const br = document.createElement("br");
    const span = document.createElement("span");
    span.className = "muted";
    span.textContent = entry.what;
    li.append(strong, br, span);
    ul.appendChild(li);
  });

  tip.appendChild(ul);
}

// Internal helpers -----------------------------------------------------------

function getTodayEntries() {
  const today = A.dayKey();
  return A.logs
    .filter((x) => sameDayKey(x.date) === today)
    .map((x) => {
      const parts = [];
      const p = Number(x.pagesRead);
      const m = Number(x.minutes);
      if (Number.isFinite(p) && p > 0) parts.push(`${p} pages`);
      if (Number.isFinite(m) && m > 0) parts.push(`${m} min`);
      return { title: A.getBookTitleById(x.bookId), what: parts.length ? parts.join(" • ") : "—" };
    });
}

function sameDayKey(s) {
  if (!s) return A.dayKey();
  if (typeof s === "string") {
    if (s.length >= 10 && s[4] === "-" && s[7] === "-") return s.slice(0, 10);
    return s.slice(0, 10);
  }
  return A.dayKey(new Date(s));
}

function attachTooltipEvents() {
  const bar = document.getElementById("today-bar");
  const tip = document.getElementById("today-tooltip");
  if (!bar || !tip) return;

  let hideTimer = null;
  let relayoutBound = null;

  const positionTooltip = () => {
    const barRect = bar.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const gap = 0;
    const spaceAbove = barRect.top;
    const spaceBelow = window.innerHeight - barRect.bottom;

    if (spaceBelow >= tipRect.height + gap) {
      tip.style.top = `${Math.round(barRect.bottom + gap)}px`;
      tip.classList.add("pos-below");
    } else if (spaceAbove >= tipRect.height + gap) {
      tip.style.top = `${Math.round(barRect.top - tipRect.height - gap)}px`;
      tip.classList.remove("pos-below");
    } else {
        // pick the larger side and position accordingly
        if (spaceAbove >= spaceBelow) {
            tip.style.top = `${Math.round(barRect.top - tipRect.height - gap)}px`;
            tip.classList.remove("pos-below");
        } else {
            tip.style.top = `${Math.round(barRect.bottom + gap)}px`;
            tip.classList.add("pos-below");
        }
    }
    // center horizontally over bar
    tip.style.left = `${Math.round(barRect.left + (barRect.width - tipRect.width) / 2)}px`;
  };

  const show = () => {
    clearTimeout(hideTimer);
    renderTodayTooltip();
    tip.classList.add("visible");
    tip.setAttribute("aria-hidden", "false");
    positionTooltip();

    if (!relayoutBound) {
      relayoutBound = () => positionTooltip();
      window.addEventListener("resize", relayoutBound, { passive: true });
      window.addEventListener("scroll", relayoutBound, { passive: true });
    }
  };

  const hide = (delay = 120) => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      tip.classList.remove("visible");
      tip.setAttribute("aria-hidden", "true");
      if (relayoutBound) {
        window.removeEventListener("resize", relayoutBound);
        window.removeEventListener("scroll", relayoutBound);
        relayoutBound = null;
      }
    }, delay);
  };

  // hover/focus interactions
  bar.addEventListener("mouseenter", show);
  bar.addEventListener("mouseleave", () => hide(120));
  bar.addEventListener("focusin", show);
  bar.addEventListener("focusout", () => hide(0));

  // click elsewhere hides immediately
  document.addEventListener("mousedown", (e) => {
    if (!tip.classList.contains("visible")) return;
    if (!bar.contains(e.target) && !tip.contains(e.target)) hide(0);
  }, { passive: true });
}