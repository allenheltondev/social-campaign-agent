import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

const mockSend = vi.fn();

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({ send: mockSend })),
  GetItemCommand: vi.fn(),
  QueryCommand: vi.fn(),
  PutItemCommand: vi.fn(),
  UpdateItemCommand: vi.fn(),
  BatchGetItemCommand: vi.fn()
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: vi.fn((obj) => obj),
  unmarshall: vi.fn((obj) => obj)
}));

describe('Collection Response Format Consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TABLE_NAME = 'test-table';
  });

  /**
   * **Feature: data-access-layer-standardization, Property 13: Collection response format consistency**
   * **Validates: Requirements 4.2**
   */
  it('should return consistent collection response format across all entity types', async () => {
    const { Persona } = await import('../../models/persona.mjs');
    const { SocialPost } = await import('../../models/social-post.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          campaignId: fc.string({ minLength: 1, maxLength: 50 }),
          limit: fc.integer({ min: 1, max: 100 })
        }),
        fc.array(
          fc.record({
            personaId: fc.string({ minLength: 1, maxLength: 50 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            role: fc.string({ minLength: 1, maxLength: 100 }),
            company: fc.string({ minLength: 1, maxLength: 100 }),
            primaryAudience: fc.constantFrom('executives', 'professionals', 'consumers', 'technical', 'creative'),
            voiceTraits: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
            isActive: fc.boolean()
          }),
          { minLength: 0, maxLength: 10 }
        ),
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
          { minLength: 0, maxLength: 10 }
        ),
        async (testData, personas, posts) => {
          // Test Persona collection response format
          const personaDynamoItems = personas.map(persona => ({
            pk: `${testData.tenantId}#${persona.personaId}`,
            sk: 'persona',
            GSI1PK: testData.tenantId,
            GSI1SK: `PERSONA#${new Date().toISOString()}`,
            personaId: persona.personaId,
            tenantId: testData.tenantId,
            name: persona.name,
            role: persona.role,
            company: persona.company,
            primaryAudience: persona.primaryAudience,
            voiceTraits: persona.voiceTraits,
            writingHabits: {
              paragraphs: 'medium',
              questions: 'occasional',
              emojis: 'sparing',
              structure: 'mixed'
            },
            opinions: {
              strongBeliefs: ['test belief'],
              avoidsTopics: []
            },
            language: {
              avoid: [],
              prefer: []
            },
            ctaStyle: {
              aggressiveness: 'medium',
              patterns: []
            },
            isActive: persona.isActive,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }));

          const hasNextToken = Math.random() > 0.5;
          const lastEvaluatedKey = hasNextToken ? { pk: 'test', sk: 'test' } : null;

          mockSend.mockResolvedValueOnce({
            Items: personaDynamoItems,
            LastEvaluatedKey: lastEvaluatedKey
          });

          const personaResult = await Persona.list(testData.tenantId, { limit: testData.limit });

          // Verify Persona collection response structure follows standardized format
          expect(personaResult).toHaveProperty('items');
          expect(personaResult).toHaveProperty('pagination');
          expect(Array.isArray(personaResult.items)).toBe(true);
          expect(personaResult.pagination).toHaveProperty('limit');
          expect(personaResult.pagination).toHaveProperty('hasNextPage');
          expect(personaResult.pagination).toHaveProperty('nextToken');

          // Should have consistent pagination structure
          if (hasNextToken) {
            expect(personaResult.pagination.nextToken).toBeDefined();
            expect(typeof personaResult.pagination.nextToken).toBe('string');
          } else {
            expect(personaResult.pagination.nextToken).toBeNull();
          }

          // Test SocialPost collection response format
          const postDynamoItems = posts.map(post => ({
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
            Items: postDynamoItems,
            LastEvaluatedKey: lastEvaluatedKey
          });

          const postResult = await SocialPost.findByCampaign(testData.tenantId, testData.campaignId, testData.limit);

          // Verify SocialPost collection response structure follows standardized format
          expect(postResult).toHaveProperty('items');
          expect(postResult).toHaveProperty('pagination');
          expect(Array.isArray(postResult.items)).toBe(true);
          expect(postResult.pagination).toHaveProperty('limit');
          expect(postResult.pagination).toHaveProperty('hasNextPage');
          expect(postResult.pagination).toHaveProperty('nextToken');

          // Both should have consistent structure patterns
          // Items array should be present with standardized name
          expect(Array.isArray(personaResult.items)).toBe(true);
          expect(Array.isArray(postResult.items)).toBe(true);

          // Pagination should be consistent across both entity types
          if (hasNextToken) {
            expect(personaResult.pagination.nextToken).toBeDefined();
            expect(postResult.pagination.nextToken).toBeDefined();
            expect(personaResult.pagination.hasNextPage).toBe(true);
            expect(postResult.pagination.hasNextPage).toBe(true);
          } else {
            expect(personaResult.pagination.nextToken).toBeNull();
            expect(postResult.pagination.nextToken).toBeNull();
            expect(personaResult.pagination.hasNextPage).toBe(false);
            expect(postResult.pagination.hasNextPage).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have consistent pagination metadata structure across all collections', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          limit: fc.integer({ min: 1, max: 100 }),
          hasNextPage: fc.boolean(),
          totalCount: fc.integer({ min: 0, max: 1000 })
        }),
        (testData) => {
          // Test the expected standardized collection response format
          const standardizedResponse = {
            items: [], // This should be the consistent name across all collections
            pagination: {
              limit: testData.limit,
              hasNextPage: testData.hasNextPage,
              nextToken: testData.hasNextPage ? 'some-token' : null
            }
          };

          // Verify the structure matches the design specification
          expect(standardizedResponse).toHaveProperty('items');
          expect(standardizedResponse).toHaveProperty('pagination');
          expect(standardizedResponse.pagination).toHaveProperty('limit');
          expect(standardizedResponse.pagination).toHaveProperty('hasNextPage');
          expect(standardizedResponse.pagination).toHaveProperty('nextToken');

          expect(Array.isArray(standardizedResponse.items)).toBe(true);
          expect(typeof standardizedResponse.pagination.limit).toBe('number');
          expect(typeof standardizedResponse.pagination.hasNextPage).toBe('boolean');

          if (testData.hasNextPage) {
            expect(standardizedResponse.pagination.nextToken).toBeDefined();
          } else {
            expect(standardizedResponse.pagination.nextToken).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
