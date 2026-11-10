import { Router } from 'express';
import { AccountController } from '../controllers/account.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, requireActiveStatus } from '../middleware/rbac.js';
import { csrfProtection } from '../middleware/csrf.js';
import { Role } from '../constants/roles.js';

const router = Router();

router.use(requireAuth);

router.get('/', AccountController.listMyAccounts);
router.get('/:accountId', AccountController.getAccountById);

router.post(
  '/',
  requireRole(Role.CUSTOMER),
  requireActiveStatus,
  csrfProtection,
  AccountController.createAccount
);

export const accountRouter = router;
