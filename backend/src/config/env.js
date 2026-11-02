import 'dotenv/config';
import { z } from 'zod';

const booleanString = z.preprocess(value => value ?? 'false', z.enum(['true', 'false']).transform(value => value === 'true'));
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  COOKIE_NAME: z.string().min(1).default('attendly_auth'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_SECURE: booleanString,
  COOKIE_MAX_AGE_MS: z.coerce.number().int().positive().default(900000),
  FRONTEND_ORIGINS: z.string().min(1)
}).superRefine((value, context) => {
  if (value.COOKIE_SAME_SITE === 'none' && !value.COOKIE_SECURE) context.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'SameSite=None requires Secure cookies' });
  if (value.NODE_ENV === 'production' && !value.COOKIE_SECURE) context.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'Production cookies must be Secure' });
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const names = parsed.error.issues.map(issue => issue.path.join('.')).join(', ');
  throw new Error(`Invalid environment configuration: ${names}`);
}

export const env = {
  ...parsed.data,
  frontendOrigins: parsed.data.FRONTEND_ORIGINS.split(',').map(value => value.trim()).filter(Boolean)
};
