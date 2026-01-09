import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';

const mockSend = vi.fn();

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({ send: mockSend })),
  GetItemCommand: vi.fn(),
  PutItemCommand: vi.fn(),
  UpdateItemCommand: vi.fn(),
  QueryCommand: vi.fn()
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: vi.fn((obj) => obj),
  unmarshall: vi.fn((obj) => obj)
}));

/**
 * **Feature: campaign-asset-management, Property 4: Campaign asset integration**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 */
describe('Campaign Asset Integration Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TABLE_NAME = 'test-table';
  });

  const SUPPORTED_CONTENT_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/mov', 'video/avi'
  ];

  // Generators for property-based testing
  const tenantIdArb = fc.string({ minLength: 5, maxLength: 50 });
  const assetIdArb = fc.string({ minLength: 10, maxLength: 30 }).map(s => `asset_${s}`);
  const validDescriptionArb = fc.string({ minLength: 10, maxLength: 500 });
  const httpsUrlArb = fc.webUrl({ validSchemes: ['https'] });
  const contentTypeArb = fc.constantFrom(...SUPPORTED_CONTENT_TYPES);

  const internalAssetArb = fc.record({
    assetId: assetIdArb,
    type: fc.constant('internal'),
    addedAt: fc.date().map(d => d.toISOString())
  });

  const externalAssetArb = fc.record({
    type: fc.constant('external'),
    url: httpsUrlArb,
    description: validDescriptionArb,
    contentType: contentTypeArb,
    addedAt: fc.date().map(d => d.toISOString())
  });

  const campaignAssetArb = fc.oneof(internalAssetArb, externalAssetArb);

  it('should accept campaigns with optional assets array containing internal asset references', async () => {
    const { Campaign } = await import('../../models/campaign.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      fc.array(internalAssetArb, { minLength: 1, maxLength: 5 }),
      async (tenantId, assets) => {
        // Mock Asset.findById to return valid completed assets
        vi.spyOn(Asset, 'findById').mockImplementation(async (tid, aid) => {
          if (tid === tenantId && assets.some(a => a.assetId === aid)) {
            return {
              id: aid,
              uploadStatus: 'completed',
              contentType: 'image/jpeg',
              description: 'Test asset'
            };
          }
          return null;
        });

        const validation = await Campaign.validateAssets(tenantId, assets);
        expect(validation.valid).toBe(true);
        expect(validation.validatedAssets).toHaveLength(assets.length);

        // Verify each asset has addedAt timestamp
        validation.validatedAssets.forEach(asset => {
          expect(asset.addedAt).toBeDefined();
          expect(typeof asset.addedAt).toBe('string');
        });
      }
    ), { numRuns: 100 });
  });

  it('should accept campaigns with ad-hoc external asset definitions', async () => {
    const { Campaign } = await import('../../models/campaign.mjs');

    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      fc.array(externalAssetArb, { minLength: 1, maxLength: 5 }),
      async (tenantId, assets) => {
        const validation = await Campaign.validateAssets(tenantId, assets);
        expect(validation.valid).toBe(true);
        expect(validation.validatedAssets).toHaveLength(assets.length);

        // Verify external assets maintain their properties
        validation.validatedAssets.forEach((asset, index) => {
          expect(asset.type).toBe('external');
          expect(asset.url).toBe(assets[index].url);
          expect(asset.url.startsWith('https://')).toBe(true);
          expect(asset.description).toBe(assets[index].description);
          expect(asset.contentType).toBe(assets[index].contentType);
          expect(asset.addedAt).toBeDefined();
        });
      }
    ), { numRuns: 100 });
  });

  it('should validate internal asset references exist and belong to requesting tenant', async () => {
    const { Campaign } = await import('../../models/campaign.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      fc.array(internalAssetArb, { minLength: 1, maxLength: 3 }),
      async (tenantId, assets) => {
        // Mock Asset.findById to return null (asset not found)
        vi.spyOn(Asset, 'findById').mockResolvedValue(null);

        await expect(Campaign.validateAssets(tenantId, assets)).rejects.toThrow();

        // Verify Asset.findById was called for each asset
        expect(Asset.findById).toHaveBeenCalledTimes(assets.length);
        assets.forEach(asset => {
          expect(Asset.findById).toHaveBeenCalledWith(tenantId, asset.assetId);
        });
      }
    ), { numRuns: 100 });
  });

  it('should validate external asset URLs use HTTPS protocol', async () => {
    const { Campaign } = await import('../../models/campaign.mjs');
    const httpUrlArb = fc.webUrl({ validSchemes: ['http'] });

    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      fc.array(fc.record({
        type: fc.constant('external'),
        url: httpUrlArb,
        description: validDescriptionArb,
        contentType: contentTypeArb,
        addedAt: fc.date().map(d => d.toISOString())
      }), { minLength: 1, maxLength: 3 }),
      async (tenantId, assets) => {
        await expect(Campaign.validateAssets(tenantId, assets)).rejects.toThrow(/HTTPS protocol/);
      }
    ), { numRuns: 100 });
  });

  it('should maintain asset associations without metadata duplication', async () => {
    const { Campaign } = await import('../../models/campaign.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      fc.array(campaignAssetArb, { minLength: 1, maxLength: 5 }),
      async (tenantId, assets) => {
        // Mock Asset.findById for internal assets
        vi.spyOn(Asset, 'findById').mockImplementation(async (tid, aid) => {
          if (tid === tenantId) {
            return {
              id: aid,
              uploadStatus: 'completed',
              contentType: 'image/jpeg',
              description: 'Test asset'
            };
          }
          return null;
        });

        const validation = await Campaign.validateAssets(tenantId, assets);
        expect(validation.valid).toBe(true);

        // Verify no metadata duplication - assets should only contain references/definitions
        validation.validatedAssets.forEach(asset => {
          if (asset.type === 'internal') {
            // Internal assets should only have reference data
            expect(asset).toHaveProperty('assetId');
            expect(asset).toHaveProperty('type');
            expect(asset).toHaveProperty('addedAt');
            expect(asset).not.toHaveProperty('uploadStatus');
            expect(asset).not.toHaveProperty('fileSize');
            expect(asset).not.toHaveProperty('objectKey');
          } else {
            // External assets should have inline definitions
            expect(asset).toHaveProperty('url');
            expect(asset).toHaveProperty('description');
            expect(asset).toHaveProperty('contentType');
            expect(asset).toHaveProperty('addedAt');
            expect(asset).not.toHaveProperty('assetId');
          }
        });
      }
    ), { numRuns: 100 });
  });

  it('should reject campaigns with assets referencing incomplete uploads', async () => {
    const { Campaign } = await import('../../models/campaign.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      fc.array(internalAssetArb, { minLength: 1, maxLength: 3 }),
      async (tenantId, assets) => {
        // Mock Asset.findById to return assets with pending upload status
        vi.spyOn(Asset, 'findById').mockImplementation(async (tid, aid) => {
          if (tid === tenantId && assets.some(a => a.assetId === aid)) {
            return {
              id: aid,
              uploadStatus: 'pending', // Not completed
              contentType: 'image/jpeg',
              description: 'Test asset'
            };
          }
          return null;
        });

        await expect(Campaign.validateAssets(tenantId, assets)).rejects.toThrow(/upload not completed/);
      }
    ), { numRuns: 100 });
  });

  it('should handle mixed internal and external assets correctly', async () => {
    const { Campaign } = await import('../../models/campaign.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      fc.array(internalAssetArb, { minLength: 1, maxLength: 2 }),
      fc.array(externalAssetArb, { minLength: 1, maxLength: 2 }),
      async (tenantId, internalAssets, externalAssets) => {
        const mixedAssets = [...internalAssets, ...externalAssets];

        // Mock Asset.findById for internal assets
        vi.spyOn(Asset, 'findById').mockImplementation(async (tid, aid) => {
          if (tid === tenantId && internalAssets.some(a => a.assetId === aid)) {
            return {
              id: aid,
              uploadStatus: 'completed',
              contentType: 'image/jpeg',
              description: 'Test asset'
            };
          }
          return null;
        });

        const validation = await Campaign.validateAssets(tenantId, mixedAssets);
        expect(validation.valid).toBe(true);
        expect(validation.validatedAssets).toHaveLength(mixedAssets.length);

        // Verify both types are handled correctly
        const validatedInternal = validation.validatedAssets.filter(a => a.type === 'internal');
        const validatedExternal = validation.validatedAssets.filter(a => a.type === 'external');

        expect(validatedInternal).toHaveLength(internalAssets.length);
        expect(validatedExternal).toHaveLength(externalAssets.length);
      }
    ), { numRuns: 100 });
  });

  it('should handle empty or null assets arrays gracefully', async () => {
    const { Campaign } = await import('../../models/campaign.mjs');

    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      fc.oneof(fc.constant(null), fc.constant([]), fc.constant(undefined)),
      async (tenantId, assets) => {
        const validation = await Campaign.validateAssets(tenantId, assets);
        expect(validation.valid).toBe(true);
        expect(validation.validatedAssets).toEqual([]);
      }
    ), { numRuns: 100 });
  });
});
