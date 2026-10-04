import { h } from '../dom.js';

// A toggle chip: a real <button> with aria-pressed, so it works with the keyboard and screen readers.
export function toggleChip(label, pressed, onToggle) {
  const chip = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(Boolean(pressed)) }, label);
  chip.addEventListener('click', () => {
    const next = chip.getAttribute('aria-pressed') !== 'true';
    chip.setAttribute('aria-pressed', String(next));
    if (onToggle) onToggle(next);
  });
  return chip;
}

// A group of chips where exactly one is pressed (like radio buttons). options: [[value, label], ...]
export function chipChoice(options, current, onPick) {
  const chips = [];
  const group = h('div', { class: 'chips', role: 'group' });
  for (const [value, label] of options) {
    const chip = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(value === current) }, label);
    chip.addEventListener('click', () => {
      for (const other of chips) other.setAttribute('aria-pressed', 'false');
      chip.setAttribute('aria-pressed', 'true');
      onPick(value);
    });
    chips.push(chip);
    group.append(chip);
  }
  return group;
}
