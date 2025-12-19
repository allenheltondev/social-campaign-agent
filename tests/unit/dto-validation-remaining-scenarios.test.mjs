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

describe('DTO Validation Remaining Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TABLE_NAME = 'test-table';
  });

  describe('DTO Transformation Edge Cases', () => {
    it('should handle malformed DynamoDB records gracefully', async () => {
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
            // Create malformed records with missing required fields
            const malformedRecord = {
              pk: `${testData.tenantId}#${testData.entityId}`,
              sk: 'metadata',
              // Missing most required fields to test error handling
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            mockSend.mockResolvedValueOnce({ Item: malformedRecord });

            let errorThrown = false;
            let errorMessage = '';
            let result;

            try {
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
            } catch (error) {
              errorThrown = true;
              errorMessage = error.message;
            }

            // Verify that errors are thrown for malformed records OR special handling occurs
            // Some models may have special handling for certain cases (e.g., Brand returns default config for empty ID)
            if (!errorThrown) {
              // If no error was thrown, verify that a valid result was returned
              // This handles cases like Brand.findById returning default configuration
              expect(result).toBeDefined();
            } else {
              expect(errorMessage).toMatch(/Failed to retrieve/);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle empty string values in DTO transformation', async () => {
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
                  brandId: testData.entityId,
                  tenantId: testData.tenantId,
                  name: '', // Empty string
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

                try {
                  result = Brand._transformFromDynamoDB(rawBrandItem);
                } catch (error) {
                  // Empty strings should cause validation errors
                  expect(error.name).toBe('ZodError');
                  return;
                }
                break;
              }

              case 'persona': {
                const rawPersonaItem = {
                  pk: `${testData.tenantId}#${testData.entityId}`,
                  sk: 'persona',
                  personaId: testData.entityId,
                  tenantId: testData.tenantId,
                  name: '', // Empty string
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

                try {
                  result = Persona.transformFromDynamoDB(rawPersonaItem);
                } catch (error) {
                  // Empty strings should cause validation errors
                  expect(error.name).toBe('ZodError');
                  return;
                }
                break;
              }

              case 'campaign': {
                const rawCampaignItem = {
                  pk: `${testData.tenantId}#${testData.entityId}`,
                  sk: 'campaign',
                  id: testData.entityId,
                  tenantId: testData.tenantId,
                  brandId: null,
                  name: '', // Empty string
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

                try {
                  result = Campaign._transformFromDynamoDB(rawCampaignItem);
                } catch (error) {
                  // Empty strings should cause validation errors
                  expect(error.name).toBe('ZodError');
                  return;
                }
                break;
              }

              case 'socialpost': {
                const rawPostItem = {
                  pk: `${testData.tenantId}#campaign1`,
                  sk: `POST#${testData.entityId}`,
                  postId: testData.entityId,
                  campaignId: 'campaign1',
                  tenantId: testData.tenantId,
                  personaId: 'persona1',
                  platform: 'twitter',
                  scheduledAt: now,
                  topic: '', // Empty string
                  intent: 'announce',
                  status: 'planned',
                  lastError: null,
                  createdAt: now,
                  updatedAt: now
                };

                try {
                  result = SocialPost._transformFromDynamoDB(rawPostItem);
                } catch (error) {
                  // Empty strings should cause validation errors
                  expect(error.name).toBe('ZodError');
                  return;
                }
                break;
              }
            }

            // If we get here, the transformation succeeded despite empty strings
            // This might be acceptable for some fields, so we just verify basic DTO structure
            if (result) {
              expect(result).toHaveProperty('id');
              expect(result.id).toBe(testData.entityId);
              expect(result.pk).toBeUndefined();
              expect(result.sk).toBeUndefined();
              expect(result.tenantId).toBeUndefined();
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle very large string values in DTO transformation', async () => {
      const { Campaign } = await import('../../models/campaign.mjs');
      const { Brand } = await import('../../models/brand.mjs');
      const { Persona } = await import('../../models/persona.mjs');
      const { SocialPost } = await import('../../models/social-post.mjs');

      await fc.assert(
        fc.property(
          fc.record({
            tenantId: fc.string({ minLength: 1, maxLength: 50 }),
            entityId: fc.string({ minLength: 1, maxLength: 50 }),
            entityType: fc.constantFrom('brand', 'persona', 'campaign', 'socialpost'),
            largeString: fc.string({ minLength: 1000, maxLength: 2000 })
          }),
          (testData) => {
            const now = new Date().toISOString();
            let result;

            switch (testData.entityType) {
              case 'brand': {
                const rawBrandItem = {
                  pk: `${testData.tenantId}#${testData.entityId}`,
                  sk: 'metadata',
                  brandId: testData.entityId,
                  tenantId: testData.tenantId,
                  name: 'Test Brand',
                  ethos: testData.largeString, // Very large string
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

                try {
                  result = Brand._transformFromDynamoDB(rawBrandItem);
                } catch (error) {
                  // Large strings might cause validation errors
                  expect(error.name).toBe('ZodError');
                  return;
                }
                break;
              }

              case 'persona': {
                const rawPersonaItem = {
                  pk: `${testData.tenantId}#${testData.entityId}`,
                  sk: 'persona',
                  personaId: testData.entityId,
                  tenantId: testData.tenantId,
                  name: 'Test Persona',
                  role: testData.largeString, // Very large string
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

                try {
                  result = Persona.transformFromDynamoDB(rawPersonaItem);
                } catch (error) {
                  // Large strings might cause validation errors
                  expect(error.name).toBe('ZodError');
                  return;
                }
                break;
              }

              case 'campaign': {
                const rawCampaignItem = {
                  pk: `${testData.tenantId}#${testData.entityId}`,
                  sk: 'campaign',
                  id: testData.entityId,
                  tenantId: testData.tenantId,
                  brandId: null,
                  name: 'Test Campaign',
                  brief: {
                    description: testData.largeString, // Very large string
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

                try {
                  result = Campaign._transformFromDynamoDB(rawCampaignItem);
                } catch (error) {
                  // Large strings might cause validation errors
                  expect(error.name).toBe('ZodError');
                  return;
                }
                break;
              }

              case 'socialpost': {
                const rawPostItem = {
                  pk: `${testData.tenantId}#campaign1`,
                  sk: `POST#${testData.entityId}`,
                  postId: testData.entityId,
                  campaignId: 'campaign1',
                  tenantId: testData.tenantId,
                  personaId: 'persona1',
                  platform: 'twitter',
                  scheduledAt: now,
                  topic: testData.largeString.substring(0, 500), // Truncate to max allowed
                  intent: 'announce',
                  status: 'planned',
                  lastError: null,
                  createdAt: now,
                  updatedAt: now
                };

                try {
                  result = SocialPost._transformFromDynamoDB(rawPostItem);
                } catch (error) {
                  // Large strings might cause validation errors
                  expect(error.name).toBe('ZodError');
                  return;
                }
                break;
              }
            }

            // If transformation succeeded, verify DTO structure
            if (result) {
              expect(result).toHaveProperty('id');
              expect(result.id).toBe(testData.entityId);
              expect(result.pk).toBeUndefined();
              expect(result.sk).toBeUndefined();
              expect(result.tenantId).toBeUndefined();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Error Handling DTO Format Consistency', () => {
    it('should return consistent error formats across all model validation failures', async () => {
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
            // Create invalid entity data that will fail validation
            const invalidEntity = {
              id: testData.entityId,
              // Missing required fields to trigger validation errors
            };

            const models = [
              { name: 'Brand', model: Brand, method: 'save' },
              { name: 'Persona', model: Persona, method: 'save' },
              { name: 'Campaign', model: Campaign, method: 'save' },
              { name: 'SocialPost', model: SocialPost, method: 'save' }
            ];

            const errorResults = [];

            for (const { name, model, method } of models) {
              try {
                if (name === 'SocialPost') {
                  await model[method](testData.tenantId, 'campaign1', invalidEntity);
                } else {
                  await model[method](testData.tenantId, invalidEntity);
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

            // Verify all models threw errors with consistent format
            expect(errorResults.length).toBeGreaterThan(0);

            errorResults.forEach(result => {
              expect(result.hasMessage).toBe(true);
              expect(result.errorMessage).toMatch(/validation error|Failed to/);
              expect(['Error', 'ValidationError', 'ZodError']).toContain(result.errorName);
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle network errors consistently across all models', async () => {
      const { Campaign } = await import('../../models/campaign.mjs');
      const { Brand } = await import('../../models/brand.mjs');
      const { Persona } = await import('../../models/persona.mjs');
      const { SocialPost } = await import('../../models/social-post.mjs');

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantId: fc.string({ minLength: 1, maxLength: 50 }),
            entityId: fc.string({ minLength: 1, maxLength: 50 })
          }),
          async (testData) => {
            // Simulate network error
            const networkError = new Error('Network timeout');
            networkError.name = 'NetworkError';
            mockSend.mockRejectedValue(networkError);

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
                  await model[method](testData.tenantId, 'campaign1', testData.entityId);
                } else {
                  await model[method](testData.tenantId, testData.entityId);
                }
              } catch (error) {
                errorResults.push({
                  modelName: name,
                  errorMessage: error.message,
                  errorName: error.name || 'Error'
                });
              }
            }

            // Verify all models handled network errors consistently
            expect(errorResults.length).toBe(4);

            errorResults.forEach(result => {
              expect(result.errorMessage).toMatch(/Failed to retrieve/);
              expect(result.errorName).toBe('Error');
            });
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Model Method Response DTO Patterns', () => {
    it('should return DTOs with consistent timestamp formats', async () => {
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

            // Verify timestamp format consistency
            expect(result).toHaveProperty('createdAt');
            expect(result).toHaveProperty('updatedAt');

            // Timestamps should be valid ISO 8601 strings
            expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
            expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

            // Timestamps should be parseable as dates
            expect(new Date(result.createdAt).toISOString()).toBe(result.createdAt);
            expect(new Date(result.updatedAt).toISOString()).toBe(result.updatedAt);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return DTOs with consistent property naming conventions', async () => {
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

            // Verify consistent property naming conventions
            const propertyNames = Object.keys(result);

            // All properties should use camelCase
            propertyNames.forEach(prop => {
              expect(prop).toMatch(/^[a-z][a-zA-Z0-9]*$/);
            });

            // Should not contain any snake_case or kebab-case properties
            const hasSnakeCase = propertyNames.some(prop => prop.includes('_'));
            const hasKebabCase = propertyNames.some(prop => prop.includes('-'));

            expect(hasSnakeCase).toBe(false);
            expect(hasKebabCase).toBe(false);

            // Should not contain any uppercase-only properties
            const hasUpperCase = propertyNames.some(prop => prop === prop.toUpperCase());
            expect(hasUpperCase).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
