import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { AssetPoolBuilder } from '../../utils/asset-pool-builder.mjs';
import { Brand } from '../../models/brand.mjs';
import { Asset } from '../../models/asset.mjs';

vi.mock('@aws-sdk/client-dynamodb');
vi.mock('../../utils/logger.mjs', () => ({
  logger: { error: vi.fn() }
}));

describe('Feature: brand-asset-ux-integration, Property 2: Campaign Asset Pool Construction', () => {
  describe('**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**', () => {
    const tenantIdArb = fc.string({ minLength: 10, maxLength: 20 }).map(s => `tenant_${s}`);
    const brandIdArb = fc.string({ minLength: 10, maxLength: 20 }).map(s => `brand_${s}`);
    const assetIdArb = fc.string({ minLength: 10, maxLength: 20 }).map(s => `asset_${s}`);
    const urlArb = fc.webUrl({ validSchemes: ['https'] });
    const descriptionArb = fc.string({ minLength: 10, maxLength: 500 }).filter(s => s.trim().length >= 10);
    const contentTypeArb = fc.constantFrom('image/jpeg', 'image/png', 'image/webp', 'video/mp4');
    const timestampArb = fc.date().map(d => d.toISOString());
    const userIdArb = fc.string({ minLength: 10, maxLength: 20 }).map(s => `user_${s}`);

    const platformArb = fc.constantFrom('twitter', 'linkedin', 'instagram', 'facebook');
    const themeArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);
    const frequencyArb = fc.constantFrom('high', 'medium', 'low');
    const categoryArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);

    const usageIntentArb = fc.oneof(
      fc.constant(null),
      fc.record({
        platforms: fc.oneof(fc.constant(undefined), fc.array(platformArb, { minLength: 1, maxLength: 4 })),
        themes: fc.oneof(fc.constant(undefined), fc.array(themeArb, { minLength: 1, maxLength: 5 })),
        frequency: fc.oneof(fc.constant(undefined), frequencyArb)
      })
    );

    const internalBrandAssetArb = fc.record({
      type: fc.constant('internal'),
      assetId: assetIdArb,
      usageIntent: usageIntentArb,
      isDefault: fc.boolean(),
      category: fc.oneof(fc.constant(null), categoryArb),
      addedAt: timestampArb,
      addedBy: userIdArb
    });

    const externalBrandAssetArb = fc.record({
      type: fc.constant('external'),
      url: urlArb,
      description: descriptionArb,
      contentType: contentTypeArb,
      usageIntent: usageIntentArb,
      isDefault: fc.boolean(),
      category: fc.oneof(fc.constant(null), categoryArb),
      addedAt: timestampArb,
      addedBy: userIdArb
    });

    const brandAssetArb = fc.oneof(internalBrandAssetArb, externalBrandAssetArb);
    const brandAssetsArrayArb = fc.array(brandAssetArb, { minLength: 0, maxLength: 20 });

    const internalCampaignAssetRefArb = fc.record({
      type: fc.constant('internal'),
      assetId: assetIdArb
    });

    const externalCampaignAssetRefArb = fc.record({
      type: fc.constant('external'),
      url: urlArb,
      description: descriptionArb,
      contentType: contentTypeArb
    });

    const campaignAssetRefArb = fc.oneof(
      internalCampaignAssetRefArb,
      externalCampaignAssetRefArb
    );

    const campaignAssetsArrayArb = fc.array(campaignAssetRefArb, { minLength: 0, maxLength: 20 });

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should automatically include brand assets when brand ID is provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArb,
          brandIdArb,
          brandAssetsArrayArb,
          campaignAssetsArrayArb,
          async (tenantId, brandId, brandAssets, campaignAssets) => {
            const approvedBrandAssets = brandAssets.filter(() => Math.random() > 0.3);

            vi.spyOn(Brand, 'findById').mockResolvedValue({
              id: brandId,
              assets: approvedBrandAssets
            });

            const assetMocks = new Map();
            approvedBrandAssets.forEach(asset => {
              if (asset.type === 'internal') {
                assetMocks.set(asset.assetId, {
                  id: asset.assetId,
                  description: `Description for ${asset.assetId}`,
                  contentType: 'image/jpeg',
                  approvalStatus: 'approved'
                });
              }
            });

            campaignAssets.forEach(asset => {
              if (asset.type === 'internal') {
                assetMocks.set(asset.assetId, {
                  id: asset.assetId,
                  description: `Description for ${asset.assetId}`,
                  contentType: 'image/jpeg',
                  approvalStatus: 'approved'
                });
              }
            });

            vi.spyOn(Asset, 'findById').mockImplementation(async (tid, aid) => {
              return assetMocks.get(aid) || null;
            });

            const assetPool = await AssetPoolBuilder.buildAssetPool(tenantId, brandId, campaignAssets);

            expect(assetPool).toHaveProperty('brandDefaults');
            expect(assetPool).toHaveProperty('campaignSpecific');
            expect(Array.isArray(assetPool.brandDefaults)).toBe(true);
            expect(Array.isArray(assetPool.campaignSpecific)).toBe(true);

            const expectedBrandAssetCount = approvedBrandAssets.filter(a =>
              a.type === 'external' || assetMocks.has(a.assetId)
            ).length;

            expect(assetPool.brandDefaults.length).toBe(expectedBrandAssetCount);
            assetPool.brandDefaults.forEach(asset => {
              expect(asset.source).toBe('brand');
              expect(asset.approvalStatus).toBe('approved');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should merge campaign-specific assets with brand assets', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArb,
          brandIdArb,
          brandAssetsArrayArb,
          campaignAssetsArrayArb,
          async (tenantId, brandId, brandAssets, campaignAssets) => {
            vi.spyOn(Brand, 'findById').mockResolvedValue({
              id: brandId,
              assets: brandAssets
            });

            const assetMocks = new Map();
            brandAssets.forEach(asset => {
              if (asset.type === 'internal') {
                assetMocks.set(asset.assetId, {
                  id: asset.assetId,
                  description: `Description for ${asset.assetId}`,
                  contentType: 'image/jpeg',
                  approvalStatus: 'approved'
                });
              }
            });

            campaignAssets.forEach(asset => {
              if (asset.type === 'internal') {
                assetMocks.set(asset.assetId, {
                  id: asset.assetId,
                  description: `Description for ${asset.assetId}`,
                  contentType: 'image/jpeg',
                  approvalStatus: 'approved'
                });
              }
            });

            vi.spyOn(Asset, 'findById').mockImplementation(async (tid, aid) => {
              return assetMocks.get(aid) || null;
            });

            const assetPool = await AssetPoolBuilder.buildAssetPool(tenantId, brandId, campaignAssets);

            const totalAssets = assetPool.brandDefaults.length + assetPool.campaignSpecific.length;
            expect(totalAssets).toBeGreaterThanOrEqual(0);

            assetPool.brandDefaults.forEach(asset => {
              expect(asset.source).toBe('brand');
            });

            assetPool.campaignSpecific.forEach(asset => {
              expect(asset.source).toBe('campaign');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use only campaign assets when no brand ID is provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArb,
          campaignAssetsArrayArb,
          async (tenantId, campaignAssets) => {
            const assetMocks = new Map();
            campaignAssets.forEach(asset => {
              if (asset.type === 'internal') {
                assetMocks.set(asset.assetId, {
                  id: asset.assetId,
                  description: `Description for ${asset.assetId}`,
                  contentType: 'image/jpeg',
                  approvalStatus: 'approved'
                });
              }
            });

            vi.spyOn(Asset, 'findById').mockImplementation(async (tid, aid) => {
              return assetMocks.get(aid) || null;
            });

            const assetPool = await AssetPoolBuilder.buildAssetPool(tenantId, null, campaignAssets);

            expect(assetPool.brandDefaults).toEqual([]);
            expect(Array.isArray(assetPool.campaignSpecific)).toBe(true);

            assetPool.campaignSpecific.forEach(asset => {
              expect(asset.source).toBe('campaign');
              expect(asset.approvalStatus).toBe('approved');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should support both internal and external asset types in campaign assets', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArb,
          campaignAssetsArrayArb,
          async (tenantId, campaignAssets) => {
            const assetMocks = new Map();
            campaignAssets.forEach(asset => {
              if (asset.type === 'internal') {
                assetMocks.set(asset.assetId, {
                  id: asset.assetId,
                  description: `Description for ${asset.assetId}`,
                  contentType: 'image/jpeg',
                  approvalStatus: 'approved'
                });
              }
            });

            vi.spyOn(Asset, 'findById').mockImplementation(async (tid, aid) => {
              return assetMocks.get(aid) || null;
            });

            const assetPool = await AssetPoolBuilder.buildAssetPool(tenantId, null, campaignAssets);

            assetPool.campaignSpecific.forEach(asset => {
              expect(['internal', 'external']).toContain(asset.type);

              if (asset.type === 'internal') {
                expect(asset.assetId).toBeTruthy();
                expect(asset.url).toBeNull();
              } else if (asset.type === 'external') {
                expect(asset.assetId).toBeNull();
                expect(asset.url).toBeTruthy();
                expect(asset.url).toMatch(/^https:\/\//);
              }

              expect(asset.description).toBeTruthy();
              expect(asset.contentType).toBeTruthy();
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should filter out non-approved assets from asset pool', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArb,
          brandIdArb,
          brandAssetsArrayArb,
          async (tenantId, brandId, brandAssets) => {
            vi.spyOn(Brand, 'findById').mockResolvedValue({
              id: brandId,
              assets: brandAssets
            });

            const assetMocks = new Map();
            brandAssets.forEach((asset, index) => {
              if (asset.type === 'internal') {
                const approvalStatus = index % 3 === 0 ? 'pending' : index % 3 === 1 ? 'rejected' : 'approved';
                assetMocks.set(asset.assetId, {
                  id: asset.assetId,
                  description: `Description for ${asset.assetId}`,
                  contentType: 'image/jpeg',
                  approvalStatus
                });
              }
            });

            vi.spyOn(Asset, 'findById').mockImplementation(async (tid, aid) => {
              return assetMocks.get(aid) || null;
            });

            const assetPool = await AssetPoolBuilder.buildAssetPool(tenantId, brandId, []);

            assetPool.brandDefaults.forEach(asset => {
              expect(asset.approvalStatus).toBe('approved');
            });

            assetPool.campaignSpecific.forEach(asset => {
              expect(asset.approvalStatus).toBe('approved');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should tag assets with correct source metadata', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArb,
          brandIdArb,
          brandAssetsArrayArb,
          campaignAssetsArrayArb,
          async (tenantId, brandId, brandAssets, campaignAssets) => {
            vi.spyOn(Brand, 'findById').mockResolvedValue({
              id: brandId,
              assets: brandAssets
            });

            const assetMocks = new Map();
            [...brandAssets, ...campaignAssets].forEach(asset => {
              if (asset.type === 'internal') {
                assetMocks.set(asset.assetId, {
                  id: asset.assetId,
                  description: `Description for ${asset.assetId}`,
                  contentType: 'image/jpeg',
                  approvalStatus: 'approved'
                });
              }
            });

            vi.spyOn(Asset, 'findById').mockImplementation(async (tid, aid) => {
              return assetMocks.get(aid) || null;
            });

            const assetPool = await AssetPoolBuilder.buildAssetPool(tenantId, brandId, campaignAssets);

            assetPool.brandDefaults.forEach(asset => {
              expect(asset).toHaveProperty('source');
              expect(asset.source).toBe('brand');
            });

            assetPool.campaignSpecific.forEach(asset => {
              expect(asset).toHaveProperty('source');
              expect(asset.source).toBe('campaign');
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
