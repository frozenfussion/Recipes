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
  assert.deepEqual(resolveConfig({}, {}), { port: 3000, host: '127.0.0.1', allowedHosts: [], serverKeys: null });
});

test('a missing .env file is fine', () => {
  assert.deepEqual(readEnvFile(path.join(tmpdir(), 'no-such-folder', '.env')), {});
});

test('a .env file saved with a BOM and Windows line endings is read correctly', () => {
  const text = '﻿PORT=4567\r\nHOST=0.0.0.0 # phone testing\r\n';
  withTempEnvFile(text, (file) => {
    const { port, host } = resolveConfig(readEnvFile(file), {});
    assert.deepEqual({ port, host }, { port: 4567, host: '0.0.0.0' });
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

test('ALLOWED_HOSTS is a comma list of host names, trimmed and lower-cased', () => {
  const { allowedHosts } = resolveConfig({}, { ALLOWED_HOSTS: ' Recipes.Example.com , other.example.com,' });
  assert.deepEqual(allowedHosts, ['recipes.example.com', 'other.example.com']);
});

test('ALLOWED_HOSTS with something that is not a host name is rejected', () => {
  for (const bad of ['https://recipes.example.com', 'recipes.example.com:443', 'a b']) {
    assert.throws(() => resolveConfig({}, { ALLOWED_HOSTS: bad }), (err) => err instanceof ConfigError && /ALLOWED_HOSTS/.test(err.message));
  }
});

test('by default keys come from the Settings page and key variables in the environment are ignored', () => {
  const config = resolveConfig({}, { CHEF_BUDDY_ANTHROPIC_KEY: 'sk-ant-should-not-be-used' });
  assert.equal(config.serverKeys, null);
});

test('KEY_SOURCE=server reads the keys from the real environment only', () => {
  const config = resolveConfig(
    { KEY_SOURCE: 'server', CHEF_BUDDY_OPENAI_KEY: 'sk-proj-from-the-env-file' },
    { CHEF_BUDDY_ANTHROPIC_KEY: '  sk-ant-from-systemd  ' },
  );
  assert.deepEqual(config.serverKeys, { anthropic_api_key: 'sk-ant-from-systemd', openai_api_key: null });
});

test('a KEY_SOURCE other than app or server is rejected', () => {
  assert.throws(() => resolveConfig({}, { KEY_SOURCE: 'database' }), (err) => err instanceof ConfigError && /KEY_SOURCE/.test(err.message));
});
