import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { handler as createBrandHandler } from '../../functions/brand/create-brand.mjs';

vi.mock('ulid', () => ({
  ulid: vi.fn(() => 'test-brand-id-123')
}));

const ddbMock = mockClient(DynamoDBClient);

describe('Brand CRUD Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ddbMock.reset();
    process.env.TABLE_NAME = 'TestTable';
  });

  describe('Create Brand - Minimal Configuration', () => {
    it('should create brand with minimal fields for executives audience', async () => {
      const minimalBrandData = {
        name: 'TechCorp',
        ethos: 'Innovation through technology leadership',
        coreValues: ['Excellence', 'Innovation', 'Integrity'],
        primaryAudience: 'executives'
      };

      ddbMock.on(PutItemCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        },
        body: JSON.stringify(minimalBrandData)
      };

      const response = await createBrandHandler(event);
      expect(response.statusCode).toBe(201);

      const putCall = ddbMock.commandCalls(PutItemCommand)[0];
      const savedItem = putCall.args[0].input.Item;

      expect(savedItem.voiceGuidelines).toBeDefined();
      expect(savedItem.contentStandards).toBeDefined();
      expect(savedItem.visualIdentity).toBeDefined();
      expect(savedItem.platformGuidelines).toBeDefined();
      expect(savedItem.claimsPolicy).toBeDefined();
      expect(savedItem.approvalPolicy).toBeDefined();
    });

    it('should create brand with minimal fields for professionals audience', async () => {
      const minimalBrandData = {
        name: 'ConsultCo',
        ethos: 'Empowering professionals through expertise',
        coreValues: ['Collaboration', 'Growth', 'Excellence'],
        primaryAudience: 'professionals'
      };

      ddbMock.on(PutItemCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        },
        body: JSON.stringify(minimalBrandData)
      };

      const response = await createBrandHandler(event);
      expect(response.statusCode).toBe(201);

      const putCall = ddbMock.commandCalls(PutItemCommand)[0];
      const savedItem = putCall.args[0].input.Item;

      expect(savedItem.voiceGuidelines.M.tone.L).toHaveLength(3);
      expect(savedItem.voiceGuidelines.M.tone.L[0].S).toBe('approachable');
      expect(savedItem.approvalPolicy.M.threshold.N).toBe('0.7');
      expect(savedItem.approvalPolicy.M.mode.S).toBe('auto_approve');
    });

    it('should create brand with minimal fields for consumers audience', async () => {
      const minimalBrandData = {
        name: 'ShopBrand',
        ethos: 'Making shopping delightful',
        coreValues: ['Value', 'Experience', 'Community'],
        primaryAudience: 'consumers'
      };

      ddbMock.on(PutItemCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        },
        body: JSON.stringify(minimalBrandData)
      };

      const response = await createBrandHandler(event);
      expect(response.statusCode).toBe(201);

      const putCall = ddbMock.commandCalls(PutItemCommand)[0];
      const savedItem = putCall.args[0].input.Item;

      expect(savedItem.voiceGuidelines.M.tone.L[0].S).toBe('friendly');
      expect(savedItem.visualIdentity.M.colorPalette.L[0].S).toBe('#EC4899');
      expect(savedItem.approvalPolicy.M.threshold.N).toBe('0.6');
    });

    it('should create brand with minimal fields for technical audience', async () => {
      const minimalBrandData = {
        name: 'DevTools',
        ethos: 'Building tools for developers',
        coreValues: ['Technical Excellence', 'Reliability', 'Innovation'],
        primaryAudience: 'technical'
      };

      ddbMock.on(PutItemCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        },
        body: JSON.stringify(minimalBrandData)
      };

      const response = await createBrandHandler(event);
      expect(response.statusCode).toBe(201);

      const putCall = ddbMock.commandCalls(PutItemCommand)[0];
      const savedItem = putCall.args[0].input.Item;

      expect(savedItem.voiceGuidelines.M.tone.L[0].S).toBe('precise');
      expect(savedItem.contentStandards.M.qualityRequirements.L[0].S).toBe('technically accurate');
      expect(savedItem.visualIdentity.M.typography.L[0].S).toBe('monospace');
    });

    it('should create brand with minimal fields for creative audience', async () => {
      const minimalBrandData = {
        name: 'ArtStudio',
        ethos: 'Inspiring creativity in everyone',
        coreValues: ['Creativity', 'Innovation', 'Expression'],
        primaryAudience: 'creative'
      };

      ddbMock.on(PutItemCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        },
        body: JSON.stringify(minimalBrandData)
      };

      const response = await createBrandHandler(event);
      expect(response.statusCode).toBe(201);

      const putCall = ddbMock.commandCalls(PutItemCommand)[0];
      const savedItem = putCall.args[0].input.Item;

      expect(savedItem.voiceGuidelines.M.tone.L[0].S).toBe('inspiring');
      expect(savedItem.voiceGuidelines.M.style.L[0].S).toBe('creative');
      expect(savedItem.visualIdentity.M.colorPalette.L[0].S).toBe('#8B5CF6');
    });
  });

  describe('Create Brand - Full Configuration', () => {
    it('should create brand with all fields provided', async () => {
      const fullBrandData = {
        name: 'FullBrand',
        ethos: 'Complete brand configuration',
        coreValues: ['Value1', 'Value2'],
        primaryAudience: 'professionals',
        voiceGuidelines: {
          tone: ['custom-tone'],
          style: ['custom-style'],
          messaging: ['custom-messaging']
        },
        contentStandards: {
          qualityRequirements: ['custom-quality'],
          restrictions: ['custom-restriction']
        },
        visualIdentity: {
          colorPalette: ['#FF0000'],
          typography: ['custom-font'],
          imagery: ['custom-imagery']
        },
        platformGuidelines: {
          enabled: ['twitter'],
          defaults: {
            twitter: {
              defaultAsset: 'image',
              linkPolicy: 'discouraged',
              emojiPolicy: 'allowed',
              hashtagPolicy: 'allowed',
              typicalCadencePerWeek: 10
            },
            linkedin: {
              defaultAsset: 'none',
              linkPolicy: 'allowed',
              emojiPolicy: 'none',
              hashtagPolicy: 'none',
              typicalCadencePerWeek: 0
            },
            instagram: {
              defaultAsset: 'none',
              linkPolicy: 'discouraged',
              emojiPolicy: 'none',
              hashtagPolicy: 'none',
              typicalCadencePerWeek: 0
            },
            facebook: {
              defaultAsset: 'none',
              linkPolicy: 'allowed',
              emojiPolicy: 'none',
              hashtagPolicy: 'none',
              typicalCadencePerWeek: 0
            }
          }
        },
        claimsPolicy: {
          noGuarantees: false,
          noPerformanceNumbersUnlessProvided: false,
          requireSourceForStats: false,
          competitorMentionPolicy: 'allowed'
        },
        approvalPolicy: {
          threshold: 0.9,
          mode: 'always_review'
        }
      };

      ddbMock.on(PutItemCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        },
        body: JSON.stringify(fullBrandData)
      };

      const response = await createBrandHandler(event);
      expect(response.statusCode).toBe(201);

      const putCall = ddbMock.commandCalls(PutItemCommand)[0];
      const savedItem = putCall.args[0].input.Item;

      expect(savedItem.voiceGuidelines.M.tone.L[0].S).toBe('custom-tone');
      expect(savedItem.contentStandards.M.qualityRequirements.L[0].S).toBe('custom-quality');
      expect(savedItem.visualIdentity.M.colorPalette.L[0].S).toBe('#FF0000');
      expect(savedItem.platformGuidelines.M.defaults.M.twitter.M.typicalCadencePerWeek.N).toBe('10');
      expect(savedItem.claimsPolicy.M.noGuarantees.BOOL).toBe(false);
      expect(savedItem.approvalPolicy.M.threshold.N).toBe('0.9');
      expect(savedItem.approvalPolicy.M.mode.S).toBe('always_review');
    });

    it('should not apply defaults when all fields are provided', async () => {
      const fullBrandData = {
        name: 'CustomBrand',
        ethos: 'Fully customized brand',
        coreValues: ['Custom1', 'Custom2', 'Custom3'],
        primaryAudience: 'executives',
        voiceGuidelines: {
          tone: ['unique-tone-1', 'unique-tone-2'],
          style: ['unique-style'],
          messaging: ['unique-message']
        },
        contentStandards: {
          qualityRequirements: ['unique-quality'],
          restrictions: []
        },
        visualIdentity: {
          colorPalette: ['#123456', '#789ABC'],
          typography: ['unique-font'],
          imagery: ['unique-image']
        },
        platformGuidelines: {
          enabled: ['linkedin'],
          defaults: {
            twitter: {
              defaultAsset: 'none',
              linkPolicy: 'allowed',
              emojiPolicy: 'none',
              hashtagPolicy: 'none',
              typicalCadencePerWeek: 0
            },
            linkedin: {
              defaultAsset: 'video',
              linkPolicy: 'allowed',
              emojiPolicy: 'allowed',
              hashtagPolicy: 'allowed',
              typicalCadencePerWeek: 7
            },
            instagram: {
              defaultAsset: 'none',
              linkPolicy: 'discouraged',
              emojiPolicy: 'none',
              hashtagPolicy: 'none',
              typicalCadencePerWeek: 0
            },
            facebook: {
              defaultAsset: 'none',
              linkPolicy: 'allowed',
              emojiPolicy: 'none',
              hashtagPolicy: 'none',
              typicalCadencePerWeek: 0
            }
          }
        },
        claimsPolicy: {
          noGuarantees: false,
          noPerformanceNumbersUnlessProvided: false,
          requireSourceForStats: false,
          competitorMentionPolicy: 'allowed'
        },
        approvalPolicy: {
          threshold: 0.95,
          mode: 'always_review'
        }
      };

      ddbMock.on(PutItemCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        },
        body: JSON.stringify(fullBrandData)
      };

      const response = await createBrandHandler(event);
      expect(response.statusCode).toBe(201);

      const putCall = ddbMock.commandCalls(PutItemCommand)[0];
      const savedItem = putCall.args[0].input.Item;

      expect(savedItem.voiceGuidelines.M.tone.L).toHaveLength(2);
      expect(savedItem.voiceGuidelines.M.tone.L[0].S).toBe('unique-tone-1');
      expect(savedItem.platformGuidelines.M.defaults.M.linkedin.M.defaultAsset.S).toBe('video');
      expect(savedItem.platformGuidelines.M.defaults.M.linkedin.M.typicalCadencePerWeek.N).toBe('7');
    });
  });

  describe('Create Brand - Partial Override of Defaults', () => {
    it('should override voiceGuidelines while using other defaults', async () => {
      const partialBrandData = {
        name: 'PartialBrand1',
        ethos: 'Partially customized brand',
        coreValues: ['Value1', 'Value2'],
        primaryAudience: 'professionals',
        voiceGuidelines: {
          tone: ['custom-tone-1', 'custom-tone-2'],
          style: ['custom-style'],
          messaging: ['custom-message']
        }
      };

      ddbMock.on(PutItemCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        },
        body: JSON.stringify(partialBrandData)
      };

      const response = await createBrandHandler(event);
      expect(response.statusCode).toBe(201);

      const putCall = ddbMock.commandCalls(PutItemCommand)[0];
      const savedItem = putCall.args[0].input.Item;

      expect(savedItem.voiceGuidelines.M.tone.L[0].S).toBe('custom-tone-1');
      expect(savedItem.contentStandards.M.qualityRequirements.L[0].S).toBe('accurate');
      expect(savedItem.visualIdentity.M.colorPalette.L[0].S).toBe('#2563EB');
      expect(savedItem.approvalPolicy.M.threshold.N).toBe('0.7');
    });

    it('should override contentStandards while using other defaults', async () => {
      const partialBrandData = {
        name: 'PartialBrand2',
        ethos: 'Custom content standards',
        coreValues: ['Quality', 'Trust'],
        primaryAudience: 'executives',
        contentStandards: {
          qualityRequirements: ['ultra-high-quality', 'peer-reviewed'],
          restrictions: ['no speculation', 'verified sources only']
        }
      };

      ddbMock.on(PutItemCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        },
        body: JSON.stringify(partialBrandData)
      };

      const response = await createBrandHandler(event);
      expect(response.statusCode).toBe(201);

      const putCall = ddbMock.commandCalls(PutItemCommand)[0];
      const savedItem = putCall.args[0].input.Item;

      expect(savedItem.contentStandards.M.qualityRequirements.L[0].S).toBe('ultra-high-quality');
      expect(savedItem.contentStandards.M.restrictions.L).toHaveLength(2);
      expect(savedItem.voiceGuidelines.M.tone.L[0].S).toBe('professional');
      expect(savedItem.visualIdentity.M.colorPalette.L[0].S).toBe('#1E3A8A');
    });

    it('should override visualIdentity while using other defaults', async () => {
      const partialBrandData = {
        name: 'PartialBrand3',
        ethos: 'Custom visual identity',
        coreValues: ['Design', 'Aesthetics'],
        primaryAudience: 'creative',
        visualIdentity: {
          colorPalette: ['#FF5733', '#33FF57', '#3357FF'],
          typography: ['custom-serif', 'custom-sans'],
          imagery: ['abstract', 'minimalist']
        }
      };

      ddbMock.on(PutItemCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        },
        body: JSON.stringify(partialBrandData)
      };

      const response = await createBrandHandler(event);
      expect(response.statusCode).toBe(201);

      const putCall = ddbMock.commandCalls(PutItemCommand)[0];
      const savedItem = putCall.args[0].input.Item;

      expect(savedItem.visualIdentity.M.colorPalette.L).toHaveLength(3);
      expect(savedItem.visualIdentity.M.colorPalette.L[0].S).toBe('#FF5733');
      expect(savedItem.visualIdentity.M.typography.L[0].S).toBe('custom-serif');
      expect(savedItem.voiceGuidelines.M.tone.L[0].S).toBe('inspiring');
      expect(savedItem.contentStandards.M.qualityRequirements.L[0].S).toBe('creative');
    });

    it('should override approvalPolicy while using other defaults', async () => {
      const partialBrandData = {
        name: 'PartialBrand4',
        ethos: 'Custom approval policy',
        coreValues: ['Control', 'Quality'],
        primaryAudience: 'consumers',
        approvalPolicy: {
          threshold: 0.95,
          mode: 'always_review'
        }
      };

      ddbMock.on(PutItemCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        },
        body: JSON.stringify(partialBrandData)
      };

      const response = await createBrandHandler(event);
      expect(response.statusCode).toBe(201);

      const putCall = ddbMock.commandCalls(PutItemCommand)[0];
      const savedItem = putCall.args[0].input.Item;

      expect(savedItem.approvalPolicy.M.threshold.N).toBe('0.95');
      expect(savedItem.approvalPolicy.M.mode.S).toBe('always_review');
      expect(savedItem.voiceGuidelines.M.tone.L[0].S).toBe('friendly');
      expect(savedItem.claimsPolicy.M.requireSourceForStats.BOOL).toBe(false);
    });

    it('should override multiple fields while using remaining defaults', async () => {
      const partialBrandData = {
        name: 'PartialBrand5',
        ethos: 'Multiple custom fields',
        coreValues: ['Innovation', 'Speed'],
        primaryAudience: 'technical',
        voiceGuidelines: {
          tone: ['pragmatic', 'efficient'],
          style: ['concise'],
          messaging: ['performance', 'scalability']
        },
        claimsPolicy: {
          noGuarantees: false,
          noPerformanceNumbersUnlessProvided: false,
          requireSourceForStats: false,
          competitorMentionPolicy: 'allowed'
        }
      };

      ddbMock.on(PutItemCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        },
        body: JSON.stringify(partialBrandData)
      };

      const response = await createBrandHandler(event);
      expect(response.statusCode).toBe(201);

      const putCall = ddbMock.commandCalls(PutItemCommand)[0];
      const savedItem = putCall.args[0].input.Item;

      expect(savedItem.voiceGuidelines.M.tone.L[0].S).toBe('pragmatic');
      expect(savedItem.claimsPolicy.M.noGuarantees.BOOL).toBe(false);
      expect(savedItem.contentStandards.M.qualityRequirements.L[0].S).toBe('technically accurate');
      expect(savedItem.visualIdentity.M.typography.L[0].S).toBe('monospace');
      expect(savedItem.approvalPolicy.M.threshold.N).toBe('0.8');
    });
  });

  describe('Create Brand - Asset Metadata Auto-population', () => {
    it('should auto-populate addedAt for internal assets when not provided', async () => {
      const brandWithAssets = {
        name: 'AssetBrand1',
        ethos: 'Brand with internal assets',
        coreValues: ['Visual', 'Quality'],
        primaryAudience: 'professionals',
        assets: [
          {
            type: 'internal',
            assetId: 'asset-123'
          }
        ]
      };

      ddbMock.on(GetItemCommand).resolves({
        Item: {
          pk: { S: 'test-tenant#asset-123' },
          sk: { S: 'metadata' },
          assetId: { S: 'asset-123' },
          tenantId: { S: 'test-tenant' }
        }
      });
      ddbMock.on(PutItemCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user-123'
          }
        },
        body: JSON.stringify(brandWithAssets)
      };

      const response = await createBrandHandler(event);
      expect(response.statusCode).toBe(201);

      const putCall = ddbMock.commandCalls(PutItemCommand)[0];
      const savedItem = putCall.args[0].input.Item;

      expect(savedItem.assets.L[0].M.addedAt.S).toBeDefined();
      expect(savedItem.assets.L[0].M.addedAt.S).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should auto-populate addedBy for internal assets when not provided', async () => {
      const brandWithAssets = {
        name: 'AssetBrand2',
        ethos: 'Brand with internal assets',
        coreValues: ['Visual', 'Quality'],
        primaryAudience: 'professionals',
        assets: [
          {
            type: 'internal',
            assetId: 'asset-456'
          }
        ]
      };

      ddbMock.on(GetItemCommand).resolves({
        Item: {
          pk: { S: 'test-tenant#asset-456' },
          sk: { S: 'metadata' },
          assetId: { S: 'asset-456' },
          tenantId: { S: 'test-tenant' }
        }
      });
      ddbMock.on(PutItemCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user-456'
          }
        },
        body: JSON.stringify(brandWithAssets)
      };

      const response = await createBrandHandler(event);
      expect(response.statusCode).toBe(201);

      const putCall = ddbMock.commandCalls(PutItemCommand)[0];
      const savedItem = putCall.args[0].input.Item;

      expect(savedItem.assets.L[0].M.addedBy.S).toBe('test-user-456');
    });

    it('should preserve provided addedAt value for internal assets', async () => {
      const customDate = '2023-01-15T10:30:00Z';
      const brandWithAssets = {
        name: 'AssetBrand3',
        ethos: 'Brand with custom asset metadata',
        coreValues: ['Precision', 'Control'],
        primaryAudience: 'executives',
        assets: [
          {
            type: 'internal',
            assetId: 'asset-789',
            addedAt: customDate
          }
        ]
      };

      ddbMock.on(GetItemCommand).resolves({
        Item: {
          pk: { S: 'test-tenant#asset-789' },
          sk: { S: 'metadata' },
          assetId: { S: 'asset-789' },
          tenantId: { S: 'test-tenant' }
        }
      });
      ddbMock.on(PutItemCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        },
        body: JSON.stringify(brandWithAssets)
      };

      const response = await createBrandHandler(event);
      expect(response.statusCode).toBe(201);

      const putCall = ddbMock.commandCalls(PutItemCommand)[0];
      const savedItem = putCall.args[0].input.Item;

      expect(savedItem.assets.L[0].M.addedAt.S).toBe(customDate);
    });

    it('should preserve provided addedBy value for internal assets', async () => {
      const customUser = 'custom-user-id';
      const brandWithAssets = {
        name: 'AssetBrand4',
        ethos: 'Brand with custom user metadata',
        coreValues: ['Tracking', 'Accountability'],
        primaryAudience: 'technical',
        assets: [
          {
            type: 'internal',
            assetId: 'asset-101',
            addedBy: customUser
          }
        ]
      };

      ddbMock.on(GetItemCommand).resolves({
        Item: {
          pk: { S: 'test-tenant#asset-101' },
          sk: { S: 'metadata' },
          assetId: { S: 'asset-101' },
          tenantId: { S: 'test-tenant' }
        }
      });
      ddbMock.on(PutItemCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        },
        body: JSON.stringify(brandWithAssets)
      };

      const response = await createBrandHandler(event);
      expect(response.statusCode).toBe(201);

      const putCall = ddbMock.commandCalls(PutItemCommand)[0];
      const savedItem = putCall.args[0].input.Item;

      expect(savedItem.assets.L[0].M.addedBy.S).toBe(customUser);
    });

    it('should auto-populate metadata for external assets', async () => {
      const brandWithAssets = {
        name: 'AssetBrand5',
        ethos: 'Brand with external assets',
        coreValues: ['Flexibility', 'Integration'],
        primaryAudience: 'consumers',
        assets: [
          {
            type: 'external',
            url: 'https://example.com/image.jpg',
            description: 'External brand image',
            contentType: 'image/jpeg'
          }
        ]
      };

      ddbMock.on(PutItemCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'external-user'
          }
        },
        body: JSON.stringify(brandWithAssets)
      };

      const response = await createBrandHandler(event);
      expect(response.statusCode).toBe(201);

      const putCall = ddbMock.commandCalls(PutItemCommand)[0];
      const savedItem = putCall.args[0].input.Item;

      expect(savedItem.assets.L[0].M.addedAt.S).toBeDefined();
      expect(savedItem.assets.L[0].M.addedBy.S).toBe('external-user');
      expect(savedItem.assets.L[0].M.url.S).toBe('https://example.com/image.jpg');
    });

    it('should handle multiple assets with mixed metadata', async () => {
      const customDate = '2023-06-01T12:00:00Z';
      const brandWithAssets = {
        name: 'AssetBrand6',
        ethos: 'Brand with multiple assets',
        coreValues: ['Diversity', 'Richness'],
        primaryAudience: 'creative',
        assets: [
          {
            type: 'internal',
            assetId: 'asset-201'
          },
          {
            type: 'internal',
            assetId: 'asset-202',
            addedAt: customDate,
            addedBy: 'specific-user'
          },
          {
            type: 'external',
            url: 'https://example.com/video.mp4',
            description: 'Brand video',
            contentType: 'video/mp4'
          }
        ]
      };

      ddbMock.on(GetItemCommand).resolves({
        Item: {
          pk: { S: 'test-tenant#asset-201' },
          sk: { S: 'metadata' },
          assetId: { S: 'asset-201' },
          tenantId: { S: 'test-tenant' }
        }
      });
      ddbMock.on(PutItemCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'multi-asset-user'
          }
        },
        body: JSON.stringify(brandWithAssets)
      };

      const response = await createBrandHandler(event);
      expect(response.statusCode).toBe(201);

      const putCall = ddbMock.commandCalls(PutItemCommand)[0];
      const savedItem = putCall.args[0].input.Item;

      expect(savedItem.assets.L).toHaveLength(3);
      expect(savedItem.assets.L[0].M.addedAt.S).toBeDefined();
      expect(savedItem.assets.L[0].M.addedBy.S).toBe('multi-asset-user');
      expect(savedItem.assets.L[1].M.addedAt.S).toBe(customDate);
      expect(savedItem.assets.L[1].M.addedBy.S).toBe('specific-user');
      expect(savedItem.assets.L[2].M.addedAt.S).toBeDefined();
      expect(savedItem.assets.L[2].M.addedBy.S).toBe('multi-asset-user');
    });

    it('should use tenantId as fallback when userId is not available', async () => {
      const brandWithAssets = {
        name: 'AssetBrand7',
        ethos: 'Brand with fallback user',
        coreValues: ['Reliability', 'Fallback'],
        primaryAudience: 'professionals',
        assets: [
          {
            type: 'internal',
            assetId: 'asset-301'
          }
        ]
      };

      ddbMock.on(GetItemCommand).resolves({
        Item: {
          pk: { S: 'fallback-tenant#asset-301' },
          sk: { S: 'metadata' },
          assetId: { S: 'asset-301' },
          tenantId: { S: 'fallback-tenant' }
        }
      });
      ddbMock.on(PutItemCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: {
            tenantId: 'fallback-tenant'
          }
        },
        body: JSON.stringify(brandWithAssets)
      };

      const response = await createBrandHandler(event);
      expect(response.statusCode).toBe(201);

      const putCall = ddbMock.commandCalls(PutItemCommand)[0];
      const savedItem = putCall.args[0].input.Item;

      expect(savedItem.assets.L[0].M.addedBy.S).toBe('fallback-tenant');
    });
  });
});
