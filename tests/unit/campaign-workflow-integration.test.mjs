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
 * **Feature: campaign-asset-management, Property 10: Campaign workflow integration**
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
 */
describe('Campaign Workflow Integration Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ASSETS_BUCKET = 'test-assets-bucket';
    process.env.TABLE_NAME = 'test-table';
  });

  const SUPPORTED_CONTENT_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/mov', 'video/avi'
  ];

  // Generators for property-based testing
  const tenantIdArb = fc.string({ minLength: 5, maxLength: 50 });
  const assetIdArb = fc.string({ minLength: 10, maxLength: 30 }).map(s => `asset_${s}`);
  const campaignIdArb = fc.string({ minLength: 10, maxLength: 30 }).map(s => `campaign_${s}`);
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

  const campaignArb = fc.record({
    id: campaignIdArb,
    name: fc.string({ minLength: 5, maxLength: 100 }),
    status: fc.constantFrom('planning', 'generating', 'completed', 'failed'),
    assets: fc.option(fc.array(campaignAssetArb, { minLength: 0, maxLength: 5 }))
  });

  it('should validate asset availability before campaign execution begins', async () => {
    const { AssetResolver } = await import('../../utils/asset-resolver.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      campaignArb,
      fc.boolean(), // assetsAvailable
      async (tenantId, campaign, assetsAvailable) => {
        if (!campaign.assets || campaign.assets.length === 0) {
          // Skip campaigns without assets
          return true;
        }

        // Mock Asset.findById based on availability
        vi.spyOn(Asset, 'findById').mockImplementation(async (tid, aid) => {
          if (tid === tenantId && assetsAvailable) {
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

        const availabilityCheck = await AssetResolver.validateAssetAvailability(tenantId, campaign.assets);

        // Verify availability validation occurs before execution (Requirement 10.1)
        expect(availabilityCheck).toHaveProperty('available');
        expect(availabilityCheck).toHaveProperty('unavailableAssets');
        expect(typeof availabilityCheck.available).toBe('boolean');
        expect(Array.isArray(availabilityCheck.unavailableAssets)).toBe(true);

        if (assetsAvailable) {
          // When assets are available, external assets should always be available
          const externalAssets = campaign.assets.filter(a => a.type === 'external');
          const internalAssets = campaign.assets.filter(a => a.type === 'internal');

          if (externalAssets.length === campaign.assets.length) {
            // All external assets should be available
            expect(availabilityCheck.available).toBe(true);
            expect(availabilityCheck.unavailableAssets).toHaveLength(0);
          } else if (internalAssets.length > 0) {
            // Internal assets are mocked as available
            expect(availabilityCheck.available).toBe(true);
            expect(availabilityCheck.unavailableAssets).toHaveLength(0);
          }
        } else {
          // When internal assets are not available
          const internalAssets = campaign.assets.filter(a => a.type === 'internal');
          if (internalAssets.length > 0) {
            expect(availabilityCheck.available).toBe(false);
            expect(availabilityCheck.unavailableAssets.length).toBeGreaterThan(0);
          }
        }

        return true;
      }
    ), { numRuns: 100 });
  });

  it('should ensure asset accessibility throughout the generation process', async () => {
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
              description: 'Accessible test asset',
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

        // Simulate multiple access attempts during generation process
        const accessAttempts = 3;
        const accessResults = [];

        for (let i = 0; i < accessAttempts; i++) {
          const resolvedAssets = await AssetResolver.resolveMultipleAssets(tenantId, assets);
          accessResults.push(resolvedAssets);
        }

        // Verify assets remain accessible throughout generation process (Requirement 10.2)
        accessResults.forEach((resolvedAssets, _attemptIndex) => {
          expect(resolvedAssets).toHaveLength(assets.length);

          resolvedAssets.forEach((resolvedAsset, assetIndex) => {
            const originalAsset = assets[assetIndex];

            expect(resolvedAsset).toHaveProperty('available');
            expect(resolvedAsset).toHaveProperty('accessUrl');
            expect(resolvedAsset).toHaveProperty('description');
            expect(resolvedAsset).toHaveProperty('contentType');

            if (originalAsset.type === 'internal') {
              expect(resolvedAsset.available).toBe(true);
              expect(resolvedAsset.accessUrl).toBe('https://signed-url.example.com/asset');
              expect(resolvedAsset.assetId).toBe(originalAsset.assetId);
            } else {
              expect(resolvedAsset.available).toBe(true);
              expect(resolvedAsset.accessUrl).toBe(originalAsset.url);
              expect(resolvedAsset.description).toBe(originalAsset.description);
              expect(resolvedAsset.contentType).toBe(originalAsset.contentType);
            }
          });
        });

        return true;
      }
    ), { numRuns: 100 });
  });

  it('should provide graceful fallback options and clear error reporting when asset errors occur', async () => {
    const { AssetResolver } = await import('../../utils/asset-resolver.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      fc.array(internalAssetArb, { minLength: 1, maxLength: 3 }),
      fc.constantFrom('not_found', 'upload_incomplete', 'access_denied'),
      async (tenantId, assets, errorType) => {
        // Mock Asset.findById to simulate different error conditions
        vi.spyOn(Asset, 'findById').mockImplementation(async (tid, aid) => {
          if (tid === tenantId) {
            switch (errorType) {
              case 'not_found':
                return null;
              case 'upload_incomplete':
                return {
                  id: aid,
                  uploadStatus: 'pending',
                  contentType: 'image/jpeg',
                  description: 'Incomplete upload asset',
                  fileSize: 1024 * 1024,
                  objectKey: `${tenantId}/assets/${aid}.jpg`
                };
              case 'access_denied':
                throw new Error('Access denied to asset');
              default:
                return null;
            }
          }
          return null;
        });

        const resolvedAssets = await AssetResolver.resolveMultipleAssets(tenantId, assets);

        // Verify graceful error handling and clear error reporting (Requirement 10.3)
        resolvedAssets.forEach((resolvedAsset, index) => {
          const originalAsset = assets[index];

          expect(resolvedAsset.available).toBe(false);
          expect(resolvedAsset.error).toBeDefined();
          expect(typeof resolvedAsset.error).toBe('string');
          expect(resolvedAsset.error.length).toBeGreaterThan(0);

          // Verify fallback values are provided
          expect(resolvedAsset.type).toBe('internal');
          expect(resolvedAsset.assetId).toBe(originalAsset.assetId);
          expect(resolvedAsset.accessUrl).toBeNull();
          expect(resolvedAsset.description).toBeNull();
          expect(resolvedAsset.contentType).toBeNull();

          // Verify error message is descriptive based on error type
          switch (errorType) {
            case 'not_found':
              expect(resolvedAsset.error).toContain('not found');
              break;
            case 'upload_incomplete':
              expect(resolvedAsset.error).toContain('upload not completed');
              break;
            case 'access_denied':
              expect(resolvedAsset.error).toContain('Access denied');
              break;
          }
        });

        return true;
      }
    ), { numRuns: 100 });
  });

  it('should update asset usage records and provide utilization feedback when campaigns complete', async () => {
    const { AssetResolver } = await import('../../utils/asset-resolver.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      campaignIdArb,
      fc.array(campaignAssetArb, { minLength: 1, maxLength: 5 }),
      fc.array(fc.string({ minLength: 10, maxLength: 30 }), { minLength: 1, maxLength: 10 }), // postIds
      async (tenantId, campaignId, assets, postIds) => {
        // Mock Asset.updateUsageStats for internal assets
        const updateUsageStatsCalls = [];
        vi.spyOn(Asset, 'updateUsageStats').mockImplementation(async (tid, aid, cid, pid) => {
          updateUsageStatsCalls.push({ tenantId: tid, assetId: aid, campaignId: cid, postId: pid });
          return { success: true };
        });

        // Simulate campaign completion with asset utilization tracking
        const utilizationResults = [];

        for (const postId of postIds) {
          const postUtilization = await AssetResolver.trackMultipleAssetUtilization(
            tenantId,
            assets,
            campaignId,
            postId
          );
          utilizationResults.push(...postUtilization);
        }

        // Verify usage records are updated (Requirement 10.4)
        expect(utilizationResults.length).toBe(assets.length * postIds.length);

        utilizationResults.forEach((result, index) => {
          const assetIndex = index % assets.length;
          const postIndex = Math.floor(index / assets.length);
          const originalAsset = assets[assetIndex];
          const postId = postIds[postIndex];

          expect(result.success).toBe(true);
          expect(result.tracked).toHaveProperty('campaignId');
          expect(result.tracked).toHaveProperty('postId');
          expect(result.tracked).toHaveProperty('trackedAt');
          expect(result.tracked.campaignId).toBe(campaignId);
          expect(result.tracked.postId).toBe(postId);

          if (originalAsset.type === 'internal') {
            expect(result.assetId).toBe(originalAsset.assetId);
          } else {
            expect(result.assetId).toBeNull();
            expect(result.tracked.note).toContain('External asset utilization tracked');
          }
        });

        // Verify Asset.updateUsageStats was called for internal assets
        const internalAssets = assets.filter(a => a.type === 'internal');
        const expectedCalls = internalAssets.length * postIds.length;
        expect(updateUsageStatsCalls).toHaveLength(expectedCalls);

        updateUsageStatsCalls.forEach(call => {
          expect(call.tenantId).toBe(tenantId);
          expect(call.campaignId).toBe(campaignId);
          expect(postIds).toContain(call.postId);
          expect(internalAssets.some(a => a.assetId === call.assetId)).toBe(true);
        });

        return true;
      }
    ), { numRuns: 100 });
  });

  it('should generate utilization reports for campaign optimization feedback', async () => {
    const { AssetResolver } = await import('../../utils/asset-resolver.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      fc.array(campaignAssetArb, { minLength: 1, maxLength: 5 }),
      async (tenantId, assets) => {
        // Mock Asset.findById for internal assets with usage statistics
        vi.spyOn(Asset, 'findById').mockImplementation(async (tid, aid) => {
          if (tid === tenantId) {
            return {
              id: aid,
              uploadStatus: 'completed',
              contentType: 'image/jpeg',
              description: 'Asset with usage stats',
              fileSize: 1024 * 1024,
              objectKey: `${tenantId}/assets/${aid}.jpg`,
              usageStats: {
                totalCampaigns: Math.floor(Math.random() * 5),
                totalPosts: Math.floor(Math.random() * 10),
                lastUsedAt: Math.random() > 0.5 ? new Date().toISOString() : null
              },
              createdAt: new Date().toISOString()
            };
          }
          return null;
        });

        const utilizationReport = await AssetResolver.generateUtilizationReport(tenantId, assets);

        // Verify utilization feedback is provided (Requirement 10.4)
        expect(utilizationReport).toHaveProperty('totalAssets');
        expect(utilizationReport).toHaveProperty('internalAssets');
        expect(utilizationReport).toHaveProperty('externalAssets');
        expect(utilizationReport).toHaveProperty('utilizationSummary');
        expect(utilizationReport).toHaveProperty('underutilizedAssets');

        expect(utilizationReport.totalAssets).toBe(assets.length);
        expect(utilizationReport.internalAssets).toBe(assets.filter(a => a.type === 'internal').length);
        expect(utilizationReport.externalAssets).toBe(assets.filter(a => a.type === 'external').length);

        // Verify utilization summary structure
        expect(utilizationReport.utilizationSummary).toHaveProperty('totalCampaigns');
        expect(utilizationReport.utilizationSummary).toHaveProperty('totalPosts');
        expect(utilizationReport.utilizationSummary).toHaveProperty('averageUsagePerAsset');
        expect(typeof utilizationReport.utilizationSummary.totalCampaigns).toBe('number');
        expect(typeof utilizationReport.utilizationSummary.totalPosts).toBe('number');
        expect(typeof utilizationReport.utilizationSummary.averageUsagePerAsset).toBe('number');

        // Verify underutilized assets are identified
        expect(Array.isArray(utilizationReport.underutilizedAssets)).toBe(true);
        utilizationReport.underutilizedAssets.forEach(asset => {
          expect(asset).toHaveProperty('assetId');
          expect(asset).toHaveProperty('description');
          expect(asset).toHaveProperty('contentType');
          expect(asset).toHaveProperty('createdAt');
        });

        return true;
      }
    ), { numRuns: 100 });
  });

  it('should handle campaigns without assets gracefully', async () => {
    const { AssetResolver } = await import('../../utils/asset-resolver.mjs');

    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      campaignIdArb,
      fc.oneof(fc.constant(null), fc.constant([]), fc.constant(undefined)),
      async (tenantId, campaignId, assets) => {
        // Test asset availability validation with no assets
        const availabilityCheck = await AssetResolver.validateAssetAvailability(tenantId, assets);
        expect(availabilityCheck.available).toBe(true);
        expect(availabilityCheck.unavailableAssets).toHaveLength(0);

        // Test asset resolution with no assets
        const resolvedAssets = await AssetResolver.resolveMultipleAssets(tenantId, assets);
        expect(resolvedAssets).toHaveLength(0);

        // Test utilization tracking with no assets
        const trackingResults = await AssetResolver.trackMultipleAssetUtilization(
          tenantId,
          assets,
          campaignId,
          'post_123'
        );
        expect(trackingResults).toHaveLength(0);

        // Test utilization report with no assets
        const utilizationReport = await AssetResolver.generateUtilizationReport(tenantId, assets);
        expect(utilizationReport.totalAssets).toBe(0);
        expect(utilizationReport.internalAssets).toBe(0);
        expect(utilizationReport.externalAssets).toBe(0);
        expect(utilizationReport.utilizationSummary.totalCampaigns).toBe(0);
        expect(utilizationReport.utilizationSummary.totalPosts).toBe(0);
        expect(utilizationReport.utilizationSummary.averageUsagePerAsset).toBe(0);

        // The underutilizedAssets property may not exist when there are no assets
        if (utilizationReport.underutilizedAssets !== undefined) {
          expect(utilizationReport.underutilizedAssets).toHaveLength(0);
        }

        return true;
      }
    ), { numRuns: 100 });
  });

  it('should maintain campaign workflow continuity despite asset-related failures', async () => {
    const { AssetResolver } = await import('../../utils/asset-resolver.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      campaignArb,
      fc.float({ min: 0, max: 1 }), // failureRate
      async (tenantId, campaign, failureRate) => {
        if (!campaign.assets || campaign.assets.length === 0) {
          // Skip campaigns without assets
          return true;
        }

        // Mock Asset.findById to simulate intermittent failures
        vi.spyOn(Asset, 'findById').mockImplementation(async (tid, aid) => {
          if (tid === tenantId) {
            if (Math.random() < failureRate) {
              throw new Error('Simulated asset access failure');
            }
            return {
              id: aid,
              uploadStatus: 'completed',
              contentType: 'image/jpeg',
              description: 'Test asset with potential failures',
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

        // Test that workflow continues despite asset failures
        const resolvedAssets = await AssetResolver.resolveMultipleAssets(tenantId, campaign.assets);

        // Verify workflow continuity (Requirement 10.3)
        expect(resolvedAssets).toHaveLength(campaign.assets.length);

        const availableAssets = resolvedAssets.filter(asset => asset.available);
        const failedAssets = resolvedAssets.filter(asset => !asset.available);

        // Verify that some assets may fail but workflow continues
        expect(availableAssets.length + failedAssets.length).toBe(campaign.assets.length);

        // Verify failed assets have proper error information
        failedAssets.forEach(asset => {
          expect(asset.available).toBe(false);
          expect(asset.error).toBeDefined();
          expect(typeof asset.error).toBe('string');
          expect(asset.accessUrl).toBeNull();
        });

        // Verify available assets have proper access information
        availableAssets.forEach(asset => {
          expect(asset.available).toBe(true);
          expect(asset.accessUrl).toBeDefined();
          expect(asset.description).toBeDefined();
          expect(asset.contentType).toBeDefined();
        });

        return true;
      }
    ), { numRuns: 100 });
  });
});
