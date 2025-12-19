import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

const mockSend = vi.fn();

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({ send: mockSend })),
  GetItemCommand: vi.fn(),
  PutItemCommand: vi.fn(),
  UpdateItemCommand: vi.fn(),
  DeleteItemCommand: vi.fn(),
  QueryCommand: vi.fn(),
  BatchGetItemCommand: vi.fn()
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: vi.fn((obj) => obj),
  unmarshall: vi.fn((obj) => obj)
}));

describe('Not Found Response Consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.TABLE_NAME = 'test-table';
  });

  /**
   * **Feature: data-access-layer-standardization, Property 15: Not found response consistency**
   * **Validates: Requirements 4.5**
   */
  it('should return consistent null responses when entities are not found across all models', async () => {
    const { Brand } = await import('../../models/brand.mjs');
    const { Persona } = await import('../../models/persona.mjs');
    const { Campaign } = await import('../../models/campaign.mjs');
    const { SocialPost } = await import('../../models/social-post.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          entityId: fc.string({ minLength: 1, maxLength: 50 })
        }),
        async (testData) => {
          mockSend.mockResolvedValue({ Item: null });

          const models = [
            { name: 'Brand', model: Brand, method: 'findById' },
            { name: 'Persona', model: Persona, method: 'findById' },
            { name: 'Campaign', model: Campaign, method: 'findById' },
            { name: 'SocialPost', model: SocialPost, method: 'findById' }
          ];

          const results = [];

          for (const { name, model, method } of models) {
            let result;
            if (name === 'SocialPost') {
              result = await model[method](testData.tenantId, testData.entityId, testData.entityId);
            } else {
              result = await model[method](testData.tenantId, testData.entityId);
            }

            results.push({
              modelName: name,
              result: result
            });
          }

          results.forEach(({ modelName, result }) => {
            expect(result).toBeNull();
          });

          const uniqueResults = [...new Set(results.map(r => r.result))];
          expect(uniqueResults.length).toBe(1);
          expect(uniqueResults[0]).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle non-existent entity updates consistently across all models', async () => {
    const { Brand } = await import('../../models/brand.mjs');
    const { Persona } = await import('../../models/persona.mjs');
    const { Campaign } = await import('../../models/campaign.mjs');
    const { SocialPost } = await import('../../models/social-post.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          entityId: fc.string({ minLength: 1, maxLength: 50 })
        }),
        async (testData) => {
          mockSend.mockResolvedValue({ Item: null });

          const updateData = { name: 'Updated Name' };

          const models = [
            { name: 'Brand', model: Brand, method: 'update' },
            { name: 'Persona', model: Persona, method: 'update' },
            { name: 'Campaign', model: Campaign, method: 'update' },
            { name: 'SocialPost', model: SocialPost, method: 'update' }
          ];

          const results = [];

          for (const { name, model, method } of models) {
            let result;
            if (name === 'SocialPost') {
              result = await model[method](testData.tenantId, testData.entityId, testData.entityId, updateData);
            } else {
              result = await model[method](testData.tenantId, testData.entityId, updateData);
            }

            results.push({
              modelName: name,
              result: result
            });
          }

          results.forEach(({ modelName, result }) => {
            expect(result).toBeNull();
          });

          const uniqueResults = [...new Set(results.map(r => r.result))];
          expect(uniqueResults.length).toBe(1);
          expect(uniqueResults[0]).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
