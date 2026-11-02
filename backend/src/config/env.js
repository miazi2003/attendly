import 'dotenv/config';
import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform(value => value === 'true');
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  COOKIE_NAME: z.string().min(1).default('attendly_auth'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).optional(),
  COOKIE_SECURE: booleanString.optional(),
  COOKIE_MAX_AGE_MS: z.coerce.number().int().positive().default(900000),
  FRONTEND_ORIGINS: z.string().min(1).refine(value => value.split(',').every(origin => { try { return new URL(origin.trim()).origin === origin.trim(); } catch { return false; } }), 'Use exact frontend origins')
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const names = parsed.error.issues.map(issue => issue.path.join('.')).join(', ');
  throw new Error(`Invalid environment configuration: ${names}`);
}

const production = parsed.data.NODE_ENV === 'production';
const cookieSecure = parsed.data.COOKIE_SECURE ?? production;
const cookieSameSite = parsed.data.COOKIE_SAME_SITE ?? (production ? 'none' : 'lax');
if (cookieSameSite === 'none' && !cookieSecure) throw new Error('Invalid environment configuration: SameSite=None requires COOKIE_SECURE=true');
if (production && !cookieSecure) throw new Error('Invalid environment configuration: production requires COOKIE_SECURE=true');

export const env = {
  ...parsed.data,
  COOKIE_SECURE: cookieSecure,
  COOKIE_SAME_SITE: cookieSameSite,
  frontendOrigins: parsed.data.FRONTEND_ORIGINS.split(',').map(value => value.trim()).filter(Boolean)
};
