import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { readCookie } from '../utils/cookies.js';
import { HttpError } from '../utils/http.js';

export async function authenticate(req, _res, next) {
  try {
    const token = readCookie(req, env.COOKIE_NAME);
    if (!token) throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
    const payload = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    next(new HttpError(401, 'UNAUTHENTICATED', 'Invalid or expired session'));
  }
}

export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'UNAUTHENTICATED', 'Authentication required'));
  if (!roles.includes(req.user.role)) return next(new HttpError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
  next();
};
