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

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({})),
  GetObjectCommand: vi.fn()
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(() => Promise.resolve('https://signed-url.example.com/asset'))
}));

/**
 * **Feature: campaign-asset-management, Property 7: Content generation asset integration**
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
 */
describe('Content Generation Asset Integration Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ASSETS_BUCKET = 'test-assets-bucket';
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
  const campaignIdArb = fc.string({ minLength: 10, maxLength: 30 });
  const postIdArb = fc.string({ minLength: 10, maxLength: 30 });

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

  it('should provide asset URLs, descriptions, and content types to content generation agents', async () => {
    const { AssetResolver } = await import('../../utils/asset-resolver.mjs');
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
              description: 'Test asset for content generation',
              fileSize: 1024 * 1024,
              objectKey: `${tenantId}/assets/${aid}.jpg`,
              usageStats: {
                totalCampaigns: 0,
                totalPosts: 0,
                lastUsedAt: null
              },
              createdAt: new Date().toISOString()
            };
          }
          return null;
        });

        const resolvedAssets = await AssetResolver.resolveMultipleAssets(tenantId, assets);

        // Verify all assets provide required information for content generation (Requirement 7.1)
        resolvedAssets.forEach((resolvedAsset, index) => {
          const originalAsset = assets[index];

          expect(resolvedAsset).toHaveProperty('accessUrl');
          expect(resolvedAsset).toHaveProperty('description');
          expect(resolvedAsset).toHaveProperty('contentType');
          expect(resolvedAsset).toHaveProperty('available');

          if (originalAsset.type === 'internal') {
            expect(resolvedAsset.type).toBe('internal');
            expect(resolvedAsset.assetId).toBe(originalAsset.assetId);
            expect(resolvedAsset.accessUrl).toBe('https://signed-url.example.com/asset');
            expect(resolvedAsset.available).toBe(true);
          } else {
            expect(resolvedAsset.type).toBe('external');
            expect(resolvedAsset.accessUrl).toBe(originalAsset.url);
            expect(resolvedAsset.description).toBe(originalAsset.description);
            expect(resolvedAsset.contentType).toBe(originalAsset.contentType);
            expect(resolvedAsset.available).toBe(true);
          }
        });
      }
    ), { numRuns: 100 });
  });

  it('should generate secure time-limited access URLs for internal assets', async () => {
    const { AssetResolver } = await import('../../utils/asset-resolver.mjs');
    const { Asset } = await import('../../models/asset.mjs');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      fc.array(internalAssetArb, { minLength: 1, maxLength: 3 }),
      async (tenantId, assets) => {
        // Clear mocks for each iteration
        vi.clearAllMocks();

        // Mock Asset.findById for internal assets
        vi.spyOn(Asset, 'findById').mockImplementation(async (tid, aid) => {
          if (tid === tenantId) {
            return {
              id: aid,
              uploadStatus: 'completed',
              contentType: 'image/jpeg',
              description: 'Test internal asset',
              fileSize: 1024 * 1024,
              objectKey: `${tenantId}/assets/${aid}.jpg`,
              usageStats: {
                totalCampaigns: 0,
                totalPosts: 0,
                lastUsedAt: null
              },
              createdAt: new Date().toISOString()
            };
          }
          return null;
        });

        const resolvedAssets = await AssetResolver.resolveMultipleAssets(tenantId, assets);

        // Verify secure URLs are generated for internal assets (Requirement 7.2)
        resolvedAssets.forEach(resolvedAsset => {
          expect(resolvedAsset.type).toBe('internal');
          expect(resolvedAsset.accessUrl).toBe('https://signed-url.example.com/asset');
          expect(resolvedAsset.available).toBe(true);
        });

        // Verify getSignedUrl was called with proper parameters
        expect(getSignedUrl).toHaveBeenCalledTimes(assets.length);
      }
    ), { numRuns: 100 });
  });

  it('should provide original external URLs directly for external assets', async () => {
    const { AssetResolver } = await import('../../utils/asset-resolver.mjs');

    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      fc.array(externalAssetArb, { minLength: 1, maxLength: 3 }),
      async (tenantId, assets) => {
        const resolvedAssets = await AssetResolver.resolveMultipleAssets(tenantId, assets);

        // Verify external URLs are provided directly (Requirement 7.3)
        resolvedAssets.forEach((resolvedAsset, index) => {
          const originalAsset = assets[index];

          expect(resolvedAsset.type).toBe('external');
          expect(resolvedAsset.accessUrl).toBe(originalAsset.url);
          expect(resolvedAsset.description).toBe(originalAsset.description);
          expect(resolvedAsset.contentType).toBe(originalAsset.contentType);
          expect(resolvedAsset.available).toBe(true);
        });
      }
    ), { numRuns: 100 });
  });

  it('should track asset utilization when content generation completes', async () => {
    const { AssetResolver } = await import('../../utils/asset-resolver.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      fc.array(campaignAssetArb, { minLength: 1, maxLength: 3 }),
      campaignIdArb,
      postIdArb,
      async (tenantId, assets, campaignId, postId) => {
        // Mock Asset.updateUsageStats for internal assets
        vi.spyOn(Asset, 'updateUsageStats').mockResolvedValue({ success: true });

        const trackingResults = await AssetResolver.trackMultipleAssetUtilization(
          tenantId,
          assets,
          campaignId,
          postId
        );

        // Verify utilization tracking occurs (Requirement 7.4)
        expect(trackingResults).toHaveLength(assets.length);

        trackingResults.forEach((result, index) => {
          const originalAsset = assets[index];

          expect(result.success).toBe(true);
          expect(result.tracked).toHaveProperty('campaignId');
          expect(result.tracked).toHaveProperty('postId');
          expect(result.tracked).toHaveProperty('trackedAt');
          expect(result.tracked.campaignId).toBe(campaignId);
          expect(result.tracked.postId).toBe(postId);

          if (originalAsset.type === 'internal') {
            expect(result.assetId).toBe(originalAsset.assetId);
            expect(Asset.updateUsageStats).toHaveBeenCalledWith(
              tenantId,
              originalAsset.assetId,
              campaignId,
              postId
            );
          } else {
            expect(result.assetId).toBeNull();
            expect(result.tracked.note).toContain('External asset utilization tracked');
          }
        });
      }
    ), { numRuns: 100 });
  });

  it('should handle asset resolution failures gracefully without breaking content generation', async () => {
    const { AssetResolver } = await import('../../utils/asset-resolver.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      fc.array(internalAssetArb, { minLength: 1, maxLength: 3 }),
      async (tenantId, assets) => {
        // Mock Asset.findById to return null (asset not found)
        vi.spyOn(Asset, 'findById').mockResolvedValue(null);

        const resolvedAssets = await AssetResolver.resolveMultipleAssets(tenantId, assets);

        // Verify graceful error handling
        resolvedAssets.forEach(resolvedAsset => {
          expect(resolvedAsset.available).toBe(false);
          expect(resolvedAsset.error).toBeDefined();
          expect(resolvedAsset.accessUrl).toBeNull();
          expect(resolvedAsset.description).toBeNull();
          expect(resolvedAsset.contentType).toBeNull();
        });
      }
    ), { numRuns: 100 });
  });

  it('should validate asset availability before content generation begins', async () => {
    const { AssetResolver } = await import('../../utils/asset-resolver.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      fc.array(campaignAssetArb, { minLength: 1, maxLength: 5 }),
      fc.boolean(), // Some assets available
      async (tenantId, assets, someAvailable) => {
        // Mock Asset.findById based on availability
        vi.spyOn(Asset, 'findById').mockImplementation(async (tid, aid) => {
          if (tid === tenantId && someAvailable) {
            return {
              id: aid,
              uploadStatus: 'completed',
              contentType: 'image/jpeg',
              description: 'Available test asset',
              fileSize: 1024 * 1024,
              objectKey: `${tenantId}/assets/${aid}.jpg`,
              usageStats: {
                totalCampaigns: 0,
                totalPosts: 0,
                lastUsedAt: null
              },
              createdAt: new Date().toISOString()
            };
          }
          return null;
        });

        const availabilityCheck = await AssetResolver.validateAssetAvailability(tenantId, assets);

        expect(availabilityCheck).toHaveProperty('available');
        expect(availabilityCheck).toHaveProperty('unavailableAssets');

        if (someAvailable) {
          // When assets are available, external assets should always be available
          const externalAssets = assets.filter(a => a.type === 'external');
          if (externalAssets.length === assets.length) {
            expect(availabilityCheck.available).toBe(true);
            expect(availabilityCheck.unavailableAssets).toHaveLength(0);
          }
        } else {
          // When internal assets are not available
          const internalAssets = assets.filter(a => a.type === 'internal');
          if (internalAssets.length > 0) {
            expect(availabilityCheck.available).toBe(false);
            expect(availabilityCheck.unavailableAssets.length).toBeGreaterThan(0);
          }
        }
      }
    ), { numRuns: 100 });
  });

  it('should provide complete asset metadata for content generation context', async () => {
    const { AssetResolver } = await import('../../utils/asset-resolver.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      fc.array(campaignAssetArb, { minLength: 1, maxLength: 3 }),
      async (tenantId, assets) => {
        // Mock Asset.findById for internal assets
        vi.spyOn(Asset, 'findById').mockImplementation(async (tid, aid) => {
          if (tid === tenantId) {
            return {
              id: aid,
              uploadStatus: 'completed',
              contentType: 'image/jpeg',
              description: 'Complete metadata test asset',
              fileSize: 2048 * 1024,
              objectKey: `${tenantId}/assets/${aid}.jpg`,
              usageStats: {
                totalCampaigns: 1,
                totalPosts: 3,
                lastUsedAt: new Date().toISOString()
              },
              createdAt: new Date().toISOString()
            };
          }
          return null;
        });

        const metadataResults = await Promise.all(
          assets.map(asset => AssetResolver.getAssetMetadata(tenantId, asset))
        );

        // Verify complete metadata is provided for content generation context
        metadataResults.forEach((metadata, index) => {
          const originalAsset = assets[index];

          if (metadata) {
            expect(metadata).toHaveProperty('type');
            expect(metadata).toHaveProperty('description');
            expect(metadata).toHaveProperty('contentType');

            if (originalAsset.type === 'internal') {
              expect(metadata.type).toBe('internal');
              expect(metadata).toHaveProperty('assetId');
              expect(metadata).toHaveProperty('fileSize');
              expect(metadata).toHaveProperty('uploadStatus');
              expect(metadata).toHaveProperty('usageStats');
              expect(metadata).toHaveProperty('createdAt');
            } else {
              expect(metadata.type).toBe('external');
              expect(metadata).toHaveProperty('url');
              expect(metadata).toHaveProperty('addedAt');
            }
          }
        });
      }
    ), { numRuns: 100 });
  });
});
