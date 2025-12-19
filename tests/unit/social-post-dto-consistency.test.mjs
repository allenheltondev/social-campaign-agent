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

describe('SocialPost DTO Return Consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TABLE_NAME = 'test-table';
  });

  /**
   * **Feature: data-access-layer-standardization, Property 6: Model DTO return consistency**
   * **Validates: Requirements 2.2, 3.3**
   */
  it('should return clean DTOs without internal fields from all model methods', async () => {
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
          const rawDynamoItem = {
            pk: `${testData.tenantId}#${testData.campaignId}`,
            sk: `POST#${testData.postId}`,
            GSI1PK: `${testData.tenantId}#${testData.campaignId}`,
            GSI1SK: `POST#${testData.platform}#${testData.scheduledAt}`,
            GSI2PK: `${testData.tenantId}#${testData.personaId}`,
            GSI2SK: `POST#${testData.campaignId}#${testData.scheduledAt}`,
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
          };

          mockSend.mockResolvedValueOnce({
            Item: rawDynamoItem
          });

          const result = await SocialPost.findById(testData.tenantId, testData.campaignId, testData.postId);

          expect(result).toBeDefined();
          expect(result.id).toBe(testData.postId);

          expect(result.tenantId).toBeUndefined();
          expect(result.pk).toBeUndefined();
          expect(result.sk).toBeUndefined();
          expect(result.GSI1PK).toBeUndefined();
          expect(result.GSI1SK).toBeUndefined();
          expect(result.GSI2PK).toBeUndefined();
          expect(result.GSI2SK).toBeUndefined();
          expect(result.postId).toBeUndefined();

          expect(result.campaignId).toBe(testData.campaignId);
          expect(result.personaId).toBe(testData.personaId);
          expect(result.platform).toBe(testData.platform);
          expect(result.scheduledAt).toBe(testData.scheduledAt);
          expect(result.topic).toBe(testData.topic);
          expect(result.intent).toBe(testData.intent);
          expect(result.status).toBe(testData.status);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should return consistent DTO structure from collection methods', async () => {
    const { SocialPost } = await import('../../models/social-post.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          campaignId: fc.string({ minLength: 1, maxLength: 50 }),
          platform: fc.constantFrom('twitter', 'linkedin', 'instagram', 'facebook')
        }),
        fc.array(
          fc.record({
            postId: fc.string({ minLength: 1, maxLength: 50 }),
            personaId: fc.string({ minLength: 1, maxLength: 50 }),
            platform: fc.constantFrom('twitter', 'linkedin', 'instagram', 'facebook'),
            scheduledAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString()),
            topic: fc.string({ minLength: 1, maxLength: 100 }),
            intent: fc.constantFrom('announce', 'educate', 'opinion', 'invite_discussion', 'social_proof', 'reminder'),
            status: fc.constantFrom('planned', 'generating', 'completed', 'failed', 'skipped', 'needs_review')
          }),
          { minLength: 0, maxLength: 5 }
        ),
        async (testData, posts) => {
          const dynamoItems = posts.map(post => ({
            pk: `${testData.tenantId}#${testData.campaignId}`,
            sk: `POST#${post.postId}`,
            GSI1PK: `${testData.tenantId}#${testData.campaignId}`,
            GSI1SK: `POST#${post.platform}#${post.scheduledAt}`,
            GSI2PK: `${testData.tenantId}#${post.personaId}`,
            GSI2SK: `POST#${testData.campaignId}#${post.scheduledAt}`,
            postId: post.postId,
            campaignId: testData.campaignId,
            tenantId: testData.tenantId,
            personaId: post.personaId,
            platform: post.platform,
            scheduledAt: post.scheduledAt,
            topic: post.topic,
            intent: post.intent,
            status: post.status,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastError: null
          }));

          mockSend.mockResolvedValueOnce({
            Items: dynamoItems,
            LastEvaluatedKey: null
          });

          const result = await SocialPost.findByCampaign(testData.tenantId, testData.campaignId, 50, null, testData.platform);

          expect(result).toHaveProperty('items');
          expect(result).toHaveProperty('pagination');
          expect(Array.isArray(result.items)).toBe(true);

          result.items.forEach((post, index) => {
            expect(post.id).toBe(posts[index].postId);

            expect(post.tenantId).toBeUndefined();
            expect(post.pk).toBeUndefined();
            expect(post.sk).toBeUndefined();
            expect(post.GSI1PK).toBeUndefined();
            expect(post.GSI1SK).toBeUndefined();
            expect(post.GSI2PK).toBeUndefined();
            expect(post.GSI2SK).toBeUndefined();
            expect(post.postId).toBeUndefined();

            expect(post.campaignId).toBe(testData.campaignId);
            expect(post.personaId).toBe(posts[index].personaId);
            expect(post.platform).toBe(posts[index].platform);
            expect(post.scheduledAt).toBe(posts[index].scheduledAt);
            expect(post.topic).toBe(posts[index].topic);
            expect(post.intent).toBe(posts[index].intent);
            expect(post.status).toBe(posts[index].status);
          });
        }
      ),
      { numRuns: 10 }
    );
  });
});
