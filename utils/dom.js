/** True when running in a browser (not Node/CI). */
export const isBrowser =
    typeof window !== "undefined" && typeof document !== "undefined";

/**
 * Query single element (optionally scoped).
 * @param {string} sel
 * @param {ParentNode} [scope=document]
 * @returns {Element|null}
 */
export const $ = (sel, scope = document) => 
    isBrowser ? scope.querySelector(sel) : null;

/**
 * Query all elements (optionally scoped) → Array<Element>.
 * @param {string} sel
 * @param {ParentNode} [scope=document]
 * @returns {Element[]}
 */
export const $$ = (sel, scope = document) => 
    isBrowser ? Array.from(scope.querySelectorAll(sel)) : [];

/**
 * Strict query (throws if not found). Handy for required nodes at init.
 * @param {string} sel
 * @param {ParentNode} [scope=document]
 * @returns {Element}
 */
export function qsStrict(sel, scope = document) {
    if (!isBrowser) throw new Error("qsStrict used outside browser");
    const el = scope.querySelector(sel);
    if (!el) throw new Error(`Required element not found: ${sel}`);
    return el;
}

/**
 * Add event listener; returns a function to remove it.
 * @template {Event} E
 * @param {EventTarget} target
 * @param {String} type
 * @param {(ev: E) => any} handler
 * @param {AddEventListenerOptions|boolean} [options]
 * @returns {() => void} unsubscribe
 */
export function on(target, type, handler, options) {
    if (!target?.addEventListener) return () => {};
    target.addEventListener(type, handler, options);
    return () => target.removeEventListener(type, handler, options);
}

/**
 * Delegate events from a root to matching descendants
 * Calls handler(event, matchedEvent)
 * Returns an unsubscribe function.
 * @template {Event} E
 * @param {Element|Document} root
 * @param {string} selector
 * @param {(ev: E, match: Element) => any} handler
 * @param {string} selector
 * @param {string} type
 * @param {(ev: E, match: Element) => any} handler
 * @param {AddEventListenerOptions|boolean} [options]
 * @returns {() => void} unsubscribe
 */
export function delegate(root, selector, type, handler, options) {
    const listener = (ev) => {
        const target = /** @type {Element|null} */ (ev.target instanceof Element ? ev.target: null);
        if (!target) return;
        const match = target.closest(selector);
        if (match && (root === document ? true: root.contains(match))) {
            handler(ev, match);
        }
    };
    root.addEventListener(type, listener, options);
    return () => root.removeEventListener(type, listener, options);
}

/**
 * Set multiple attributes at once. Ignores null/undefined values.
 * @param {Element} el
 * @param {Record<string, any>} attrs
 */
export function setAttrs(el, attrs) {
    for (const [k, v] of Object.entries(attrs)) {
        if (v == null) continue;
        el.setAttribute(k, String(v));
    }
}

/**
 * Hide/show an element using the `hidden` attribute (no CSS class required).
 * @param {HTMLElement} el
 * @param {boolean} hidden
 */
export function toggleHidden(el, hidden) {
    if (!el) return;
    if (hidden) el.setAttribute("hidden", "true");
    else el.removeAttribute("hidden");
}

/**
 * Safely set textContent, normalizing to string.
 * @param {Node} node
 * @param {any} value
 */
export function setText(node, value) {
    node.textContent = value == null ? "" : String(value);
}