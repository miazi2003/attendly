import { Router } from 'express';
import { login, logout, me } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { loginRateLimit } from '../middleware/loginRateLimit.js';
import { getCsrfTokenHandler } from '../middleware/csrf.js';

export const authRouter = Router();
authRouter.get('/csrf', getCsrfTokenHandler);
authRouter.post('/login', loginRateLimit, login);
authRouter.get('/me', authenticate, me);
authRouter.post('/logout', logout);
