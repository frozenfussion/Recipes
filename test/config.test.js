import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ConfigError, readEnvFile, resolveConfig } from '../src/config.js';

function withTempEnvFile(contents, fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'chefbuddy-env-'));
  try {
    const file = path.join(dir, '.env');
    writeFileSync(file, contents);
    return fn(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('defaults are port 3000 on 127.0.0.1', () => {
  assert.deepEqual(resolveConfig({}, {}), { port: 3000, host: '127.0.0.1' });
});

test('a missing .env file is fine', () => {
  assert.deepEqual(readEnvFile(path.join(tmpdir(), 'no-such-folder', '.env')), {});
});

test('a .env file saved with a BOM and Windows line endings is read correctly', () => {
  const text = '﻿PORT=4567\r\nHOST=0.0.0.0 # phone testing\r\n';
  withTempEnvFile(text, (file) => {
    assert.deepEqual(resolveConfig(readEnvFile(file), {}), { port: 4567, host: '0.0.0.0' });
  });
});

test('the real environment wins over the .env file', () => {
  assert.equal(resolveConfig({ PORT: '4000' }, { PORT: '5000' }).port, 5000);
});

for (const bad of ['abc', '0', '70000', '-1', '3000.5', '30 00']) {
  test(`PORT=${bad} is rejected with a clear message`, () => {
    assert.throws(
      () => resolveConfig({ PORT: bad }, {}),
      (err) => err instanceof ConfigError && err.message.includes('PORT must be') && err.message.includes(bad),
    );
  });
}
