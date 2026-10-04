// Every API error has the same shape, so the browser can show a plain message.
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function sendError(res, status, code, message) {
  res.status(status).json({ error: { code, message } });
}

// One line in the server window saying what failed, so a stuck connection can be diagnosed.
// It never prints the SDK's message or anything from the request (they can contain a key).
// The SDKs leave err.name as plain "Error" and put the useful name on the class (APIConnectionTimeoutError).
const kindOf = (err) => (err && err.name && err.name !== 'Error' ? err.name : (err && err.constructor && err.constructor.name) || 'Error');

export function logAiFailure(provider, action, err) {
  if (err instanceof ApiError) return;
  const code = (err && err.cause && err.cause.code) || (err && err.code) || '';
  const reason = typeof code === 'string' ? code : ''; // some errors carry a number, which tells a reader nothing
  const parts = [kindOf(err), err && err.status ? `HTTP ${err.status}` : '', reason].filter(Boolean);
  console.warn(`${provider}: ${action} failed (${parts.join(', ')})`);
}

const TIMEOUT_NAMES = new Set(['APIConnectionTimeoutError', 'TimeoutError', 'AbortError']);
const TIMEOUT_CODES = new Set(['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT']);
const DNS_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN']);

// Turns whatever the Claude or OpenAI SDK threw into a message a beginner can act on.
// We never pass the SDK's own message on: it is written for developers.
export function friendlyAiError(err, provider = 'Claude') {
  if (err instanceof ApiError) return err;
  const status = err && err.status;
  const reason = (err && err.cause && err.cause.code) || (err && err.code);

  if (err && (err.code === 'moderation_blocked' || (err.error && err.error.code === 'moderation_blocked'))) {
    return new ApiError(422, 'image_declined', 'The image service declined this one. Try again or add your own photo.');
  }
  if (status === 401) return new ApiError(401, 'bad_key', `${provider} did not accept the API key. Check it on the Settings page.`);
  if (status === 403) return new ApiError(403, 'forbidden', `${provider} says this key is not allowed to do that. Check the key on the Settings page.`);
  if (status === 404) return new ApiError(404, 'model_not_found', `${provider} cannot find the chosen model any more. Pick another one on the Settings page.`);
  if (status === 413) return new ApiError(413, 'too_large', 'That request is too big. A photo may be too large.');
  if (status === 429) return new ApiError(429, 'rate_limited', `${provider} is busy or a limit was reached. Wait a moment and try again.`);
  if (status === 529 || (status >= 500 && status < 600)) {
    return new ApiError(503, 'busy', `${provider} is busy right now. Try again shortly.`);
  }
  if (status === 400) return new ApiError(400, 'bad_request', `${provider} could not use that request. Try different wording, or pick another model.`);
  if (status === undefined && (TIMEOUT_NAMES.has(kindOf(err)) || TIMEOUT_CODES.has(reason))) {
    return new ApiError(504, 'timeout',
      `${provider} did not answer in time. Check your internet connection (a VPN, proxy or firewall can block it) and try again.`);
  }
  if (status === undefined && DNS_CODES.has(reason)) {
    return new ApiError(503, 'network', `Could not look up ${provider}'s address. Check your internet connection or DNS settings and try again.`);
  }
  if (status === undefined) {
    return new ApiError(503, 'network', `Could not reach ${provider}. Check your internet connection (a VPN, proxy or firewall can block it) and try again.`);
  }
  return new ApiError(502, 'ai_error', `${provider} returned an unexpected error. Try again.`);
}
