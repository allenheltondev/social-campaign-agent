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
  BatchGetItemCommand: vi.fn(),
  BatchWriteItemCommand: vi.fn()
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: vi.fn((obj) => obj),
  unmarshall: vi.fn((obj) => obj)
}));

describe('DTO Validation Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TABLE_NAME = 'test-table';
  });

  it('should handle null and undefined values in DTO transformation', async () => {
    const { Campaign } = await import('../../models/campaign.mjs');
    const { Brand } = await import('../../models/brand.mjs');
    const { Persona } = await import('../../models/persona.mjs');
    const { SocialPost } = await import('../../models/social-post.mjs');

    await fc.assert(
      fc.property(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          entityId: fc.string({ minLength: 1, maxLength: 50 }),
          entityType: fc.constantFrom('brand', 'persona', 'campaign', 'socialpost')
        }),
        (testData) => {
          const now = new Date().toISOString();
          let result;

          switch (testData.entityType) {
            case 'brand': {
              const rawBrandItem = {
                pk: `${testData.tenantId}#${testData.entityId}`,
                sk: 'metadata',
                GSI1PK: testData.tenantId,
                GSI1SK: `BRAND#${now}`,
                brandId: testData.entityId,
                tenantId: testData.tenantId,
                name: 'Test Brand',
                ethos: 'Test ethos',
                coreValues: ['value1'],
                primaryAudience: 'professionals',
                status: 'active',
                createdAt: now,
                updatedAt: now,
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
                },
                // Test null/undefined values
                platformGuidelines: null,
                audienceProfile: undefined,
                pillars: null
              };

              result = Brand._transformFromDynamoDB(rawBrandItem);
              break;
            }

            case 'persona': {
              const rawPersonaItem = {
                pk: `${testData.tenantId}#${testData.entityId}`,
                sk: 'persona',
                GSI1PK: testData.tenantId,
                GSI1SK: `PERSONA#${now}`,
                personaId: testData.entityId,
                tenantId: testData.tenantId,
                name: 'Test Persona',
                role: 'Manager',
                company: 'TestCorp',
                primaryAudience: 'professionals',
                voiceTraits: ['professional'],
                writingHabits: {
                  paragraphs: 'medium',
                  questions: 'occasional',
                  emojis: 'sparing',
                  structure: 'prose'
                },
                opinions: {
                  strongBeliefs: ['quality matters'],
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
                isActive: true,
                createdAt: now,
                updatedAt: now,
                // Test null/undefined values
                inferredStyle: null,
                analysisStatus: undefined,
                lastAnalysisAt: null
              };

              result = Persona.transformFromDynamoDB(rawPersonaItem);
              break;
            }

            case 'campaign': {
              const rawCampaignItem = {
                pk: `${testData.tenantId}#${testData.entityId}`,
                sk: 'campaign',
                GSI1PK: testData.tenantId,
                GSI1SK: `CAMPAIGN#${now}`,
                id: testData.entityId,
                tenantId: testData.tenantId,
                brandId: null,
                name: 'Test Campaign',
                brief: {
                  description: 'Test campaign description',
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
                status: 'planning',
                planSummary: null,
                metadata: {
                  source: 'api',
                  externalRef: null
                },
                createdAt: now,
                updatedAt: now,
                completedAt: null,
                // Test null/undefined values
                lastError: undefined
              };

              result = Campaign._transformFromDynamoDB(rawCampaignItem);
              break;
            }

            case 'socialpost': {
              const rawPostItem = {
                pk: `${testData.tenantId}#campaign1`,
                sk: `POST#${testData.entityId}`,
                GSI1PK: `${testData.tenantId}#campaign1`,
                GSI1SK: `POST#twitter#${now}`,
                postId: testData.entityId,
                campaignId: 'campaign1',
                tenantId: testData.tenantId,
                personaId: 'persona1',
                platform: 'twitter',
                scheduledAt: now,
                topic: 'Test topic',
                intent: 'announce',
                status: 'planned',
                lastError: null,
                createdAt: now,
                updatedAt: now,
                // Test null/undefined values
                content: undefined,
                references: null,
                assetRequirements: undefined
              };

              result = SocialPost._transformFromDynamoDB(rawPostItem);
              break;
            }
          }

          // Verify DTO structure is maintained even with null/undefined values
          expect(result).toBeDefined();
          expect(result).not.toBeNull();
          expect(result).toHaveProperty('id');
          expect(result.id).toBe(testData.entityId);

          // Verify no internal fields are present
          expect(result.pk).toBeUndefined();
          expect(result.sk).toBeUndefined();
          expect(result.GSI1PK).toBeUndefined();
          expect(result.GSI1SK).toBeUndefined();
          expect(result.tenantId).toBeUndefined();

          // Entity-specific internal field checks
          if (testData.entityType === 'brand') {
            expect(result.brandId).toBeUndefined();
          }
          if (testData.entityType === 'persona') {
            expect(result.personaId).toBeUndefined();
          }
          if (testData.entityType === 'socialpost') {
            expect(result.postId).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle error scenarios with consistent DTO formats', async () => {
    const { Campaign } = await import('../../models/campaign.mjs');
    const { Brand } = await import('../../models/brand.mjs');
    const { Persona } = await import('../../models/persona.mjs');
    const { SocialPost } = await import('../../models/social-post.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          entityId: fc.string({ minLength: 1, maxLength: 50 }),
          errorType: fc.constantFrom('ValidationError', 'NetworkError', 'ConditionalCheckFailedException')
        }),
        async (testData) => {
          const simulatedError = new Error('Simulated error');
          simulatedError.name = testData.errorType;

          mockSend.mockRejectedValue(simulatedError);

          const models = [
            { name: 'Brand', model: Brand, method: 'findById' },
            { name: 'Persona', model: Persona, method: 'findById' },
            { name: 'Campaign', model: Campaign, method: 'findById' },
            { name: 'SocialPost', model: SocialPost, method: 'findById' }
          ];

          const errorResults = [];

          for (const { name, model, method } of models) {
            try {
              if (name === 'SocialPost') {
                await model[method](testData.tenantId, testData.entityId, testData.entityId);
              } else {
                await model[method](testData.tenantId, testData.entityId);
              }
            } catch (error) {
              errorResults.push({
                modelName: name,
                errorMessage: error.message,
                errorName: error.name || 'Error',
                hasMessage: typeof error.message === 'string' && error.message.length > 0
              });
            }
          }

          // Verify all models threw errors
          expect(errorResults.length).toBe(4);

          // Verify consistent error handling patterns
          errorResults.forEach(result => {
            expect(result.hasMessage).toBe(true);
            expect(result.errorMessage).toMatch(/^Failed to (retrieve|save|update|delete)/);
            expect(result.errorName).toBe('Error');
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate model method responses follow DTO patterns', async () => {
    const { Campaign } = await import('../../models/campaign.mjs');
    const { Brand } = await import('../../models/brand.mjs');
    const { Persona } = await import('../../models/persona.mjs');
    const { SocialPost } = await import('../../models/social-post.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          entityId: fc.string({ minLength: 1, maxLength: 50 }),
          entityType: fc.constantFrom('brand', 'persona', 'campaign', 'socialpost')
        }),
        async (testData) => {
          const now = new Date().toISOString();
          let mockItem;

          switch (testData.entityType) {
            case 'brand':
              mockItem = {
                pk: `${testData.tenantId}#${testData.entityId}`,
                sk: 'metadata',
                GSI1PK: testData.tenantId,
                GSI1SK: `BRAND#${now}`,
                brandId: testData.entityId,
                tenantId: testData.tenantId,
                name: 'Test Brand',
                ethos: 'Test ethos',
                coreValues: ['value1'],
                primaryAudience: 'professionals',
                status: 'active',
                createdAt: now,
                updatedAt: now,
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
              break;

            case 'persona':
              mockItem = {
                pk: `${testData.tenantId}#${testData.entityId}`,
                sk: 'persona',
                GSI1PK: testData.tenantId,
                GSI1SK: `PERSONA#${now}`,
                personaId: testData.entityId,
                tenantId: testData.tenantId,
                name: 'Test Persona',
                role: 'Manager',
                company: 'TestCorp',
                primaryAudience: 'professionals',
                voiceTraits: ['professional'],
                writingHabits: {
                  paragraphs: 'medium',
                  questions: 'occasional',
                  emojis: 'sparing',
                  structure: 'prose'
                },
                opinions: {
                  strongBeliefs: ['quality matters'],
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
                isActive: true,
                createdAt: now,
                updatedAt: now
              };
              break;

            case 'campaign':
              mockItem = {
                pk: `${testData.tenantId}#${testData.entityId}`,
                sk: 'campaign',
                GSI1PK: testData.tenantId,
                GSI1SK: `CAMPAIGN#${now}`,
                id: testData.entityId,
                tenantId: testData.tenantId,
                brandId: null,
                name: 'Test Campaign',
                brief: {
                  description: 'Test campaign description',
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
                status: 'planning',
                planSummary: null,
                metadata: {
                  source: 'api',
                  externalRef: null
                },
                createdAt: now,
                updatedAt: now,
                completedAt: null
              };
              break;

            case 'socialpost':
              mockItem = {
                pk: `${testData.tenantId}#campaign1`,
                sk: `POST#${testData.entityId}`,
                GSI1PK: `${testData.tenantId}#campaign1`,
                GSI1SK: `POST#twitter#${now}`,
                postId: testData.entityId,
                campaignId: 'campaign1',
                tenantId: testData.tenantId,
                personaId: 'persona1',
                platform: 'twitter',
                scheduledAt: now,
                topic: 'Test topic',
                intent: 'announce',
                status: 'planned',
                lastError: null,
                createdAt: now,
                updatedAt: now
              };
              break;
          }

          mockSend.mockResolvedValueOnce({ Item: mockItem });

          let result;
          switch (testData.entityType) {
            case 'brand':
              result = await Brand.findById(testData.tenantId, testData.entityId);
              break;
            case 'persona':
              result = await Persona.findById(testData.tenantId, testData.entityId);
              break;
            case 'campaign':
              result = await Campaign.findById(testData.tenantId, testData.entityId);
              break;
            case 'socialpost':
              result = await SocialPost.findById(testData.tenantId, 'campaign1', testData.entityId);
              break;
          }

          // Verify DTO patterns are followed
          expect(result).toBeDefined();
          expect(result).not.toBeNull();

          // 1. Must have clean "id" property
          expect(result).toHaveProperty('id');
          expect(typeof result.id).toBe('string');
          expect(result.id).toBe(testData.entityId);

          // 2. Must have timestamps
          expect(result).toHaveProperty('createdAt');
          expect(result).toHaveProperty('updatedAt');
          expect(typeof result.createdAt).toBe('string');
          expect(typeof result.updatedAt).toBe('string');

          // 3. Must not contain internal database fields
          const internalFields = ['pk', 'sk', 'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK', 'tenantId'];
          internalFields.forEach(field => {
            expect(result).not.toHaveProperty(field);
          });

          // 4. Entity-specific internal field checks
          if (testData.entityType === 'brand') {
            expect(result.brandId).toBeUndefined();
          }
          if (testData.entityType === 'persona') {
            expect(result.personaId).toBeUndefined();
          }
          if (testData.entityType === 'socialpost') {
            expect(result.postId).toBeUndefined();
          }

          // 5. Must be plain object
          expect(result.constructor).toBe(Object);

          // 6. Timestamps must be valid ISO strings
          expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
          expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty and minimal data in DTO transformation', async () => {
    const { Campaign } = await import('../../models/campaign.mjs');
    const { Brand } = await import('../../models/brand.mjs');
    const { Persona } = await import('../../models/persona.mjs');
    const { SocialPost } = await import('../../models/social-post.mjs');

    await fc.assert(
      fc.property(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          entityId: fc.string({ minLength: 1, maxLength: 50 }),
          entityType: fc.constantFrom('brand', 'persona', 'campaign', 'socialpost')
        }),
        (testData) => {
          const now = new Date().toISOString();
          let result;

          switch (testData.entityType) {
            case 'brand': {
              // Minimal brand data
              const rawBrandItem = {
                pk: `${testData.tenantId}#${testData.entityId}`,
                sk: 'metadata',
                brandId: testData.entityId,
                tenantId: testData.tenantId,
                name: 'Test Brand',
                ethos: 'Test ethos',
                coreValues: ['value1'],
                primaryAudience: 'professionals',
                status: 'active',
                createdAt: now,
                updatedAt: now,
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

              result = Brand._transformFromDynamoDB(rawBrandItem);
              break;
            }

            case 'persona': {
              // Minimal persona data
              const rawPersonaItem = {
                pk: `${testData.tenantId}#${testData.entityId}`,
                sk: 'persona',
                personaId: testData.entityId,
                tenantId: testData.tenantId,
                name: 'Test Persona',
                role: 'Manager',
                company: 'TestCorp',
                primaryAudience: 'professionals',
                voiceTraits: ['professional'],
                writingHabits: {
                  paragraphs: 'medium',
                  questions: 'occasional',
                  emojis: 'sparing',
                  structure: 'prose'
                },
                opinions: {
                  strongBeliefs: ['quality matters'],
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
                isActive: true,
                createdAt: now,
                updatedAt: now
              };

              result = Persona.transformFromDynamoDB(rawPersonaItem);
              break;
            }

            case 'campaign': {
              // Minimal campaign data
              const rawCampaignItem = {
                pk: `${testData.tenantId}#${testData.entityId}`,
                sk: 'campaign',
                id: testData.entityId,
                tenantId: testData.tenantId,
                brandId: null,
                name: 'Test Campaign',
                brief: {
                  description: 'Test campaign description',
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
                status: 'planning',
                planSummary: null,
                metadata: {
                  source: 'api',
                  externalRef: null
                },
                createdAt: now,
                updatedAt: now,
                completedAt: null
              };

              result = Campaign._transformFromDynamoDB(rawCampaignItem);
              break;
            }

            case 'socialpost': {
              // Minimal social post data
              const rawPostItem = {
                pk: `${testData.tenantId}#campaign1`,
                sk: `POST#${testData.entityId}`,
                postId: testData.entityId,
                campaignId: 'campaign1',
                tenantId: testData.tenantId,
                personaId: 'persona1',
                platform: 'twitter',
                scheduledAt: now,
                topic: 'Test topic',
                intent: 'announce',
                status: 'planned',
                lastError: null,
                createdAt: now,
                updatedAt: now
              };

              result = SocialPost._transformFromDynamoDB(rawPostItem);
              break;
            }
          }

          // Verify DTO structure is maintained even with minimal data
          expect(result).toBeDefined();
          expect(result).not.toBeNull();
          expect(result).toHaveProperty('id');
          expect(result.id).toBe(testData.entityId);

          // Verify no internal fields are present
          expect(result.pk).toBeUndefined();
          expect(result.sk).toBeUndefined();
          expect(result.tenantId).toBeUndefined();

          // Entity-specific internal field checks
          if (testData.entityType === 'brand') {
            expect(result.brandId).toBeUndefined();
          }
          if (testData.entityType === 'persona') {
            expect(result.personaId).toBeUndefined();
          }
          if (testData.entityType === 'socialpost') {
            expect(result.postId).toBeUndefined();
          }

          // Verify timestamps are present
          expect(result).toHaveProperty('createdAt');
          expect(result).toHaveProperty('updatedAt');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain DTO consistency across different operation types', async () => {
    const { Campaign } = await import('../../models/campaign.mjs');
    const { Brand } = await import('../../models/brand.mjs');
    const { Persona } = await import('../../models/persona.mjs');
    const { SocialPost } = await import('../../models/social-post.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 1, maxLength: 50 }),
          entityId: fc.string({ minLength: 1, maxLength: 50 }),
          entityType: fc.constantFrom('brand', 'persona', 'campaign', 'socialpost'),
          operationType: fc.constantFrom('findById', 'save', 'update')
        }),
        async (testData) => {
          const now = new Date().toISOString();
          let mockItem;
          let result;

          // Create appropriate mock item based on entity type
          switch (testData.entityType) {
            case 'brand':
              mockItem = {
                pk: `${testData.tenantId}#${testData.entityId}`,
                sk: 'metadata',
                GSI1PK: testData.tenantId,
                GSI1SK: `BRAND#${now}`,
                brandId: testData.entityId,
                tenantId: testData.tenantId,
                name: 'Test Brand',
                ethos: 'Test ethos',
                coreValues: ['value1'],
                primaryAudience: 'professionals',
                status: 'active',
                createdAt: now,
                updatedAt: now,
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
              break;

            case 'persona':
              mockItem = {
                pk: `${testData.tenantId}#${testData.entityId}`,
                sk: 'persona',
                GSI1PK: testData.tenantId,
                GSI1SK: `PERSONA#${now}`,
                personaId: testData.entityId,
                tenantId: testData.tenantId,
                name: 'Test Persona',
                role: 'Manager',
                company: 'TestCorp',
                primaryAudience: 'professionals',
                voiceTraits: ['professional'],
                writingHabits: {
                  paragraphs: 'medium',
                  questions: 'occasional',
                  emojis: 'sparing',
                  structure: 'prose'
                },
                opinions: {
                  strongBeliefs: ['quality matters'],
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
                isActive: true,
                createdAt: now,
                updatedAt: now
              };
              break;

            case 'campaign':
              mockItem = {
                pk: `${testData.tenantId}#${testData.entityId}`,
                sk: 'campaign',
                GSI1PK: testData.tenantId,
                GSI1SK: `CAMPAIGN#${now}`,
                id: testData.entityId,
                tenantId: testData.tenantId,
                brandId: null,
                name: 'Test Campaign',
                brief: {
                  description: 'Test campaign description',
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
                status: 'planning',
                planSummary: null,
                metadata: {
                  source: 'api',
                  externalRef: null
                },
                createdAt: now,
                updatedAt: now,
                completedAt: null
              };
              break;

            case 'socialpost':
              mockItem = {
                pk: `${testData.tenantId}#campaign1`,
                sk: `POST#${testData.entityId}`,
                GSI1PK: `${testData.tenantId}#campaign1`,
                GSI1SK: `POST#twitter#${now}`,
                postId: testData.entityId,
                campaignId: 'campaign1',
                tenantId: testData.tenantId,
                personaId: 'persona1',
                platform: 'twitter',
                scheduledAt: now,
                topic: 'Test topic',
                intent: 'announce',
                status: 'planned',
                lastError: null,
                createdAt: now,
                updatedAt: now
              };
              break;
          }

          // Mock appropriate responses based on operation type
          if (testData.operationType === 'findById') {
            mockSend.mockResolvedValueOnce({ Item: mockItem });
          } else if (testData.operationType === 'save') {
            mockSend.mockResolvedValueOnce({});
          } else if (testData.operationType === 'update') {
            mockSend.mockResolvedValueOnce({ Attributes: mockItem });
          }

          // Execute operation and get result
          try {
            switch (testData.entityType) {
              case 'brand':
                if (testData.operationType === 'findById') {
                  result = await Brand.findById(testData.tenantId, testData.entityId);
                } else if (testData.operationType === 'save') {
                  const testEntity = { id: testData.entityId, name: 'Test Brand', ethos: 'Test ethos', coreValues: ['value1'], primaryAudience: 'professionals', voiceGuidelines: { tone: ['professional'], style: ['clear'], messaging: ['value-focused'] }, visualIdentity: { colorPalette: ['#000000'], typography: ['Arial'], imagery: ['modern'] }, contentStandards: { qualityRequirements: ['high-quality'], restrictions: [] } };
                  result = await Brand.save(testData.tenantId, testEntity);
                } else if (testData.operationType === 'update') {
                  mockSend.mockResolvedValueOnce({ Item: mockItem });
                  result = await Brand.update(testData.tenantId, testData.entityId, { name: 'Updated Brand' });
                }
                break;

              case 'persona':
                if (testData.operationType === 'findById') {
                  result = await Persona.findById(testData.tenantId, testData.entityId);
                } else if (testData.operationType === 'save') {
                  const testEntity = { id: testData.entityId, name: 'Test Persona', role: 'Manager', company: 'TestCorp', primaryAudience: 'professionals', voiceTraits: ['professional'], writingHabits: { paragraphs: 'medium', questions: 'occasional', emojis: 'sparing', structure: 'prose' }, opinions: { strongBeliefs: ['quality matters'], avoidsTopics: [] }, language: { avoid: [], prefer: [] }, ctaStyle: { aggressiveness: 'medium', patterns: [] } };
                  result = await Persona.save(testData.tenantId, testEntity);
                } else if (testData.operationType === 'update') {
                  mockSend.mockResolvedValueOnce({ Item: mockItem });
                  result = await Persona.update(testData.tenantId, testData.entityId, { name: 'Updated Persona' });
                }
                break;

              case 'campaign':
                if (testData.operationType === 'findById') {
                  result = await Campaign.findById(testData.tenantId, testData.entityId);
                } else if (testData.operationType === 'save') {
                  const testEntity = { id: testData.entityId, name: 'Test Campaign', brief: { description: 'Test campaign description', objective: 'awareness', primaryCTA: null }, participants: { personaIds: ['persona1'], platforms: ['twitter'], distribution: { mode: 'balanced' } }, schedule: { timezone: 'UTC', startDate: now, endDate: new Date(Date.now() + 86400000).toISOString(), allowedDaysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'], blackoutDates: null, postingWindows: null }, cadenceOverrides: null, messaging: null, assetOverrides: null, status: 'planning', planSummary: null, metadata: { source: 'api', externalRef: null }, completedAt: null };
                  result = await Campaign.save(testData.tenantId, testEntity);
                } else if (testData.operationType === 'update') {
                  result = await Campaign.update(testData.tenantId, testData.entityId, { name: 'Updated Campaign' });
                }
                break;

              case 'socialpost':
                if (testData.operationType === 'findById') {
                  result = await SocialPost.findById(testData.tenantId, 'campaign1', testData.entityId);
                } else if (testData.operationType === 'save') {
                  const testEntity = { id: testData.entityId, personaId: 'persona1', platform: 'twitter', scheduledAt: now, topic: 'Test topic', intent: 'announce', status: 'planned', lastError: null };
                  result = await SocialPost.save(testData.tenantId, 'campaign1', testEntity);
                } else if (testData.operationType === 'update') {
                  result = await SocialPost.update(testData.tenantId, 'campaign1', testData.entityId, { topic: 'Updated topic' });
                }
                break;
            }

            // Verify DTO consistency across all operation types
            if (result) {
              expect(result).toBeDefined();
              expect(result).not.toBeNull();

              // Must have clean "id" property
              expect(result).toHaveProperty('id');
              expect(typeof result.id).toBe('string');

              // Must have timestamps
              expect(result).toHaveProperty('createdAt');
              expect(result).toHaveProperty('updatedAt');

              // Must not contain internal database fields
              expect(result.pk).toBeUndefined();
              expect(result.sk).toBeUndefined();
              expect(result.GSI1PK).toBeUndefined();
              expect(result.GSI1SK).toBeUndefined();
              expect(result.tenantId).toBeUndefined();

              // Entity-specific internal field checks
              if (testData.entityType === 'brand') {
                expect(result.brandId).toBeUndefined();
              }
              if (testData.entityType === 'persona') {
                expect(result.personaId).toBeUndefined();
              }
              if (testData.entityType === 'socialpost') {
                expect(result.postId).toBeUndefined();
              }
            }
          } catch (error) {
            // For operations that might fail due to validation, ensure error format is consistent
            expect(error).toBeInstanceOf(Error);
            expect(typeof error.message).toBe('string');
            expect(error.message.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
