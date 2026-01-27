import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { Brand, BrandAssetAssociationSchema } from '../../models/brand.mjs';

vi.mock('@aws-sdk/client-dynamodb');
vi.mock('../../utils/logger.mjs', () => ({
  brandLogger: {
    error: vi.fn()
  }
}));

describe('Feature: brand-asset-ux-integration, Property 1: Brand-Asset Association Management', () => {
  describe('**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**', () => {
    const assetIdArb = fc.string({ minLength: 10, maxLength: 20 }).map(s => `asset_${s}`);
    const urlArb = fc.webUrl({ validSchemes: ['https'] });
    const timestampArb = fc.date().map(d => d.toISOString());
    const userIdArb = fc.string({ minLength: 10, maxLength: 20 }).map(s => `user_${s}`);

    const platformArb = fc.constantFrom('twitter', 'linkedin', 'instagram', 'facebook');
    const themeArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);
    const frequencyArb = fc.constantFrom('high', 'medium', 'low');
    const categoryArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);
    const descriptionArb = fc.string({ minLength: 10, maxLength: 500 }).filter(s => s.trim().length >= 10);

    const usageIntentArb = fc.oneof(
      fc.constant(null),
      fc.record({
        platforms: fc.oneof(fc.constant(undefined), fc.array(platformArb, { minLength: 1, maxLength: 4 })),
        themes: fc.oneof(fc.constant(undefined), fc.array(themeArb, { minLength: 1, maxLength: 5 })),
        frequency: fc.oneof(fc.constant(undefined), frequencyArb)
      })
    );

    const internalAssetAssociationArb = fc.record({
      type: fc.constant('internal'),
      assetId: assetIdArb,
      usageIntent: usageIntentArb,
      isDefault: fc.boolean(),
      category: fc.oneof(fc.constant(null), categoryArb),
      addedAt: timestampArb,
      addedBy: userIdArb
    });

    const externalAssetAssociationArb = fc.record({
      type: fc.constant('external'),
      url: urlArb,
      description: descriptionArb,
      contentType: fc.constantFrom('image/jpeg', 'image/png', 'video/mp4'),
      usageIntent: usageIntentArb,
      isDefault: fc.boolean(),
      category: fc.oneof(fc.constant(null), categoryArb),
      addedAt: timestampArb,
      addedBy: userIdArb
    });

    const brandAssetAssociationArb = fc.oneof(
      internalAssetAssociationArb,
      externalAssetAssociationArb
    );

    const assetsArrayArb = fc.array(brandAssetAssociationArb, { minLength: 0, maxLength: 50 });

    it('should accept both internal and external asset associations', () => {
      fc.assert(
        fc.property(assetsArrayArb, (assets) => {
          const result = BrandAssetAssociationSchema.array().max(50).safeParse(assets);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should validate internal asset structure with required fields', () => {
      fc.assert(
        fc.property(internalAssetAssociationArb, (asset) => {
          const result = BrandAssetAssociationSchema.safeParse(asset);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.type).toBe('internal');
            expect(result.data).toHaveProperty('assetId');
            expect(result.data).toHaveProperty('addedAt');
            expect(result.data).toHaveProperty('addedBy');
            expect(typeof result.data.isDefault).toBe('boolean');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should validate external asset HTTPS URLs and required metadata', () => {
      fc.assert(
        fc.property(externalAssetAssociationArb, (asset) => {
          const result = BrandAssetAssociationSchema.safeParse(asset);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.type).toBe('external');
            expect(result.data.url).toMatch(/^https:\/\//);
            expect(result.data.description.length).toBeGreaterThanOrEqual(10);
            expect(result.data.description.length).toBeLessThanOrEqual(500);
            expect(result.data).toHaveProperty('contentType');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should calculate assetLibraryStats correctly for any asset array', () => {
      fc.assert(
        fc.property(assetsArrayArb, timestampArb, (assets, timestamp) => {
          const stats = Brand._calculateAssetLibraryStats(assets, timestamp);

          if (assets.length === 0) {
            expect(stats).toBeNull();
          } else {
            expect(stats).not.toBeNull();
            expect(stats.totalAssets).toBe(assets.length);
            expect(stats.internalAssets).toBe(assets.filter(a => a.type === 'internal').length);
            expect(stats.externalAssets).toBe(assets.filter(a => a.type === 'external').length);
            expect(stats.defaultAssets).toBe(assets.filter(a => a.isDefault === true).length);
            expect(stats.lastUpdated).toBe(timestamp);
            expect(stats.totalAssets).toBe(stats.internalAssets + stats.externalAssets);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should enforce maximum of 50 assets per brand', () => {
      fc.assert(
        fc.property(
          fc.array(brandAssetAssociationArb, { minLength: 51, maxLength: 100 }),
          (assets) => {
            const result = BrandAssetAssociationSchema.array().max(50).safeParse(assets);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
