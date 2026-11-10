import { describe, it, expect } from '@jest/globals';
import { Prisma } from '@prisma/client';
import { toInputJsonValue, toSafeResponseBody } from '../src/middleware/idempotency.js';

describe('Idempotency JSON Response Converter (toInputJsonValue & toSafeResponseBody)', () => {
  describe('1. Date objects handling', () => {
    it('converts valid Date objects into standard ISO 8601 strings', () => {
      const fixedDate = new Date('2026-11-10T12:00:00.000Z');
      const result = toInputJsonValue(fixedDate);
      expect(result).toBe('2026-11-10T12:00:00.000Z');
    });

    it('converts nested Date objects in objects and arrays to ISO strings', () => {
      const date1 = new Date('2026-01-01T00:00:00.000Z');
      const date2 = new Date('2026-12-31T23:59:59.999Z');
      const input = {
        createdAt: date1,
        history: [{ timestamp: date2 }],
      };
      const result = toInputJsonValue(input);
      expect(result).toEqual({
        createdAt: '2026-01-01T00:00:00.000Z',
        history: [{ timestamp: '2026-12-31T23:59:59.999Z' }],
      });
    });

    it('converts invalid Date objects to null conforming to JSON.stringify behavior', () => {
      const invalidDate = new Date('invalid-date-string');
      expect(toInputJsonValue(invalidDate)).toBeNull();
    });
  });

  describe('2. BigInt values handling', () => {
    it('converts BigInt values to decimal string representation to preserve financial precision', () => {
      const minorUnits = BigInt('100000000000'); // 100 billion paise
      const result = toInputJsonValue(minorUnits);
      expect(result).toBe('100000000000');
    });

    it('converts nested BigInt values within account statement objects', () => {
      const payload = {
        accountId: 'acc-123',
        balance: BigInt(500000),
        entries: [
          { amount: BigInt(10000), balanceAfter: BigInt(510000) },
        ],
      };
      const result = toInputJsonValue(payload);
      expect(result).toEqual({
        accountId: 'acc-123',
        balance: '500000',
        entries: [
          { amount: '10000', balanceAfter: '510000' },
        ],
      });
    });
  });

  describe('3. Non-finite numbers handling', () => {
    it('converts NaN to null conforming to JSON specification', () => {
      expect(toInputJsonValue(NaN)).toBeNull();
    });

    it('converts positive and negative Infinity to null', () => {
      expect(toInputJsonValue(Infinity)).toBeNull();
      expect(toInputJsonValue(-Infinity)).toBeNull();
    });

    it('preserves valid finite numbers including zero and negative integers', () => {
      expect(toInputJsonValue(0)).toBe(0);
      expect(toInputJsonValue(42)).toBe(42);
      expect(toInputJsonValue(-100)).toBe(-100);
      expect(toInputJsonValue(3.14159)).toBe(3.14159);
    });

    it('converts non-finite numbers in nested structures to null', () => {
      const input = {
        valid: 100,
        notANumber: NaN,
        overflow: Infinity,
      };
      expect(toInputJsonValue(input)).toEqual({
        valid: 100,
        notANumber: null,
        overflow: null,
      });
    });
  });

  describe('4. Undefined properties & null handling', () => {
    it('omits undefined object properties to mirror standard JSON semantics', () => {
      const input = {
        name: 'LedgerLine',
        description: undefined,
        active: true,
      };
      const result = toInputJsonValue(input);
      expect(result).toEqual({
        name: 'LedgerLine',
        active: true,
      });
      expect(result).not.toHaveProperty('description');
    });

    it('converts undefined array elements to null mirroring JSON array serialization', () => {
      const input = [1, undefined, 'test', undefined];
      const result = toInputJsonValue(input);
      expect(result).toEqual([1, null, 'test', null]);
    });

    it('preserves explicit null values in objects and arrays', () => {
      const input = {
        referenceId: null,
        tags: [null, 'deposit'],
      };
      const result = toInputJsonValue(input);
      expect(result).toEqual({
        referenceId: null,
        tags: [null, 'deposit'],
      });
    });
  });

  describe('5. Nested objects, arrays, and custom toJSON methods', () => {
    it('deeply converts nested objects and multidimensional arrays', () => {
      const input = {
        level1: {
          level2: {
            matrix: [[1, 2], [3, 4]],
            amount: BigInt(999),
          },
        },
      };
      expect(toInputJsonValue(input)).toEqual({
        level1: {
          level2: {
            matrix: [[1, 2], [3, 4]],
            amount: '999',
          },
        },
      });
    });

    it('evaluates objects with custom toJSON methods recursively', () => {
      class CustomFinancialEntity {
        constructor(public code: string, public value: bigint) {}
        toJSON() {
          return {
            entityCode: this.code,
            amountMinorUnits: this.value.toString(),
          };
        }
      }

      const entity = new CustomFinancialEntity('INR', BigInt(25000));
      const result = toInputJsonValue(entity);
      expect(result).toEqual({
        entityCode: 'INR',
        amountMinorUnits: '25000',
      });
    });
  });

  describe('6. toSafeResponseBody top-level mapping', () => {
    it('maps null or undefined root payloads to Prisma.JsonNull', () => {
      expect(toSafeResponseBody(null)).toBe(Prisma.JsonNull);
      expect(toSafeResponseBody(undefined)).toBe(Prisma.JsonNull);
    });

    it('returns valid JSON objects and primitives for non-null root responses', () => {
      const response = { success: true, message: 'Transfer executed' };
      expect(toSafeResponseBody(response)).toEqual({
        success: true,
        message: 'Transfer executed',
      });
    });
  });
});

