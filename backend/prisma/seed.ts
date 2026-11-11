import { PrismaClient, Role, UserStatus, AccountStatus, TransactionType, TransactionStatus, EntryType } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Synthetic test password hash (Argon2id or deterministic mock for testing)
// In production, hashed via crypto.ts
const SYNTHETIC_HASH = '$argon2id$v=19$m=65536,t=3,p=4$syntheticSaltForDemoData$demoPasswordHashOnlyNotForProd';

function computeAuditHash(previousHash: string, sequenceNumber: number, timestamp: Date, action: string, resource: string): string {
  const payload = `${previousHash}:${sequenceNumber}:${timestamp.toISOString()}:${action}:${resource}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

async function main() {
  console.log('[Seed] Seeding synthetic development data...');

  // 1. Clean existing records (in dependency order)
  await prisma.auditLog.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create System Admin
  const admin = await prisma.user.create({
    data: {
      email: 'demo-admin@ledgerline.local',
      fullName: 'Synthetic Demo Admin',
      passwordHash: SYNTHETIC_HASH,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE
    }
  });

  // 3. Create Compliance Operator
  const operator = await prisma.user.create({
    data: {
      email: 'demo-operator@ledgerline.local',
      fullName: 'Synthetic Demo Operator',
      passwordHash: SYNTHETIC_HASH,
      role: Role.OPERATOR,
      status: UserStatus.ACTIVE
    }
  });

  // 4. Create Two Customer Users
  const customer1 = await prisma.user.create({
    data: {
      email: 'demo-customer1@ledgerline.local',
      fullName: 'Alice Demo (Synthetic)',
      passwordHash: SYNTHETIC_HASH,
      role: Role.CUSTOMER,
      status: UserStatus.ACTIVE
    }
  });

  const customer2 = await prisma.user.create({
    data: {
      email: 'demo-customer2@ledgerline.local',
      fullName: 'Bob Demo (Synthetic)',
      passwordHash: SYNTHETIC_HASH,
      role: Role.CUSTOMER,
      status: UserStatus.ACTIVE
    }
  });

  // 5. Create System Treasury & Customer Accounts
  // All monetary balances stored as integer minor units (paise: 100 paise = 1 INR)
  const systemAccount = await prisma.account.create({
    data: {
      accountNumber: 'SYSTEM-TREASURY-000000',
      userId: admin.id,
      balance: BigInt(1000000000), // 10,000,000 INR treasury reserve
      currency: 'INR',
      status: AccountStatus.ACTIVE
    }
  });

  const account1 = await prisma.account.create({
    data: {
      accountNumber: 'ACC-INR-100001',
      userId: customer1.id,
      balance: BigInt(750000), // 7,500.00 INR (after 2,500 transfer to Bob)
      currency: 'INR',
      status: AccountStatus.ACTIVE
    }
  });

  const account2 = await prisma.account.create({
    data: {
      accountNumber: 'ACC-INR-100002',
      userId: customer2.id,
      balance: BigInt(250000), // 2,500.00 INR
      currency: 'INR',
      status: AccountStatus.ACTIVE
    }
  });

  // 6. Seed Initial Funding Transaction (Double-entry: System Treasury -> Alice)
  const fundingTx = await prisma.transaction.create({
    data: {
      referenceId: 'TX-FUND-000001',
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.COMPLETED,
      amount: BigInt(1000000), // 10,000.00 INR
      currency: 'INR',
      description: 'Initial synthetic account funding',
      idempotencyKey: 'IDEMP-SEED-FUND-001',
      completedAt: new Date()
    }
  });

  await prisma.ledgerEntry.createMany({
    data: [
      {
        transactionId: fundingTx.id,
        accountId: systemAccount.id,
        entryType: EntryType.DEBIT,
        amount: BigInt(1000000),
        balanceAfter: BigInt(999000000)
      },
      {
        transactionId: fundingTx.id,
        accountId: account1.id,
        entryType: EntryType.CREDIT,
        amount: BigInt(1000000),
        balanceAfter: BigInt(1000000)
      }
    ]
  });

  // 7. Seed Peer-to-Peer Transfer (Double-entry: Alice -> Bob)
  const transferTx = await prisma.transaction.create({
    data: {
      referenceId: 'TX-P2P-000002',
      type: TransactionType.TRANSFER,
      status: TransactionStatus.COMPLETED,
      amount: BigInt(250000), // 2,500.00 INR
      currency: 'INR',
      description: 'Peer-to-peer transfer from Alice to Bob',
      idempotencyKey: 'IDEMP-SEED-XFER-002',
      completedAt: new Date()
    }
  });

  await prisma.ledgerEntry.createMany({
    data: [
      {
        transactionId: transferTx.id,
        accountId: account1.id,
        entryType: EntryType.DEBIT,
        amount: BigInt(250000),
        balanceAfter: BigInt(750000)
      },
      {
        transactionId: transferTx.id,
        accountId: account2.id,
        entryType: EntryType.CREDIT,
        amount: BigInt(250000),
        balanceAfter: BigInt(250000)
      }
    ]
  });

  // 8. Seed Chained Cryptographic Audit Trail
  const genesisHash = '0000000000000000000000000000000000000000000000000000000000000000';
  const now = new Date();

  // Audit 1: Genesis block
  const hash1 = computeAuditHash(genesisHash, 1, now, 'SYSTEM_INIT', 'System');
  await prisma.auditLog.create({
    data: {
      sequenceNumber: 1,
      timestamp: now,
      actorId: admin.id,
      actorRole: Role.ADMIN,
      action: 'SYSTEM_INIT',
      resource: 'System',
      resourceId: 'genesis',
      status: 'SUCCESS',
      details: { info: 'System initialized with synthetic demo data' },
      previousHash: genesisHash,
      currentHash: hash1
    }
  });

  // Audit 2: Transfer execution
  const hash2 = computeAuditHash(hash1, 2, now, 'MONEY_TRANSFER', 'Transaction');
  await prisma.auditLog.create({
    data: {
      sequenceNumber: 2,
      timestamp: now,
      actorId: customer1.id,
      actorRole: Role.CUSTOMER,
      action: 'MONEY_TRANSFER',
      resource: 'Transaction',
      resourceId: transferTx.id,
      status: 'SUCCESS',
      details: { referenceId: transferTx.referenceId, amount: 250000 },
      previousHash: hash1,
      currentHash: hash2
    }
  });

  console.log('[Seed] Synthetic database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('[Seed Error]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

