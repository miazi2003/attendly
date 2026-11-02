const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function loginRateLimit(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else {
    entry.count += 1;
    if (entry.count > MAX_ATTEMPTS) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please try again later.' } });
    }
  }
  next();
}
