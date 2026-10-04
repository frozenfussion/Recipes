// Tiny helper to build DOM elements safely. Text is always added as text nodes
// (never as HTML), so nothing from the AI or the user can inject markup.
const PROPERTIES = new Set(['value', 'checked', 'disabled', 'hidden', 'selected', 'multiple']);

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (PROPERTIES.has(key)) el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(el, child);
    else if (child instanceof Node) el.append(child);
    else el.append(document.createTextNode(String(child)));
  }
}

// Replace everything inside an element.
export function setChildren(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}

export function spinner() {
  return h('span', { class: 'spinner', role: 'img', 'aria-label': 'Loading' });
}

export function loadingBox(text) {
  return h('div', { class: 'loading' }, spinner(), ' ', text || 'Loading…');
}

export function errorBox(message, retry) {
  return h('div', { class: 'error-box', role: 'alert' },
    h('p', null, message),
    retry ? h('button', { type: 'button', class: 'btn ghost sm', onclick: retry }, 'Try again') : null);
}

export function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
