import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverFile = path.join(root, 'src', 'server.js');
const checkFile = path.join(root, 'scripts', 'check-node.js');
const nodeArgs = ['--disable-warning=ExperimentalWarning'];

// Runs the real server.js as a separate process, like `npm start` does.
function runServer(env) {
  return spawnSync(process.execPath, [...nodeArgs, serverFile], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 15000,
  });
}

test('a port that is already in use stops with a clear message and a failing exit code', async () => {
  const blocker = net.createServer();
  await new Promise((resolve) => blocker.listen(0, '127.0.0.1', resolve));
  const { port } = blocker.address();
  try {
    // spawnSync would freeze this process (and the blocker with it), so use async spawn.
    const child = spawn(process.execPath, [...nodeArgs, serverFile], {
      env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const code = await new Promise((resolve) => child.on('close', resolve));
    assert.equal(code, 1);
    assert.match(out, /already in use/);
    assert.doesNotMatch(out, /is running at/);
  } finally {
    blocker.close();
  }
});

test('a bad PORT stops with a clear message and a failing exit code', () => {
  const result = runServer({ PORT: 'abc' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /PORT must be a whole number/);
});

test('the node version check passes a new Node and rejects an old one with a plain message', () => {
  const ok = spawnSync(process.execPath, [checkFile, '22.18.0'], { encoding: 'utf8' });
  assert.equal(ok.status, 0);

  const tooOld = spawnSync(process.execPath, [checkFile, '20.11.1'], { encoding: 'utf8' });
  assert.equal(tooOld.status, 1);
  assert.match(tooOld.stderr, /needs Node\.js 22\.18 or newer/);
  assert.match(tooOld.stderr, /20\.11\.1/);

  const justBelow = spawnSync(process.execPath, [checkFile, '22.17.9'], { encoding: 'utf8' });
  assert.equal(justBelow.status, 1);
});
