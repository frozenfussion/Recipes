// The only place the browser talks to the server. Every failure becomes an Error with a
// message a beginner can act on (the server already writes those, see src/lib/errors.js).
export class ApiClientError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const OFFLINE = "Can't reach Chef Buddy's server. Is it still running? Start it again with npm start.";
const TOO_SLOW = 'Chef Buddy is taking too long to answer. Check your internet connection (a VPN, proxy or firewall can block it) and try again.';

// How long to wait for the server before giving up. Recipes and pictures are slow on purpose, so they ask for more.
export const DEFAULT_TIMEOUT_MS = 60_000;
export const SLOW_TIMEOUT_MS = 240_000;

// timeout 0 means "no limit" (used for streamed chat, which can legitimately run for a while).
async function send(method, path, body, timeout = DEFAULT_TIMEOUT_MS) {
  try {
    return await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: timeout > 0 ? AbortSignal.timeout(timeout) : undefined,
    });
  } catch (err) {
    if (err && err.name === 'TimeoutError') throw new ApiClientError(TOO_SLOW, 'timeout', 0);
    throw new ApiClientError(OFFLINE, 'offline', 0);
  }
}

async function failure(res) {
  let data = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  const error = (data && data.error) || {};
  return new ApiClientError(error.message || `Something went wrong (error ${res.status}).`, error.code || 'error', res.status);
}

// options.timeout: milliseconds to wait (see DEFAULT_TIMEOUT_MS and SLOW_TIMEOUT_MS above).
export async function api(method, path, body, { timeout } = {}) {
  const res = await send(method, path, body, timeout);
  if (!res.ok) throw await failure(res);
  try {
    return await res.json();
  } catch (err) {
    // The timer also covers reading the body, so a stall half-way through ends up here.
    if (err && err.name === 'TimeoutError') throw new ApiClientError(TOO_SLOW, 'timeout', 0);
    throw err;
  }
}

// Server-Sent Events over POST (the browser's EventSource only does GET).
// Calls onEvent(name, data) for every event. Resolves when the stream ends.
export async function streamPost(path, body, onEvent) {
  const res = await send('POST', path, body, 0);
  if (!res.ok) throw await failure(res);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end;
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let name = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) name = line.slice(7);
        else if (line.startsWith('data: ')) data += line.slice(6);
      }
      if (data) onEvent(name, JSON.parse(data));
    }
  }
}
