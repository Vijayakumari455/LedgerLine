import { Router } from 'express';
import { AuditController, listAuditLogsSchema } from '../controllers/audit.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validateRequest } from '../middleware/validate.js';
import { Role } from '../constants/roles.js';

const router = Router();

// Strict RBAC: All audit trail endpoints require authentication and ADMIN or OPERATOR role
router.use(requireAuth);
router.use(requireRole(Role.ADMIN, Role.OPERATOR));

router.get(
  '/logs',
  validateRequest(listAuditLogsSchema),
  AuditController.listLogs
);

router.get(
  '/verify',
  AuditController.verifyChain
);

export const auditRouter = router;

