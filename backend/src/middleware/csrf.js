import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { readCookie } from '../utils/cookies.js';
import { HttpError } from '../utils/http.js';

export const CSRF_COOKIE_NAME = 'attendly_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';
export const CSRF_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export function csrfCookieOptions() {
  return {
    httpOnly: false, // Must be readable by client JavaScript to send back in header
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/',
    maxAge: CSRF_TTL_MS
  };
}

export function clearCsrfCookieOptions() {
  return {
    httpOnly: false,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/'
  };
}

/**
 * Generates an HMAC-signed CSRF token with an embedded timestamp:
 * format: `${timestamp}.${randomHex}.${hmacSignature}`
 */
export function generateCsrfToken() {
  const timestamp = Date.now().toString(36);
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const payload = `${timestamp}.${randomBytes}`;
  const hmac = crypto.createHmac('sha256', env.JWT_SECRET).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

/**
 * Validates a signed CSRF token against JWT_SECRET and expiration.
 */
export function verifyCsrfToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [timestampStr, randomBytes, receivedHmac] = parts;
  const timestamp = parseInt(timestampStr, 36);
  if (Number.isNaN(timestamp)) return false;

  // Check TTL
  const now = Date.now();
  if (timestamp > now + 60 * 1000 || now - timestamp > CSRF_TTL_MS) {
    return false;
  }

  const payload = `${timestampStr}.${randomBytes}`;
  const expectedHmac = crypto.createHmac('sha256', env.JWT_SECRET).update(payload).digest('hex');

  const receivedBuf = Buffer.from(receivedHmac, 'hex');
  const expectedBuf = Buffer.from(expectedHmac, 'hex');

  if (receivedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(receivedBuf, expectedBuf);
}

/**
 * Express middleware for CSRF token issuance / rotation route: GET /api/auth/csrf
 */
export function getCsrfTokenHandler(_req, res) {
  const token = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, csrfCookieOptions());
  res.json({
    success: true,
    message: 'CSRF token issued',
    data: { csrfToken: token }
  });
}

/**
 * CSRF Protection Middleware
 * Protects state-changing requests (POST, PUT, PATCH, DELETE).
 * Safe methods (GET, HEAD, OPTIONS) pass through.
 *
 * For protected methods:
 * 1. Origin header verification against env.frontendOrigins (if Origin is present).
 * 2. Compares token from header (x-csrf-token) with cookie (attendly_csrf).
 * 3. Cryptographically verifies HMAC and freshness of the token.
 */
export function csrfProtection(req, res, next) {
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
  if (safeMethods.has(req.method)) {
    return next();
  }

  // 1. If Origin is present, verify it matches allowed frontend origins
  const origin = req.headers.origin;
  if (origin && !env.frontendOrigins.includes(origin)) {
    return next(new HttpError(403, 'FORBIDDEN', 'Cross-origin request blocked by CSRF policy'));
  }

  // 2. Read token from header and cookie
  const headerToken = req.headers[CSRF_HEADER_NAME] || req.headers['csrf-token'];
  const cookieToken = readCookie(req, CSRF_COOKIE_NAME);

  if (!headerToken || !cookieToken) {
    return next(new HttpError(403, 'CSRF_MISSING', 'CSRF token is missing'));
  }

  // 3. Double-submit match check (using timingSafeEqual)
  const headerBuf = Buffer.from(String(headerToken));
  const cookieBuf = Buffer.from(String(cookieToken));

  if (headerBuf.length !== cookieBuf.length || !crypto.timingSafeEqual(headerBuf, cookieBuf)) {
    return next(new HttpError(403, 'CSRF_INVALID', 'CSRF token mismatch'));
  }

  // 4. Verify HMAC signature and expiration
  if (!verifyCsrfToken(headerToken)) {
    return next(new HttpError(403, 'CSRF_INVALID', 'Invalid or expired CSRF token'));
  }

  next();
}
