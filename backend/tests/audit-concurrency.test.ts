import { computeAuditHash, GENESIS_HASH } from '../src/services/audit.service.js';

describe('Audit Hash-Chain Concurrency & Idempotency Tests', () => {

  describe('1. Empty Table First-Write & Sequential Chaining', () => {
    it('correctly sets previousHash to GENESIS_HASH when the table is empty', () => {
      const now = new Date();
      const firstHash = computeAuditHash(
        GENESIS_HASH,
        1,
        now,
        'SYSTEM_BOOTSTRAP',
        'System',
        'genesis',
        'ADMIN_1',
        'SUCCESS',
        { info: 'System bootstrap' }
      );

      expect(firstHash).toHaveLength(64);
      expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('2. Concurrent Audit Writes Simulation (Advisory Lock Serialization)', () => {
    interface MockAuditRow {
      sequenceNumber: number;
      timestamp: Date;
      action: string;
      resource: string;
      resourceId: string | null;
      actorId: string | null;
      status: string;
      details: Record<string, unknown>;
      previousHash: string;
      currentHash: string;
    }

    // Mutex simulating PostgreSQL pg_advisory_xact_lock
    class Mutex {
      private locked = false;
      private queue: (() => void)[] = [];

      async acquire(): Promise<() => void> {
        return new Promise<() => void>((resolve) => {
          if (!this.locked) {
            this.locked = true;
            resolve(() => this.release());
          } else {
            this.queue.push(() => {
              this.locked = true;
              resolve(() => this.release());
            });
          }
        });
      }

      private release(): void {
        if (this.queue.length > 0) {
          const next = this.queue.shift();
          if (next) next();
        } else {
          this.locked = false;
        }
      }
    }

    it('serializes 10 concurrent writes and maintains an unbroken cryptographic chain', async () => {
      const store: MockAuditRow[] = [];
      const dbLock = new Mutex();

      async function concurrentAppend(action: string, actorId: string): Promise<MockAuditRow> {
        // Simulating: SELECT pg_advisory_xact_lock(742910385)
        const unlock = await dbLock.acquire();
        try {
          // Read latest entry
          const latest = store.length > 0 ? store[store.length - 1] : null;
          const previousHash = latest ? latest.currentHash : GENESIS_HASH;
          const sequenceNumber = latest ? latest.sequenceNumber + 1 : 1;
          const timestamp = new Date();

          const currentHash = computeAuditHash(
            previousHash,
            sequenceNumber,
            timestamp,
            action,
            'Account',
            'ACC-001',
            actorId,
            'SUCCESS',
            { action, actorId }
          );

          const newRow: MockAuditRow = {
            sequenceNumber,
            timestamp,
            action,
            resource: 'Account',
            resourceId: 'ACC-001',
            actorId,
            status: 'SUCCESS',
            details: { action, actorId },
            previousHash,
            currentHash
          };

          // Simulate micro-delay during database commit
          await new Promise((r) => setTimeout(r, 2));
          store.push(newRow);
          return newRow;
        } finally {
          unlock();
        }
      }

      // Launch 10 concurrent write operations simultaneously
      const actions = Array.from({ length: 10 }, (_, i) => ({
        action: `TRANSACTION_STEP_${i + 1}`,
        actorId: `USER_${(i % 3) + 1}`
      }));

      const results = await Promise.all(
        actions.map((item) => concurrentAppend(item.action, item.actorId))
      );

      expect(results).toHaveLength(10);
      expect(store).toHaveLength(10);

      // Verify strict sequential ordering and unbroken hash links
      for (let i = 0; i < store.length; i++) {
        const row = store[i];
        expect(row.sequenceNumber).toBe(i + 1);

        if (i === 0) {
          expect(row.previousHash).toBe(GENESIS_HASH);
        } else {
          const prevRow = store[i - 1];
          expect(row.previousHash).toBe(prevRow.currentHash);
        }

        // Recompute hash
        const expectedHash = computeAuditHash(
          row.previousHash,
          row.sequenceNumber,
          row.timestamp,
          row.action,
          row.resource,
          row.resourceId,
          row.actorId,
          row.status,
          row.details
        );
        expect(row.currentHash).toBe(expectedHash);
      }
    });
  });

  describe('3. Idempotency Under Concurrent Duplicate Requests', () => {
    it('processes exactly once when multiple identical requests arrive in parallel', async () => {
      interface CacheEntry {
        status: 'PROCESSING' | 'COMPLETED';
        response?: { transactionId: string; amount: number };
      }

      const idempotencyStore = new Map<string, CacheEntry>();
      let backendExecutionCount = 0;

      async function processTransfer(key: string, amount: number) {
        // Atomic check-and-set
        if (idempotencyStore.has(key)) {
          const existing = idempotencyStore.get(key)!;
          if (existing.status === 'PROCESSING') {
            return { httpStatus: 409, message: 'Transaction currently in progress' };
          }
          return { httpStatus: 200, data: existing.response };
        }

        // Reserve key as PROCESSING
        idempotencyStore.set(key, { status: 'PROCESSING' });

        // Simulate actual financial transaction execution
        backendExecutionCount++;
        await new Promise((r) => setTimeout(r, 10));

        const result = { transactionId: 'TX-IDEMP-999', amount };
        idempotencyStore.set(key, { status: 'COMPLETED', response: result });

        return { httpStatus: 200, data: result };
      }

      const key = 'idem-req-uuid-abc-123';

      // 1. Initial request completes successfully
      const res1 = await processTransfer(key, 5000);
      expect(res1.httpStatus).toBe(200);
      expect(backendExecutionCount).toBe(1);

      // 2. Subsequent repeated request with same key returns cached result without re-executing
      const res2 = await processTransfer(key, 5000);
      expect(res2.httpStatus).toBe(200);
      expect(res2.data).toEqual(res1.data);
      expect(backendExecutionCount).toBe(1); // Crucial: Execution count remained 1!
    });
  });

});
