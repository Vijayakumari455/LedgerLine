import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuditService } from '../services/audit.service.js';
import { AuthenticatedRequest } from '../types/auth.js';

export const listAuditLogsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int('Page must be an integer').min(1, 'Page must be at least 1').default(1),
    limit: z.coerce.number().int('Limit must be an integer').min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(20),
    action: z.string().max(64).optional(),
    resource: z.string().max(64).optional(),
    actorId: z.string().uuid('Invalid actor UUID format').optional(),
  }),
});

export class AuditController {
  /**
   * List paginated audit logs with search/filter capabilities.
   * Access strictly restricted to ADMIN and OPERATOR.
   */
  static async listLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const action = typeof req.query.action === 'string' ? req.query.action.trim() : undefined;
      const resource = typeof req.query.resource === 'string' ? req.query.resource.trim() : undefined;
      const actorId = typeof req.query.actorId === 'string' ? req.query.actorId.trim() : undefined;

      const result = await AuditService.listLogs({
        page,
        limit,
        action,
        resource,
        actorId,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Cryptographically verify the integrity of the audit hash chain.
   * Recomputes hashes from genesis forward; detects any altered, omitted, or reordered records.
   * Access strictly restricted to ADMIN and OPERATOR.
   */
  static async verifyChain(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuditService.verifyChain();

      if (result.isValid) {
        res.status(200).json({
          status: 'VERIFIED',
          isValid: true,
          totalEntries: result.totalEntries,
          message:
            result.totalEntries === 0
              ? 'Audit log is empty (genesis state). Chain is valid.'
              : 'Cryptographic audit hash chain is intact and valid',
        });
        return;
      }

      res.status(400).json({
        status: 'TAMPERED',
        isValid: false,
        totalEntries: result.totalEntries,
        brokenAtSequence: result.brokenAtSequence,
        reason: result.reason,
        error: 'AUDIT_CHAIN_INTEGRITY_VIOLATION',
        message: 'Cryptographic audit hash chain integrity check failed. Data tampering detected.',
      });
    } catch (err) {
      next(err);
    }
  }
}

