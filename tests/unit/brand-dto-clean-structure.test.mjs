import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

const mockSend = vi.fn();

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({ send: mockSend })),
  GetItemCommand: vi.fn(),
  PutItemCommand: vi.fn(),
  UpdateItemCommand: vi.fn(),
  DeleteItemCommand: vi.fn()
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: vi.fn((obj) => obj),
  unmarshall: vi.fn((obj) => obj)
}));

describe('Brand DTO Clean Structure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TABLE_NAME = 'test-table';
  });

  /**
   * **Feature: data-access-layer-standardization, Property 5: DTO clean structure**
   * **Validates: Requirements 1.5**
   */
  it('should return clean DTOs without internal database artifacts', async () => {
    const { Brand } = await import('../../models/brand.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          brandId: fc.string({ minLength: 1, maxLength: 50 }),
          name: fc.string({ minLength: 1, maxLength: 100 }),
          ethos: fc.string({ minLength: 1, maxLength: 1000 }),
          coreValues: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 1, maxLength: 10 }),
          primaryAudience: fc.constantFrom('executives', 'professionals', 'consumers', 'technical', 'creative'),
          status: fc.constantFrom('active', 'inactive', 'archived')
        }),
        async (testData) => {
          const rawDynamoItem = {
            pk: `${testData.tenantId}#${testData.brandId}`,
            sk: 'metadata',
            GSI1PK: testData.tenantId,
            GSI1SK: `BRAND#${new Date().toISOString()}`,
            GSI2PK: `${testData.tenantId}#${testData.status}`,
            GSI2SK: `BRAND#${new Date().toISOString()}`,
            brandId: testData.brandId,
            tenantId: testData.tenantId,
            name: testData.name,
            ethos: testData.ethos,
            coreValues: testData.coreValues,
            primaryAudience: testData.primaryAudience,
            status: testData.status,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            voiceGuidelines: {
              tone: ['professional'],
              style: ['clear'],
              messaging: ['value-focused']
            },
            visualIdentity: {
              colorPalette: ['#000000'],
              typography: ['Arial'],
              imagery: ['modern']
            },
            contentStandards: {
              qualityRequirements: ['high-quality'],
              restrictions: []
            }
          };

          mockSend.mockResolvedValueOnce({
            Item: rawDynamoItem
          });

          const result = await Brand.findById(testData.tenantId, testData.brandId);

          expect(result).toBeDefined();
          expect(result.id).toBe(testData.brandId);

          expect(result.tenantId).toBeUndefined();
          expect(result.pk).toBeUndefined();
          expect(result.sk).toBeUndefined();
          expect(result.GSI1PK).toBeUndefined();
          expect(result.GSI1SK).toBeUndefined();
          expect(result.GSI2PK).toBeUndefined();
          expect(result.GSI2SK).toBeUndefined();
          expect(result.brandId).toBeUndefined();

          expect(result.name).toBe(testData.name);
          expect(result.ethos).toBe(testData.ethos);
          expect(result.coreValues).toEqual(testData.coreValues);
          expect(result.primaryAudience).toBe(testData.primaryAudience);
          expect(result.status).toBe(testData.status);
          expect(result.createdAt).toBeDefined();
          expect(result.updatedAt).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return clean DTOs from transformation method directly', async () => {
    const { Brand } = await import('../../models/brand.mjs');

    await fc.assert(
      fc.property(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          brandId: fc.string({ minLength: 1, maxLength: 50 }),
          name: fc.string({ minLength: 1, maxLength: 100 }),
          ethos: fc.string({ minLength: 1, maxLength: 1000 }),
          status: fc.constantFrom('active', 'inactive', 'archived')
        }),
        (testData) => {
          const rawDynamoItem = {
            pk: `${testData.tenantId}#${testData.brandId}`,
            sk: 'metadata',
            GSI1PK: testData.tenantId,
            GSI1SK: `BRAND#${new Date().toISOString()}`,
            GSI2PK: `${testData.tenantId}#${testData.status}`,
            GSI2SK: `BRAND#${new Date().toISOString()}`,
            brandId: testData.brandId,
            tenantId: testData.tenantId,
            name: testData.name,
            ethos: testData.ethos,
            status: testData.status,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          const result = Brand._transformFromDynamoDB(rawDynamoItem);

          expect(result.id).toBe(testData.brandId);

          expect(result.tenantId).toBeUndefined();
          expect(result.pk).toBeUndefined();
          expect(result.sk).toBeUndefined();
          expect(result.GSI1PK).toBeUndefined();
          expect(result.GSI1SK).toBeUndefined();
          expect(result.GSI2PK).toBeUndefined();
          expect(result.GSI2SK).toBeUndefined();
          expect(result.brandId).toBeUndefined();

          expect(result.name).toBe(testData.name);
          expect(result.ethos).toBe(testData.ethos);
          expect(result.status).toBe(testData.status);
        }
      ),
      { numRuns: 100 }
    );
  });
});
