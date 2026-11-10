import { Router } from 'express';
import {
  AdminController,
  listUsersSchema,
  userActionSchema,
  accountActionSchema,
} from '../controllers/admin.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { csrfProtection } from '../middleware/csrf.js';
import { validateRequest } from '../middleware/validate.js';
import { Role } from '../constants/roles.js';

const router = Router();

// All admin routes strictly require valid authentication and ADMIN role
router.use(requireAuth);
router.use(requireRole(Role.ADMIN));

router.get(
  '/users',
  validateRequest(listUsersSchema),
  AdminController.listUsers
);

router.post(
  '/users/:userId/approve',
  csrfProtection,
  validateRequest(userActionSchema),
  AdminController.approveUser
);

router.post(
  '/users/:userId/reject',
  csrfProtection,
  validateRequest(userActionSchema),
  AdminController.rejectUser
);

router.post(
  '/accounts/:accountId/freeze',
  csrfProtection,
  validateRequest(accountActionSchema),
  AdminController.freezeAccount
);

router.post(
  '/accounts/:accountId/unfreeze',
  csrfProtection,
  validateRequest(accountActionSchema),
  AdminController.unfreezeAccount
);

export const adminRouter = router;
