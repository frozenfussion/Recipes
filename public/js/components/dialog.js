import { h } from '../dom.js';

// In-page dialogs (never the browser's confirm()). Focus stays inside the dialog,
// Esc or a click on the dark background closes it, and focus goes back to where it was.
let active = null;

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function closeDialog() {
  if (!active) return;
  const { scrim, opener, onClose } = active;
  active = null;
  scrim.remove();
  document.removeEventListener('keydown', onKey, true);
  if (opener && opener.isConnected) opener.focus();
  if (onClose) onClose();
}

function onKey(event) {
  if (!active) return;
  if (event.key === 'Escape') {
    event.stopPropagation();
    closeDialog();
    return;
  }
  if (event.key !== 'Tab') return;
  const items = [...active.box.querySelectorAll(FOCUSABLE)];
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

// content: a node or an array of nodes shown inside the dialog card.
// onClose runs however the dialog closes (button, Esc, or a click outside).
export function openDialog(title, content, onClose) {
  closeDialog();
  const box = h('div', { class: 'card dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dialogTitle' },
    h('h2', { id: 'dialogTitle' }, title), content);
  const scrim = h('div', { class: 'scrim', onclick: (e) => { if (e.target === scrim) closeDialog(); } }, box);
  active = { scrim, box, opener: document.activeElement, onClose };
  document.body.append(scrim);
  document.addEventListener('keydown', onKey, true);
  (box.querySelector('input, textarea, select') || box.querySelector('button') || box).focus();
  return box;
}

// Resolves true for the OK button, false for Cancel, Esc or a click outside.
export function confirmBox({ title, message, okLabel, danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    openDialog(title, [
      h('p', null, message),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: `btn sm${danger ? ' danger' : ''}`, onclick: () => { answer = true; closeDialog(); } }, okLabel),
        h('button', { type: 'button', class: 'btn ghost sm', onclick: closeDialog }, 'Cancel')),
    ], () => resolve(answer));
  });
}
