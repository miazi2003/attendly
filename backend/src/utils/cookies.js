import { env } from '../config/env.js';

export const authCookieOptions = () => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAME_SITE,
  path: '/',
  maxAge: env.COOKIE_MAX_AGE_MS
});

export const clearAuthCookieOptions = () => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAME_SITE,
  path: '/'
});

export function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  const pair = header.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
}
