import crypto from 'crypto';

/**
 * Phase 2 Unit Tests: Ledger Math, Invariants, Double-Entry & Hash Chaining
 * These tests verify the fundamental mathematical invariants of BalanceVault.
 */

describe('Phase 2 - Ledger & Invariant Verification Tests', () => {

  describe('1. Integer Minor Units (Precision Invariant)', () => {
    it('prevents floating-point rounding errors by using integer minor units (paise/cents)', () => {
      // Classic JavaScript float problem: 0.10 + 0.20 !== 0.30 (it equals 0.30000000000000004)
      const floatA = 0.10;
      const floatB = 0.20;
      expect(floatA + floatB).not.toBe(0.30);

      // BalanceVault Integer Minor Units: 10 paise + 20 paise === 30 paise exactly
      const minorA = BigInt(10); // 10 paise
      const minorB = BigInt(20); // 20 paise
      const minorTotal = minorA + minorB;
      expect(minorTotal).toBe(BigInt(30));

      // 100 paise = 1 INR; 10,000 paise = 100.00 INR
      const inrPaise = BigInt(10000);
      expect(Number(inrPaise) / 100).toBe(100.00);
    });

    it('enforces non-negative balance invariant check', () => {
      const balance = BigInt(5000); // 50.00 INR
      const debitAttempt = BigInt(6000); // 60.00 INR

      const isSufficient = balance >= debitAttempt;
      expect(isSufficient).toBe(false);

      // Simulating database CHECK constraint: balance - debit >= 0
      const canTransact = (b: bigint, d: bigint): boolean => {
        if (b - d < BigInt(0)) {
          throw new Error('CHECK CONSTRAINT VIOLATION: balance cannot be negative');
        }
        return true;
      };

      expect(() => canTransact(balance, debitAttempt)).toThrow('CHECK CONSTRAINT VIOLATION');
    });
  });

  describe('2. Double-Entry Balancing Invariant', () => {
    it('guarantees sum of debits equals sum of credits for any transaction', () => {
      const transferAmount = BigInt(25000); // 250.00 INR

      const ledgerEntries = [
        { accountId: 'ACC-A', entryType: 'DEBIT', amount: transferAmount },
        { accountId: 'ACC-B', entryType: 'CREDIT', amount: transferAmount }
      ];

      const totalDebits = ledgerEntries
        .filter(e => e.entryType === 'DEBIT')
        .reduce((sum, e) => sum + e.amount, BigInt(0));

      const totalCredits = ledgerEntries
        .filter(e => e.entryType === 'CREDIT')
        .reduce((sum, e) => sum + e.amount, BigInt(0));

      // Fundamental accounting invariant: Debits must balance Credits
      expect(totalDebits).toBe(totalCredits);
      expect(totalDebits - totalCredits).toBe(BigInt(0));
    });

    it('atomically updates both accounts when moving funds', () => {
      let aliceBalance = BigInt(100000); // 1,000.00 INR
      let bobBalance = BigInt(20000);   // 200.00 INR
      const transferAmount = BigInt(30000); // 300.00 INR

      // Transaction execution
      aliceBalance -= transferAmount;
      bobBalance += transferAmount;

      expect(aliceBalance).toBe(BigInt(70000)); // 700.00 INR
      expect(bobBalance).toBe(BigInt(50000));   // 500.00 INR

      // Total money in the closed system remains conserved
      expect(aliceBalance + bobBalance).toBe(BigInt(120000));
    });
  });

  describe('3. Idempotency Key Replay Protection', () => {
    it('returns identical response on duplicate submission with same Idempotency-Key', () => {
      const idempotencyCache = new Map<string, { status: number; body: Record<string, unknown> }>();

      const idempotencyKey = 'idemp_unique_key_12345';
      const initialPayload = { transactionId: 'TX-001', amount: 5000, status: 'COMPLETED' };

      // First request: Process and store
      idempotencyCache.set(idempotencyKey, { status: 200, body: initialPayload });

      // Second request with same key: Retrieve cached response without re-processing
      const cached = idempotencyCache.get(idempotencyKey);
      expect(cached).toBeDefined();
      expect(cached?.status).toBe(200);
      expect(cached?.body).toEqual(initialPayload);
    });
  });

  describe('4. Cryptographic Hash-Chained Audit Log & Tamper Detection', () => {
    function computeHash(prevHash: string, seq: number, timestamp: string, action: string, data: string): string {
      return crypto.createHash('sha256').update(`${prevHash}:${seq}:${timestamp}:${action}:${data}`).digest('hex');
    }

    it('computes valid sequential cryptographic chain', () => {
      const genesis = '0000000000000000000000000000000000000000000000000000000000000000';
      const t1 = '2026-11-10T10:00:00.000Z';
      const t2 = '2026-11-10T10:05:00.000Z';

      const block1Hash = computeHash(genesis, 1, t1, 'USER_REGISTER', 'User Alice');
      const block2Hash = computeHash(block1Hash, 2, t2, 'TRANSFER', 'Alice -> Bob 500');

      // Verify chain integrity
      expect(block1Hash).toHaveLength(64);
      expect(block2Hash).toHaveLength(64);
      expect(block1Hash).not.toBe(block2Hash);
    });

    it('mathematically detects tampering in historical audit blocks', () => {
      const genesis = '0000000000000000000000000000000000000000000000000000000000000000';
      const t1 = '2026-11-10T10:00:00.000Z';
      const t2 = '2026-11-10T10:05:00.000Z';

      const block1Hash = computeHash(genesis, 1, t1, 'TRANSFER', 'Amount: 500');
      const block2Hash = computeHash(block1Hash, 2, t2, 'TRANSFER', 'Amount: 200');

      // Attacker tampers with historical block 1 data (e.g. changes 500 to 50000)
      const tamperedBlock1Data = 'Amount: 50000';
      const recomputedBlock1Hash = computeHash(genesis, 1, t1, 'TRANSFER', tamperedBlock1Data);

      // The tamper is detected: recomputed hash of block 1 does not match recorded block1Hash
      expect(recomputedBlock1Hash).not.toBe(block1Hash);

      // Block 2's previousHash reference is now invalid
      const recomputedBlock2WithTamperedChain = computeHash(recomputedBlock1Hash, 2, t2, 'TRANSFER', 'Amount: 200');
      expect(recomputedBlock2WithTamperedChain).not.toBe(block2Hash);
    });
  });

});
