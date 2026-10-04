import { ApiError } from './errors.js';

// A tiny "no more than N requests per minute" gate for the routes that cost money.
// It exists so a bug or a runaway loop cannot burn through the user's API credit.
// There is one shared counter, not one per visitor: this is a single-user app.
export function createRateLimiter({ limit = 30, windowMs = 60_000, now = () => Date.now() } = {}) {
  const hits = []; // when each recent request arrived (milliseconds), oldest first
  return function rateLimit(req, res, next) {
    const t = now();
    while (hits.length && t - hits[0] >= windowMs) hits.shift(); // forget requests older than the window
    if (hits.length >= limit) {
      const wait = Math.max(1, Math.ceil((windowMs - (t - hits[0])) / 1000));
      res.set('Retry-After', String(wait));
      return next(new ApiError(429, 'slow_down',
        `Chef Buddy paused because there were a lot of requests very quickly, to protect your API credit. Try again in ${wait} seconds.`));
    }
    hits.push(t);
    return next();
  };
}
