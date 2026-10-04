import { formatDate, h } from '../dom.js';
import { show } from '../router.js';
import { state } from '../state.js';

export function statusBadge(status) {
  if (status === 'cooked') return h('span', { class: 'status-badge cooked' }, '🎉 Cooked');
  if (status === 'saved') return h('span', { class: 'status-badge saved' }, '⭐ Saved');
  return h('span', { class: 'status-badge' }, '📝 Not saved');
}

// The user's photo, else the AI photo, else the dish emoji.
export function thumb(session) {
  return h('div', { class: 'thumb' },
    session.photo ? h('img', { src: `/images/${session.photo.id}`, alt: '' }) : session.emoji);
}

export function openSession(id, from) {
  state.currentId = id;
  state.backTo = from;
  return show('recipe');
}

// A card that opens the Recipe screen. `from` decides where Back goes: 'history' or 'saved'.
export function sessionCard(session, from, detailLine) {
  const open = () => openSession(session.id, from);
  const card = h('div', { class: 'card rcard', role: 'button', tabindex: '0', onclick: open },
    thumb(session),
    h('div', null,
      h('h3', null, session.title),
      h('span', { class: 'small' }, detailLine),
      h('br'),
      statusBadge(session.status)),
    from === 'history' ? h('span', { class: 'go' }, 'Open →') : null);
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
  });
  return card;
}

export function historyLine(session) {
  return `${formatDate(session.createdAt)} · 💬 ${session.messageCount}`;
}

export function recipeLine(session) {
  const parts = [...session.tags];
  if (session.timeMinutes) parts.push(`${session.timeMinutes} min`);
  parts.push(session.listName || 'Not in a list');
  return parts.join(' · ');
}
