// Small ARIA helpers shared by list UIs. Pure DOM, no app state.

export function announce(text, el = document.getElementById("search-status")) {
  if (el) el.textContent = String(text ?? "");
}

export function setListboxRoles(listEl) {
  if (!listEl) return;
  listEl.tabIndex = 0;
  listEl.setAttribute("role", "listbox");
  listEl.querySelectorAll("li").forEach((li) => li.setAttribute("role", "option"));
}

export function setAriaSelected(listEl, index) {
  if (!listEl) return;
  const items = Array.from(listEl.querySelectorAll("li"));
  items.forEach((li, i) => {
    const on = i === index;
    li.classList.toggle("result-active", on);
    if (on) li.setAttribute("aria-selected", "true");
    else li.removeAttribute("aria-selected");
  });
  if (index >= 0 && items[index]) items[index].scrollIntoView({ block: "nearest" });
}