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

/**
 * **Feature: data-access-layer-standardization, Property 16: Business logic DTO usage**
 * **Validates: Requirements 5.2**
 *
 * Property-based test to verify that business logic operations work with DTO objects
 * rather than raw database records. This ensures clean separation between data access
 * and business logic layers.
 */

describe('Business Logic DTO Usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TABLE_NAME = 'test-table';
  });

  it('should work with DTOs that have no internal database fields', async () => {
    const { Campaign } = await import('../../models/campaign.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          campaignId: fc.string({ minLength: 1, maxLength: 50 }),
          name: fc.string({ minLength: 1, maxLength: 100 }),
          brief: fc.string({ minLength: 10, maxLength: 500 }),
          status: fc.constantFrom('planning', 'generating', 'completed', 'failed', 'cancelled', 'awaiting_review')
        }),
        async (testData) => {
          const now = new Date().toISOString();
          const rawDynamoItem = {
            pk: `${testData.tenantId}#${testData.campaignId}`,
            sk: 'campaign',
            GSI1PK: testData.tenantId,
            GSI1SK: `CAMPAIGN#${now}`,
            id: testData.campaignId,
            tenantId: testData.tenantId,
            brandId: null,
            name: testData.name,
            brief: {
              description: testData.brief,
              objective: 'awareness',
              primaryCTA: null
            },
            participants: {
              personaIds: ['persona1'],
              platforms: ['twitter'],
              distribution: { mode: 'balanced' }
            },
            schedule: {
              timezone: 'UTC',
              startDate: now,
              endDate: new Date(Date.now() + 86400000).toISOString(),
              allowedDaysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'],
              blackoutDates: null,
              postingWindows: null
            },
            cadenceOverrides: null,
            messaging: null,
            assetOverrides: null,
            status: testData.status,
            planSummary: null,
            metadata: {
              source: 'api',
              externalRef: null
            },
            createdAt: now,
            updatedAt: now,
            completedAt: null
          };

          mockSend.mockResolvedValueOnce({
            Item: rawDynamoItem
          });

          const dto = await Campaign.findById(testData.tenantId, testData.campaignId);

          expect(dto).toBeDefined();
          expect(dto.id).toBe(testData.campaignId);
          expect(dto.name).toBe(testData.name);
          expect(dto.brief.description).toBe(testData.brief);
          expect(dto.status).toBe(testData.status);

          expect(dto.pk).toBeUndefined();
          expect(dto.sk).toBeUndefined();
          expect(dto.GSI1PK).toBeUndefined();
          expect(dto.GSI1SK).toBeUndefined();
          expect(dto.tenantId).toBeUndefined();
          expect(dto.campaignId).toBeUndefined();

          const dtoKeys = Object.keys(dto);
          const hasInternalFields = dtoKeys.some(key =>
            key === 'pk' || key === 'sk' ||
            key.startsWith('GSI') ||
            key === 'tenantId' ||
            key === 'campaignId' // brandId is a business field for Campaign
          );

          expect(hasInternalFields).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should work with Brand DTOs without internal fields', async () => {
    const { Brand } = await import('../../models/brand.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          brandId: fc.string({ minLength: 1, maxLength: 50 }),
          name: fc.string({ minLength: 1, maxLength: 100 }),
          description: fc.string({ minLength: 1, maxLength: 500 })
        }),
        async (testData) => {
          const rawDynamoItem = {
            pk: `${testData.tenantId}#${testData.brandId}`,
            sk: 'brand',
            GSI1PK: testData.tenantId,
            GSI1SK: `BRAND#${new Date().toISOString()}`,
            brandId: testData.brandId,
            tenantId: testData.tenantId,
            name: testData.name,
            description: testData.description,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          mockSend.mockResolvedValueOnce({
            Item: rawDynamoItem
          });

          const dto = await Brand.findById(testData.tenantId, testData.brandId);

          expect(dto).toBeDefined();
          expect(dto.id).toBe(testData.brandId);
          expect(dto.name).toBe(testData.name);

          expect(dto.pk).toBeUndefined();
          expect(dto.sk).toBeUndefined();
          expect(dto.GSI1PK).toBeUndefined();
          expect(dto.GSI1SK).toBeUndefined();
          expect(dto.tenantId).toBeUndefined();
          expect(dto.brandId).toBeUndefined();

          const dtoKeys = Object.keys(dto);
          const hasInternalFields = dtoKeys.some(key =>
            key === 'pk' || key === 'sk' ||
            key.startsWith('GSI') ||
            key === 'tenantId' ||
            key === 'campaignId' || key === 'personaId' || key === 'brandId' || key === 'postId'
          );

          expect(hasInternalFields).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should work with Persona DTOs without internal fields', async () => {
    const { Persona } = await import('../../models/persona.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          personaId: fc.string({ minLength: 1, maxLength: 50 }),
          name: fc.string({ minLength: 1, maxLength: 100 }),
          role: fc.string({ minLength: 1, maxLength: 100 })
        }),
        async (testData) => {
          const rawDynamoItem = {
            pk: `${testData.tenantId}#${testData.personaId}`,
            sk: 'persona',
            GSI1PK: testData.tenantId,
            GSI1SK: `PERSONA#${new Date().toISOString()}`,
            personaId: testData.personaId,
            tenantId: testData.tenantId,
            name: testData.name,
            role: testData.role,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          mockSend.mockResolvedValueOnce({
            Item: rawDynamoItem
          });

          const dto = await Persona.findById(testData.tenantId, testData.personaId);

          expect(dto).toBeDefined();
          expect(dto.id).toBe(testData.personaId);
          expect(dto.name).toBe(testData.name);

          expect(dto.pk).toBeUndefined();
          expect(dto.sk).toBeUndefined();
          expect(dto.GSI1PK).toBeUndefined();
          expect(dto.GSI1SK).toBeUndefined();
          expect(dto.tenantId).toBeUndefined();
          expect(dto.personaId).toBeUndefined();

          const dtoKeys = Object.keys(dto);
          const hasInternalFields = dtoKeys.some(key =>
            key === 'pk' || key === 'sk' ||
            key.startsWith('GSI') ||
            key === 'tenantId' ||
            key === 'campaignId' || key === 'personaId' || key === 'brandId' || key === 'postId'
          );

          expect(hasInternalFields).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should work with SocialPost DTOs without internal fields', async () => {
    const { SocialPost } = await import('../../models/social-post.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          campaignId: fc.string({ minLength: 1, maxLength: 50 }),
          postId: fc.string({ minLength: 1, maxLength: 50 }),
          personaId: fc.string({ minLength: 1, maxLength: 50 }),
          platform: fc.constantFrom('twitter', 'linkedin', 'instagram', 'facebook'),
          topic: fc.string({ minLength: 1, maxLength: 100 })
        }),
        async (testData) => {
          const now = new Date().toISOString();
          const rawDynamoItem = {
            pk: `${testData.tenantId}#${testData.campaignId}`,
            sk: `POST#${testData.postId}`,
            GSI1PK: `${testData.tenantId}#${testData.campaignId}`,
            GSI1SK: `POST#${testData.platform}#${now}`,
            postId: testData.postId,
            campaignId: testData.campaignId,
            tenantId: testData.tenantId,
            personaId: testData.personaId,
            platform: testData.platform,
            scheduledAt: now,
            topic: testData.topic,
            intent: 'announce',
            status: 'planned',
            lastError: null,
            createdAt: now,
            updatedAt: now
          };

          mockSend.mockResolvedValueOnce({
            Item: rawDynamoItem
          });

          const dto = await SocialPost.findById(testData.tenantId, testData.campaignId, testData.postId);

          expect(dto).toBeDefined();
          expect(dto.id).toBe(testData.postId);
          expect(dto.platform).toBe(testData.platform);

          expect(dto.pk).toBeUndefined();
          expect(dto.sk).toBeUndefined();
          expect(dto.GSI1PK).toBeUndefined();
          expect(dto.GSI1SK).toBeUndefined();
          expect(dto.GSI2PK).toBeUndefined();
          expect(dto.GSI2SK).toBeUndefined();
          expect(dto.tenantId).toBeUndefined();
          expect(dto.postId).toBeUndefined();

          const dtoKeys = Object.keys(dto);
          const hasInternalFields = dtoKeys.some(key =>
            key === 'pk' || key === 'sk' ||
            key.startsWith('GSI') ||
            key === 'tenantId' ||
            key === 'postId' // campaignId and personaId are business fields for SocialPost
          );

          expect(hasInternalFields).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
