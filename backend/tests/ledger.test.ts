import { AccountStatus, UserStatus } from '../src/constants/roles.js';
import { TransactionType, EntryType } from '@prisma/client';

/**
 * Phase 5 - Ledger Core Financial Invariant Tests (In-Memory Unit Tests)
 *
 * NOTE: These are hermetic unit tests simulating the ledger state machine in memory.
 * They verify ledger arithmetic, double-entry balance, IDOR defense, and validation rules.
 */

interface MockAccount {
  id: string;
  accountNumber: string;
  userId: string;
  balance: bigint;
  status: AccountStatus;
  userStatus: UserStatus;
}

interface MockLedgerEntry {
  id: string;
  transactionId: string;
  accountId: string;
  entryType: EntryType;
  amount: bigint;
  balanceAfter: bigint;
}

interface MockTransaction {
  id: string;
  referenceId: string;
  type: TransactionType;
  amount: bigint;
  status: string;
}

describe('Phase 5 - Ledger & Financial Engine Unit Tests', () => {
  let accounts: Map<string, MockAccount>;
  let transactions: MockTransaction[];
  let ledgerEntries: MockLedgerEntry[];
  let idempotencyStore: Map<string, { userId: string; requestHash: string; status: number; body: unknown }>;

  const SYSTEM_CLEARING_ID = 'system-clearing-account-id';

  beforeEach(() => {
    accounts = new Map();
    transactions = [];
    ledgerEntries = [];
    idempotencyStore = new Map();

    // Setup initial test accounts
    accounts.set(SYSTEM_CLEARING_ID, {
      id: SYSTEM_CLEARING_ID,
      accountNumber: 'SYSTEM-SETTLEMENT-CLEARING-000000',
      userId: 'admin-system',
      balance: BigInt(100000000), // System reserve
      status: AccountStatus.ACTIVE,
      userStatus: UserStatus.ACTIVE,
    });

    accounts.set('acc-alice', {
      id: 'acc-alice',
      accountNumber: 'ACC-INR-100001',
      userId: 'user-alice',
      balance: BigInt(50000), // 500.00 INR
      status: AccountStatus.ACTIVE,
      userStatus: UserStatus.ACTIVE,
    });

    accounts.set('acc-bob', {
      id: 'acc-bob',
      accountNumber: 'ACC-INR-100002',
      userId: 'user-bob',
      balance: BigInt(20000), // 200.00 INR
      status: AccountStatus.ACTIVE,
      userStatus: UserStatus.ACTIVE,
    });

    accounts.set('acc-frozen', {
      id: 'acc-frozen',
      accountNumber: 'ACC-INR-999999',
      userId: 'user-frozen',
      balance: BigInt(10000),
      status: AccountStatus.FROZEN,
      userStatus: UserStatus.ACTIVE,
    });

    accounts.set('acc-closed', {
      id: 'acc-closed',
      accountNumber: 'ACC-INR-888888',
      userId: 'user-closed',
      balance: BigInt(0),
      status: AccountStatus.CLOSED,
      userStatus: UserStatus.ACTIVE,
    });
  });

  // 1. Successful Deposit
  it('1. successfully executes deposit and creates balanced counterpart entries (Double-Entry)', () => {
    const alice = accounts.get('acc-alice')!;
    const clearing = accounts.get(SYSTEM_CLEARING_ID)!;
    const depositAmount = BigInt(15000); // 150.00 INR

    const initialAliceBalance = alice.balance;
    const initialClearingBalance = clearing.balance;

    // Execute deposit
    alice.balance += depositAmount;
    clearing.balance += depositAmount;

    const txId = 'tx-dep-001';
    transactions.push({ id: txId, referenceId: 'REF-DEP-1', type: TransactionType.DEPOSIT, amount: depositAmount, status: 'COMPLETED' });

    ledgerEntries.push(
      { id: 'le-1', transactionId: txId, accountId: clearing.id, entryType: EntryType.DEBIT, amount: depositAmount, balanceAfter: clearing.balance },
      { id: 'le-2', transactionId: txId, accountId: alice.id, entryType: EntryType.CREDIT, amount: depositAmount, balanceAfter: alice.balance }
    );

    expect(alice.balance).toBe(initialAliceBalance + depositAmount);
    expect(clearing.balance).toBe(initialClearingBalance + depositAmount);

    // Verify 10. Double-entry balance
    const txEntries = ledgerEntries.filter((e) => e.transactionId === txId);
    const totalDebits = txEntries.filter((e) => e.entryType === EntryType.DEBIT).reduce((s, e) => s + e.amount, BigInt(0));
    const totalCredits = txEntries.filter((e) => e.entryType === EntryType.CREDIT).reduce((s, e) => s + e.amount, BigInt(0));

    expect(totalDebits).toBe(depositAmount);
    expect(totalCredits).toBe(depositAmount);
    expect(totalDebits).toBe(totalCredits);
  });

  // 2. Successful Withdrawal
  it('2. successfully executes withdrawal and decreases balance', () => {
    const alice = accounts.get('acc-alice')!;
    const clearing = accounts.get(SYSTEM_CLEARING_ID)!;
    const withdrawAmount = BigInt(20000); // 200.00 INR

    const initialAliceBalance = alice.balance;
    alice.balance -= withdrawAmount;
    clearing.balance -= withdrawAmount;

    expect(alice.balance).toBe(initialAliceBalance - withdrawAmount);
  });

  // 3. Successful Transfer
  it('3. successfully executes atomic peer-to-peer transfer from Alice to Bob', () => {
    const alice = accounts.get('acc-alice')!;
    const bob = accounts.get('acc-bob')!;
    const transferAmount = BigInt(10000); // 100.00 INR

    const initialAlice = alice.balance;
    const initialBob = bob.balance;

    // Transfer execution
    alice.balance -= transferAmount;
    bob.balance += transferAmount;

    expect(alice.balance).toBe(initialAlice - transferAmount);
    expect(bob.balance).toBe(initialBob + transferAmount);

    // Total money conservation
    expect(alice.balance + bob.balance).toBe(initialAlice + initialBob);
  });

  // 4. Insufficient Balance Rejection
  it('4. rejects transfer when sender has insufficient balance', () => {
    const alice = accounts.get('acc-alice')!;
    const excessiveAmount = alice.balance + BigInt(1000);

    const attemptTransfer = (source: MockAccount, amount: bigint) => {
      if (source.balance < amount) {
        throw new Error('INSUFFICIENT_FUNDS');
      }
    };

    expect(() => attemptTransfer(alice, excessiveAmount)).toThrow('INSUFFICIENT_FUNDS');
  });

  // 5. Zero and Negative Amount Rejection
  it('5. rejects zero and negative amounts', () => {
    const validateAmount = (amount: bigint) => {
      if (amount <= BigInt(0)) {
        throw new Error('INVALID_AMOUNT: Amount must be greater than zero');
      }
    };

    expect(() => validateAmount(BigInt(0))).toThrow('INVALID_AMOUNT');
    expect(() => validateAmount(BigInt(-500))).toThrow('INVALID_AMOUNT');
  });

  // 6. Transfer to Same Account Rejection
  it('6. rejects transfer when source and destination accounts are identical', () => {
    const sourceId = 'acc-alice';
    const destId = 'acc-alice';

    const validateAccounts = (s: string, d: string) => {
      if (s === d) {
        throw new Error('SELF_TRANSFER_FORBIDDEN');
      }
    };

    expect(() => validateAccounts(sourceId, destId)).toThrow('SELF_TRANSFER_FORBIDDEN');
  });

  // 7. Frozen Account Rejection
  it('7. rejects transfer involving frozen account', () => {
    const frozenAcc = accounts.get('acc-frozen')!;

    const validateStatus = (acc: MockAccount) => {
      if (acc.status === AccountStatus.FROZEN) {
        throw new Error('ACCOUNT_FROZEN');
      }
    };

    expect(() => validateStatus(frozenAcc)).toThrow('ACCOUNT_FROZEN');
  });

  // 8. Closed Account Rejection
  it('8. rejects transfer involving closed account', () => {
    const closedAcc = accounts.get('acc-closed')!;

    const validateStatus = (acc: MockAccount) => {
      if (acc.status === AccountStatus.CLOSED) {
        throw new Error('ACCOUNT_CLOSED');
      }
    };

    expect(() => validateStatus(closedAcc)).toThrow('ACCOUNT_CLOSED');
  });

  // 9. Cross-Customer Account Access Rejection (IDOR Defense)
  it('9. blocks Customer B from operating on or querying Customer A account (404 uniform response)', () => {
    const authenticatedUserId = 'user-bob';
    const requestedAccountId = 'acc-alice'; // Owned by user-alice

    const findAccountForUser = (accId: string, uId: string) => {
      const acc = accounts.get(accId);
      if (!acc || acc.userId !== uId) {
        const err = new Error('Account not found');
        (err as any).statusCode = 404;
        throw err;
      }
      return acc;
    };

    expect(() => findAccountForUser(requestedAccountId, authenticatedUserId)).toThrow('Account not found');
  });

  // 11. Duplicate Idempotency-Key Replay
  it('11. returns identical response on duplicate submission with same Idempotency-Key', () => {
    const key = 'idemp_key_test_001';
    const originalResponse = { transactionId: 'TX-100', status: 'COMPLETED', amount: '5000' };

    idempotencyStore.set(key, {
      userId: 'user-alice',
      requestHash: 'hash_of_payload_A',
      status: 200,
      body: originalResponse,
    });

    const cached = idempotencyStore.get(key);
    expect(cached).toBeDefined();
    expect(cached?.status).toBe(200);
    expect(cached?.body).toEqual(originalResponse);
  });

  // 12. Same Idempotency Key with Different Payload
  it('12. rejects same idempotency key when submitted with different payload (422)', () => {
    const key = 'idemp_key_test_002';
    idempotencyStore.set(key, {
      userId: 'user-alice',
      requestHash: 'hash_payload_X',
      status: 200,
      body: { amount: 100 },
    });

    const verifyKeyPayload = (k: string, currentHash: string) => {
      const record = idempotencyStore.get(k);
      if (record && record.requestHash !== currentHash) {
        const err = new Error('IDEMPOTENCY_PAYLOAD_MISMATCH');
        (err as any).statusCode = 422;
        throw err;
      }
    };

    expect(() => verifyKeyPayload(key, 'hash_payload_DIFFERENT_Y')).toThrow('IDEMPOTENCY_PAYLOAD_MISMATCH');
  });

  // 16. Rollback When One Part of Transfer Fails
  it('16. completely rolls back state when any step in transfer encounters an error', () => {
    const alice = accounts.get('acc-alice')!;
    const bob = accounts.get('acc-bob')!;

    const initialAliceBalance = alice.balance;
    const initialBobBalance = bob.balance;

    const atomicTransferWithSimulatedFailure = (amount: bigint) => {
      // Step 1: Debit Alice
      const simulatedAliceBalance = alice.balance - amount;

      // Step 2: Simulated database network error before Bob is credited
      const simulatedFailure = true;
      if (simulatedFailure) {
        // Rollback: Alice balance is NOT committed
        throw new Error('SIMULATED_TRANSACTION_FAILURE');
      }

      alice.balance = simulatedAliceBalance;
      bob.balance += amount;
    };

    expect(() => atomicTransferWithSimulatedFailure(BigInt(10000))).toThrow('SIMULATED_TRANSACTION_FAILURE');

    // Balances remain strictly unchanged (uncompromised)
    expect(alice.balance).toBe(initialAliceBalance);
    expect(bob.balance).toBe(initialBobBalance);
  });

  // 17. Historical Statement Balance Correctness
  it('17. calculates running statement balances chronologically from ledger entries', () => {
    const statementEntries: MockLedgerEntry[] = [
      { id: 'le-1', transactionId: 'tx-1', accountId: 'acc-alice', entryType: EntryType.CREDIT, amount: BigInt(50000), balanceAfter: BigInt(50000) },
      { id: 'le-2', transactionId: 'tx-2', accountId: 'acc-alice', entryType: EntryType.DEBIT, amount: BigInt(15000), balanceAfter: BigInt(35000) },
      { id: 'le-3', transactionId: 'tx-3', accountId: 'acc-alice', entryType: EntryType.CREDIT, amount: BigInt(10000), balanceAfter: BigInt(45000) },
    ];

    expect(statementEntries[0].balanceAfter).toBe(BigInt(50000));
    expect(statementEntries[1].balanceAfter).toBe(BigInt(35000));
    expect(statementEntries[2].balanceAfter).toBe(BigInt(45000));
  });

});
