import { Router } from 'express';
import { AuthController, registerSchema, loginSchema } from '../controllers/auth.controller.js';
import { validateRequest } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post(
  '/register',
  validateRequest(registerSchema),
  AuthController.register
);

router.post(
  '/login',
  authRateLimiter,
  validateRequest(loginSchema),
  AuthController.login
);

router.post(
  '/logout',
  requireAuth,
  csrfProtection,
  AuthController.logout
);

router.get(
  '/me',
  requireAuth,
  AuthController.getMe
);

export const authRouter = router;
