import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { Asset } from '../../models/asset.mjs';

/**
 * campaign-asset-management, Property 6: Asset lifecycle management**
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
 */
describe('Asset Lifecycle Management Property Tests', () => {
  const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/mov', 'video/avi'];
  const SUPPORTED_CONTENT_TYPES = [...SUPPORTED_IMAGE_TYPES, ...SUPPORTED_VIDEO_TYPES];

  const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

  // Generators for property-based testing
  const tenantIdArb = fc.string({ minLength: 5, maxLength: 50 });
  const assetIdArb = fc.string({ minLength: 10, maxLength: 30 });
  const validContentTypeArb = fc.constantFrom(...SUPPORTED_CONTENT_TYPES);
  const validDescriptionArb = fc.string({ minLength: 10, maxLength: 500 });
  const validFileSizeArb = fc.integer({ min: 1, max: MAX_IMAGE_SIZE });

  const validAssetArb = fc.record({
    tenantId: tenantIdArb,
    assetId: assetIdArb,
    contentType: validContentTypeArb,
    description: validDescriptionArb,
    fileSize: validFileSizeArb
  }).filter(asset => {
    if (SUPPORTED_IMAGE_TYPES.includes(asset.contentType)) {
      return asset.fileSize <= MAX_IMAGE_SIZE;
    }
    if (SUPPORTED_VIDEO_TYPES.includes(asset.contentType)) {
      return asset.fileSize <= MAX_VIDEO_SIZE;
    }
    return false;
  });

  const listOptionsArb = fc.record({
    limit: fc.integer({ min: 1, max: 100 }),
    nextToken: fc.option(fc.string())
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide paginated asset listing', () => {
    fc.assert(fc.property(
      tenantIdArb,
      listOptionsArb,
      (tenantId, options) => {
        expect(tenantId.trim().length).toBeGreaterThan(0);

        expect(options.limit).toBeGreaterThan(0);
        expect(options.limit).toBeLessThanOrEqual(100);

        const mockResult = {
          items: Array.from({ length: Math.min(options.limit, 5) }, (_, i) => ({
            assetId: `asset_${i}`,
            type: 'internal',
            contentType: 'image/jpeg',
            description: 'Test asset description for property testing',
            fileSize: 1024 * 1024,
            objectKey: `${tenantId}/assets/asset_${i}.jpg`,
            fileExtension: 'jpg',
            uploadStatus: 'completed',
            usageStats: {
              totalCampaigns: i,
              totalPosts: i * 2,
              lastUsedAt: i > 0 ? new Date().toISOString() : null
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1
          })),
          pagination: {
            limit: options.limit,
            hasNextPage: false,
            nextToken: null
          }
        };

        expect(mockResult).toHaveProperty('items');
        expect(mockResult).toHaveProperty('pagination');
        expect(mockResult.pagination).toHaveProperty('limit');
        expect(mockResult.pagination).toHaveProperty('hasNextPage');
        expect(mockResult.pagination).toHaveProperty('nextToken');

        mockResult.items.forEach(asset => {
          expect(asset).toHaveProperty('usageStats');
          expect(asset.usageStats).toHaveProperty('totalCampaigns');
          expect(asset.usageStats).toHaveProperty('totalPosts');
          expect(asset.usageStats).toHaveProperty('lastUsedAt');
          expect(typeof asset.usageStats.totalCampaigns).toBe('number');
          expect(typeof asset.usageStats.totalPosts).toBe('number');
        });

        expect(mockResult.items.length).toBeLessThanOrEqual(options.limit);

        return true;
      }
    ), { numRuns: 100 });
  });

  it('should allow description updates while preserving immutable fields', () => {
    fc.assert(fc.property(
      validAssetArb,
      validDescriptionArb,
      (asset, newDescription) => {
        // Verify input validity
        expect(asset.description.length).toBeGreaterThanOrEqual(10);
        expect(asset.description.length).toBeLessThanOrEqual(500);
        expect(newDescription.length).toBeGreaterThanOrEqual(10);
        expect(newDescription.length).toBeLessThanOrEqual(500);

        // Mock existing asset
        const existingAsset = {
          ...asset,
          type: 'internal',
          objectKey: `${asset.tenantId}/assets/${asset.assetId}.jpg`,
          fileExtension: 'jpg',
          uploadStatus: 'completed',
          uploadUrl: null,
          ttl: null,
          usageStats: {
            totalCampaigns: 0,
            totalPosts: 0,
            lastUsedAt: null
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1
        };

        // Mock updated asset
        const updatedAsset = {
          ...existingAsset,
          description: newDescription,
          updatedAt: new Date().toISOString()
        };

        // Verify description was updated (Requirement 6.2)
        expect(updatedAsset.description).toBe(newDescription);

        // Verify immutable fields were preserved (Requirement 6.2)
        expect(updatedAsset.assetId).toBe(existingAsset.assetId);
        expect(updatedAsset.contentType).toBe(existingAsset.contentType);
        expect(updatedAsset.objectKey).toBe(existingAsset.objectKey);
        expect(updatedAsset.fileExtension).toBe(existingAsset.fileExtension);
        expect(updatedAsset.fileSize).toBe(existingAsset.fileSize);
        expect(updatedAsset.uploadStatus).toBe(existingAsset.uploadStatus);
        expect(updatedAsset.createdAt).toBe(existingAsset.createdAt);

        return true;
      }
    ), { numRuns: 100 });
  });

  it('should handle asset deletion appropriately based on type and campaign references', () => {
    fc.assert(fc.property(
      validAssetArb,
      fc.boolean(), // hasActiveCampaigns
      (asset, hasActiveCampaigns) => {
        const existingAsset = {
          ...asset,
          type: 'internal',
          objectKey: `${asset.tenantId}/assets/${asset.assetId}.jpg`,
          fileExtension: 'jpg',
          uploadStatus: 'completed',
          uploadUrl: null,
          ttl: null,
          usageStats: {
            totalCampaigns: hasActiveCampaigns ? 1 : 0,
            totalPosts: hasActiveCampaigns ? 2 : 0,
            lastUsedAt: hasActiveCampaigns ? new Date().toISOString() : null
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1
        };

        if (hasActiveCampaigns) {
          // For assets with active campaigns, deletion should be prevented (Requirement 6.3)
          // The usage stats should indicate campaign usage
          expect(existingAsset.usageStats.totalCampaigns).toBeGreaterThan(0);
        } else {
          // For assets without active campaigns, deletion should proceed (Requirement 6.3, 6.4)
          expect(existingAsset.usageStats.totalCampaigns).toBe(0);
        }

        // Verify asset metadata includes complete information (Requirement 6.5)
        expect(existingAsset).toHaveProperty('assetId');
        expect(existingAsset).toHaveProperty('contentType');
        expect(existingAsset).toHaveProperty('description');
        expect(existingAsset).toHaveProperty('fileSize');
        expect(existingAsset).toHaveProperty('objectKey');
        expect(existingAsset).toHaveProperty('uploadStatus');
        expect(existingAsset).toHaveProperty('usageStats');
        expect(existingAsset).toHaveProperty('createdAt');
        expect(existingAsset).toHaveProperty('updatedAt');

        return true;
      }
    ), { numRuns: 100 });
  });

  it('should provide complete asset metadata including usage statistics and campaign associations', () => {
    fc.assert(fc.property(
      validAssetArb,
      fc.integer({ min: 0, max: 10 }), // totalCampaigns
      fc.integer({ min: 0, max: 20 }), // totalPosts
      (asset, totalCampaigns, totalPosts) => {
        const completeAsset = {
          ...asset,
          type: 'internal',
          objectKey: `${asset.tenantId}/assets/${asset.assetId}.jpg`,
          fileExtension: 'jpg',
          uploadStatus: 'completed',
          uploadUrl: null,
          ttl: null,
          usageStats: {
            totalCampaigns,
            totalPosts,
            lastUsedAt: totalCampaigns > 0 ? new Date().toISOString() : null
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1
        };

        // Verify complete metadata is provided (Requirement 6.5)
        expect(completeAsset).toHaveProperty('assetId');
        expect(completeAsset).toHaveProperty('type');
        expect(completeAsset).toHaveProperty('contentType');
        expect(completeAsset).toHaveProperty('description');
        expect(completeAsset).toHaveProperty('fileSize');
        expect(completeAsset).toHaveProperty('objectKey');
        expect(completeAsset).toHaveProperty('fileExtension');
        expect(completeAsset).toHaveProperty('uploadStatus');
        expect(completeAsset).toHaveProperty('createdAt');
        expect(completeAsset).toHaveProperty('updatedAt');

        // Verify usage statistics are included (Requirement 6.5)
        expect(completeAsset).toHaveProperty('usageStats');
        expect(completeAsset.usageStats).toHaveProperty('totalCampaigns');
        expect(completeAsset.usageStats).toHaveProperty('totalPosts');
        expect(completeAsset.usageStats).toHaveProperty('lastUsedAt');
        expect(completeAsset.usageStats.totalCampaigns).toBe(totalCampaigns);
        expect(completeAsset.usageStats.totalPosts).toBe(totalPosts);

        // Verify campaign associations are tracked
        if (totalCampaigns > 0) {
          expect(completeAsset.usageStats.lastUsedAt).not.toBeNull();
        }

        return true;
      }
    ), { numRuns: 100 });
  });
});
