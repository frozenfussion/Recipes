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

async function send(method, path, body) {
  try {
    return await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError(OFFLINE, 'offline', 0);
  }
}

async function failure(res) {
  let data = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  const error = (data && data.error) || {};
  return new ApiClientError(error.message || `Something went wrong (error ${res.status}).`, error.code || 'error', res.status);
}

export async function api(method, path, body) {
  const res = await send(method, path, body);
  if (!res.ok) throw await failure(res);
  return res.json();
}

// Server-Sent Events over POST (the browser's EventSource only does GET).
// Calls onEvent(name, data) for every event. Resolves when the stream ends.
export async function streamPost(path, body, onEvent) {
  const res = await send('POST', path, body);
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
