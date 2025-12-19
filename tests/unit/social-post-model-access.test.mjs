import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

const mockSend = vi.fn();

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({ send: mockSend })),
  GetItemCommand: vi.fn(),
  QueryCommand: vi.fn(),
  PutItemCommand: vi.fn(),
  UpdateItemCommand: vi.fn(),
  BatchWriteItemCommand: vi.fn()
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: vi.fn((obj) => obj),
  unmarshall: vi.fn((obj) => obj)
}));

describe('SocialPost Model-Based Data Access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TABLE_NAME = 'test-table';
  });

  /**
   * **Feature: data-access-layer-standardization, Property 1: Model-based data access consistency**
   * **Validates: Requirements 1.1, 2.1, 5.1**
   */
  it('should use model methods for all data access operations', async () => {
    const { SocialPost } = await import('../../models/social-post.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          campaignId: fc.string({ minLength: 1, maxLength: 50 }),
          postId: fc.string({ minLength: 1, maxLength: 50 }),
          personaId: fc.string({ minLength: 1, maxLength: 50 }),
          platform: fc.constantFrom('twitter', 'linkedin', 'instagram', 'facebook'),
          scheduledAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString()),
          topic: fc.string({ minLength: 1, maxLength: 100 }),
          intent: fc.constantFrom('announce', 'educate', 'opinion', 'invite_discussion', 'social_proof', 'reminder'),
          status: fc.constantFrom('planned', 'generating', 'completed', 'failed', 'skipped', 'needs_review')
        }),
        async (testData) => {
          mockSend.mockResolvedValueOnce({
            Item: {
              pk: `${testData.tenantId}#${testData.campaignId}`,
              sk: `POST#${testData.postId}`,
              postId: testData.postId,
              campaignId: testData.campaignId,
              tenantId: testData.tenantId,
              personaId: testData.personaId,
              platform: testData.platform,
              scheduledAt: testData.scheduledAt,
              topic: testData.topic,
              intent: testData.intent,
              status: testData.status,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              lastError: null
            }
          });

          const result = await SocialPost.findById(testData.tenantId, testData.campaignId, testData.postId);

          expect(mockSend).toHaveBeenCalled();
          expect(result).toBeDefined();
          expect(result.id).toBe(testData.postId);
          expect(result.tenantId).toBeUndefined();
          expect(result.pk).toBeUndefined();
          expect(result.sk).toBeUndefined();
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should delegate all data operations to model methods', async () => {
    const { SocialPost } = await import('../../models/social-post.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          campaignId: fc.string({ minLength: 1, maxLength: 50 }),
          platform: fc.constantFrom('twitter', 'linkedin', 'instagram', 'facebook')
        }),
        async (testData) => {
          mockSend.mockResolvedValueOnce({
            Items: [],
            LastEvaluatedKey: null
          });

          const result = await SocialPost.findByCampaign(testData.tenantId, testData.campaignId, 50, null, testData.platform);

          expect(mockSend).toHaveBeenCalled();
          expect(result).toHaveProperty('items');
          expect(result).toHaveProperty('pagination');
          expect(Array.isArray(result.items)).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });
});
