import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { authCookieOptions, clearAuthCookieOptions } from '../utils/cookies.js';
import { HttpError, success } from '../utils/http.js';

const loginSchema = z.object({ email: z.email().transform(value => value.toLowerCase()), password: z.string().min(1).max(200) }).strict();
const publicUser = user => ({ id: user.id, name: user.name, email: user.email, role: user.role, department: user.department });

export async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Enter a valid email address and password');
    const user = await User.findOne({ email: parsed.data.email }).select('+passwordHash');
    const valid = user && await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
    if (!user.isActive) throw new HttpError(403, 'ACCOUNT_INACTIVE', 'This account is inactive');
    const token = jwt.sign({ role: user.role }, env.JWT_SECRET, { subject: user.id, expiresIn: env.JWT_EXPIRES_IN });
    res.cookie(env.COOKIE_NAME, token, authCookieOptions());
    success(res, { user: publicUser(user) }, 'Signed in successfully');
  } catch (error) { next(error); }
}

export function me(req, res) { success(res, { user: publicUser(req.user) }); }

export function logout(_req, res) {
  res.clearCookie(env.COOKIE_NAME, clearAuthCookieOptions());
  success(res, null, 'Signed out successfully');
}
