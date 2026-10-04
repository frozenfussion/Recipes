import { ApiError } from './errors.js';

// Browser-side protections that cost nothing and block whole classes of attacks.

// What the page is allowed to load. Only our own files, plus Google Fonts for the two fonts.
// No inline scripts and no inline styles (the frontend is written so it does not need them).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  });
  next();
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
export const isLoopbackHost = (host) => LOOPBACK.has(host);

// Two checks that stop other websites from using your running Chef Buddy:
// 1. Host check ("DNS rebinding"): when the app only listens on this computer, a request must
//    really be addressed to localhost. A hostile site that points its own name at 127.0.0.1 fails.
// 2. Origin check ("CSRF"): a request that changes something must come from our own page.
//    Browsers add an Origin header to cross-site posts, so a different Origin is refused.
export function requestGuard({ loopbackOnly = true } = {}) {
  return function guard(req, res, next) {
    const host = String(req.headers.host || '').replace(/:\d+$/, '');
    if (loopbackOnly && !LOOPBACK.has(host)) {
      return next(new ApiError(403, 'bad_host', 'Chef Buddy only answers to localhost. Open http://localhost:3000.'));
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
      let sameSite = false;
      try { sameSite = new URL(req.headers.origin).host === req.headers.host; } catch { /* malformed Origin: refuse */ }
      if (!sameSite) return next(new ApiError(403, 'bad_origin', 'That request came from a different website, so Chef Buddy refused it.'));
    }
    return next();
  };
}
