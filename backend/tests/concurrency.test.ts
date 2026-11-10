/**
 * Phase 5 - Concurrency & Race Condition Simulation Tests (In-Memory Unit Tests)
 *
 * NOTE: These are hermetic unit tests simulating concurrent lock acquisition and atomic
 * balance checks in memory to prove race condition elimination and deadlock avoidance.
 */

describe('Phase 5 - Financial Concurrency & Race Condition Tests', () => {

  // Simple Mutex for serializing account row updates
  class AccountLockManager {
    private lockedAccounts = new Set<string>();

    async acquireLock(accountId: string): Promise<() => void> {
      while (this.lockedAccounts.has(accountId)) {
        await new Promise((r) => setTimeout(r, 5));
      }
      this.lockedAccounts.add(accountId);
      return () => {
        this.lockedAccounts.delete(accountId);
      };
    }
  }

  // 13. Simultaneous Duplicate Requests
  it('13. rejects simultaneous duplicate requests with identical Idempotency-Key with 409 Conflict', async () => {
    interface IdempotencySlot {
      status: 'PROCESSING' | 'COMPLETED';
      response?: unknown;
    }

    const dbIdempotencyTable = new Map<string, IdempotencySlot>();

    async function handleRequest(key: string, _payload: unknown) {
      if (dbIdempotencyTable.has(key)) {
        const slot = dbIdempotencyTable.get(key)!;
        if (slot.status === 'PROCESSING') {
          return { status: 409, error: 'TRANSACTION_IN_PROGRESS' };
        }
        return { status: 200, data: slot.response, isReplay: true };
      }

      // Atomically reserve key as PROCESSING
      dbIdempotencyTable.set(key, { status: 'PROCESSING' });

      // Simulate network / DB delay
      await new Promise((r) => setTimeout(r, 20));

      const result = { success: true, txId: 'tx-123' };
      dbIdempotencyTable.set(key, { status: 'COMPLETED', response: result });

      return { status: 200, data: result, isReplay: false };
    }

    const key = 'idem_key_parallel_999';

    // Fire 2 requests simultaneously
    const [reqA, reqB] = await Promise.all([
      handleRequest(key, { amount: 500 }),
      handleRequest(key, { amount: 500 }),
    ]);

    // One must succeed (200), the other must receive 409 Conflict (or cached 200 replay)
    const statuses = [reqA.status, reqB.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  // 14. Concurrent Withdrawals that Would Otherwise Cause Overdrafts
  it('14. prevents race condition overdrafts when two concurrent withdrawals exceed available balance', async () => {
    const lockManager = new AccountLockManager();

    let accountBalance = BigInt(1000); // 10.00 INR
    const withdrawAmount = BigInt(600); // 6.00 INR (2 * 600 = 1200 > 1000)

    let successfulWithdrawals = 0;
    let rejectedWithdrawals = 0;

    async function attemptConcurrentWithdrawal(id: string) {
      // Simulating: SELECT ... FOR UPDATE
      const release = await lockManager.acquireLock('acc-test');
      try {
        if (accountBalance >= withdrawAmount) {
          // Micro delay representing write time
          await new Promise((r) => setTimeout(r, 10));
          accountBalance -= withdrawAmount;
          successfulWithdrawals++;
          return { success: true };
        } else {
          rejectedWithdrawals++;
          return { success: false, reason: 'INSUFFICIENT_FUNDS' };
        }
      } finally {
        release();
      }
    }

    // Launch two withdrawals of 600 simultaneously against account with balance 1000
    const [res1, res2] = await Promise.all([
      attemptConcurrentWithdrawal('w1'),
      attemptConcurrentWithdrawal('w2'),
    ]);

    // Exactly one must succeed, exactly one must be rejected
    expect(successfulWithdrawals).toBe(1);
    expect(rejectedWithdrawals).toBe(1);

    // Remaining balance must be exactly 400 (never negative)
    expect(accountBalance).toBe(BigInt(400));
    expect(accountBalance >= BigInt(0)).toBe(true);
  });

  // 15. Concurrent Transfers Involving Same Accounts (Deadlock Prevention via Sorted Locking)
  it('15. safely executes concurrent opposite transfers (Alice->Bob and Bob->Alice) without deadlocks', async () => {
    const lockManager = new AccountLockManager();

    let aliceBalance = BigInt(5000);
    let bobBalance = BigInt(5000);

    async function executeSortedTransfer(sourceId: string, destId: string, amount: bigint) {
      // Deadlock prevention invariant: Always sort account IDs before locking
      const [firstLock, secondLock] = [sourceId, destId].sort();

      const releaseFirst = await lockManager.acquireLock(firstLock);
      const releaseSecond = await lockManager.acquireLock(secondLock);

      try {
        // Micro delay to simulate database transaction
        await new Promise((r) => setTimeout(r, 10));

        if (sourceId === 'alice') {
          aliceBalance -= amount;
          bobBalance += amount;
        } else {
          bobBalance -= amount;
          aliceBalance += amount;
        }

        return { success: true };
      } finally {
        releaseSecond();
        releaseFirst();
      }
    }

    // Run Alice -> Bob (1000) and Bob -> Alice (500) simultaneously
    const [t1, t2] = await Promise.all([
      executeSortedTransfer('alice', 'bob', BigInt(1000)),
      executeSortedTransfer('bob', 'alice', BigInt(500)),
    ]);

    expect(t1.success).toBe(true);
    expect(t2.success).toBe(true);

    // Alice net change: -1000 + 500 = -500 -> 4500
    // Bob net change: +1000 - 500 = +500 -> 5500
    expect(aliceBalance).toBe(BigInt(4500));
    expect(bobBalance).toBe(BigInt(5500));

    // Conservation of total money in closed system: 5000 + 5000 === 4500 + 5500
    expect(aliceBalance + bobBalance).toBe(BigInt(10000));
  });

});
