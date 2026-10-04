import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// These are "guard rails" for the rules in CLAUDE.md, so they cannot be broken by accident.
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

function filesIn(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? filesIn(full) : [full];
  });
}

const jsFiles = filesIn(path.join(publicDir, 'js')).filter((f) => f.endsWith('.js'));
const html = readFileSync(path.join(publicDir, 'index.html'), 'utf8');

test('frontend code never uses innerHTML or other raw-HTML sinks', () => {
  for (const file of jsFiles) {
    const code = readFileSync(file, 'utf8');
    assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(/, path.relative(publicDir, file));
  }
});

test('frontend code never sets a style attribute (a strict CSP blocks them): use CSS classes', () => {
  for (const file of jsFiles) {
    const code = readFileSync(file, 'utf8');
    assert.doesNotMatch(code, /\bstyle\s*:|setAttribute\(\s*['"]style['"]|cssText/, path.relative(publicDir, file));
  }
});

test('every relative import in the frontend points at a real file', () => {
  for (const file of jsFiles) {
    const code = readFileSync(file, 'utf8');
    for (const match of code.matchAll(/(?:import|export)[^'"]*?from\s+['"](\.[^'"]+)['"]|import\(['"](\.[^'"]+)['"]\)/g)) {
      const target = path.resolve(path.dirname(file), match[1] || match[2]);
      assert.ok(existsSync(target), `${path.relative(publicDir, file)} imports missing ${match[1] || match[2]}`);
    }
  }
});

test('index.html has no inline scripts, inline styles or inline handlers (needed for a strict CSP)', () => {
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
  assert.doesNotMatch(html, /\sstyle\s*=/i);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
});

test('every local file index.html links to exists', () => {
  for (const match of html.matchAll(/(?:src|href)="(\/[^"]+)"/g)) {
    assert.ok(existsSync(path.join(publicDir, match[1])), `index.html links to missing ${match[1]}`);
  }
});

test('the CSS uses colour tokens, not raw colours (except in tokens.css)', () => {
  const css = readFileSync(path.join(publicDir, 'css', 'app.css'), 'utf8');
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
});
