// npm run check:network
// Checks, step by step, whether this computer can reach Claude and OpenAI, and says where it stops.
// It sends no API key, so the last step is expected to answer "401" (that means: reached, key missing).
import dns from 'node:dns/promises';
import net from 'node:net';

const HOSTS = [['Claude (Anthropic)', 'api.anthropic.com', '/v1/models'], ['OpenAI', 'api.openai.com', '/v1/models']];
const TIMEOUT_MS = 10_000;
let problems = 0;

async function step(label, work) {
  const started = Date.now();
  try {
    const detail = await work();
    console.log(`  OK    ${label} (${Date.now() - started} ms)${detail ? ` ${detail}` : ''}`);
    return true;
  } catch (err) {
    problems++;
    const why = (err.cause && err.cause.code) || err.code || err.name;
    console.log(`  FAIL  ${label} (${Date.now() - started} ms) ${why}`);
    return false;
  }
}

const connect = (host) => new Promise((resolve, reject) => {
  const socket = net.connect({ host, port: 443, timeout: TIMEOUT_MS }, () => { socket.destroy(); resolve(); });
  socket.on('timeout', () => { socket.destroy(); reject(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })); });
  socket.on('error', reject);
});

console.log(`Node ${process.version}`);
const proxies = ['HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY', 'https_proxy', 'http_proxy'].filter((name) => process.env[name]);
console.log(proxies.length
  ? `Proxy settings found (${proxies.join(', ')}). Node's built-in fetch ignores them, which can make requests fail.`
  : 'No proxy environment variables set.');

for (const [name, host, path] of HOSTS) {
  console.log(`\n${name}: ${host}`);
  const found = await step('find its address (DNS)', async () => (await dns.lookup(host, { all: true })).map((a) => a.address).join(', '));
  if (!found) continue;
  if (!(await step('open a connection on port 443', () => connect(host)))) continue;
  await step('ask for the model list without a key (expect 401)', async () => {
    const res = await fetch(`https://${host}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return `answered HTTP ${res.status}`;
  });
}

console.log(problems === 0
  ? '\nAll good: this computer can reach both services.'
  : '\nSomething failed above. Check your internet connection, and whether a VPN, proxy, firewall or antivirus is blocking Node.js, then run this again.');
process.exit(problems === 0 ? 0 : 1);
