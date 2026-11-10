import { Router } from 'express';
import {
  TransferController,
  depositSchema,
  withdrawSchema,
  transferSchema,
  statementSchema,
} from '../controllers/transfer.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, requireActiveStatus } from '../middleware/rbac.js';
import { csrfProtection } from '../middleware/csrf.js';
import { requireIdempotency } from '../middleware/idempotency.js';
import { validateRequest } from '../middleware/validate.js';
import { Role } from '../constants/roles.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole(Role.CUSTOMER));
router.use(requireActiveStatus);

router.post(
  '/deposit',
  csrfProtection,
  requireIdempotency,
  validateRequest(depositSchema),
  TransferController.deposit
);

router.post(
  '/withdraw',
  csrfProtection,
  requireIdempotency,
  validateRequest(withdrawSchema),
  TransferController.withdraw
);

router.post(
  '/transfer',
  csrfProtection,
  requireIdempotency,
  validateRequest(transferSchema),
  TransferController.transfer
);

router.get(
  '/statement/:accountId',
  validateRequest(statementSchema),
  TransferController.getStatement
);

export const transferRouter = router;

