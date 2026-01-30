import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { BrandAssetAssociationSchema } from '../../models/brand.mjs';

vi.mock('@aws-sdk/client-dynamodb');
vi.mock('../../utils/logger.mjs', () => ({
  logger: {
    error: vi.fn()
  }
}));

describe('Feature: brand-asset-ux-integration, Property 8: Asset Categorization', () => {
  describe('**Validates: Requirements 12.1, 12.2, 12.3**', () => {
    const assetIdArb = fc.string({ minLength: 10, maxLength: 20 }).map(s => `asset_${s}`);
    const urlArb = fc.webUrl({ validSchemes: ['https'] });
    const timestampArb = fc.date().map(d => d.toISOString());
    const userIdArb = fc.string({ minLength: 10, maxLength: 20 }).map(s => `user_${s}`);
    const categoryArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);
    const descriptionArb = fc.string({ minLength: 10, maxLength: 500 }).filter(s => s.trim().length >= 10);

    const categoriesArb = fc.oneof(
      fc.constant(null),
      fc.array(categoryArb, { minLength: 1, maxLength: 10 })
    );

    const internalAssetWithCategoriesArb = fc.record({
      type: fc.constant('internal'),
      assetId: assetIdArb,
      usageIntent: fc.constant(null),
      isDefault: fc.boolean(),
      categories: categoriesArb,
      addedAt: timestampArb,
      addedBy: userIdArb
    });

    const externalAssetWithCategoriesArb = fc.record({
      type: fc.constant('external'),
      url: urlArb,
      description: descriptionArb,
      contentType: fc.constantFrom('image/jpeg', 'image/png', 'video/mp4'),
      usageIntent: fc.constant(null),
      isDefault: fc.boolean(),
      categories: categoriesArb,
      addedAt: timestampArb,
      addedBy: userIdArb
    });

    const assetWithCategoriesArb = fc.oneof(
      internalAssetWithCategoriesArb,
      externalAssetWithCategoriesArb
    );

    it('should accept optional categories field in asset associations', () => {
      fc.assert(
        fc.property(assetWithCategoriesArb, (asset) => {
          const result = BrandAssetAssociationSchema.safeParse(asset);
          expect(result.success).toBe(true);
          if (result.success) {
            if (asset.categories !== null && asset.categories !== undefined) {
              expect(result.data).toHaveProperty('categories');
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should support multiple categories per asset up to 10', () => {
      fc.assert(
        fc.property(
          fc.array(categoryArb, { minLength: 1, maxLength: 10 }),
          assetIdArb,
          timestampArb,
          userIdArb,
          (categories, assetId, timestamp, userId) => {
            const asset = {
              type: 'internal',
              assetId,
              usageIntent: null,
              isDefault: false,
              categories,
              addedAt: timestamp,
              addedBy: userId
            };

            const result = BrandAssetAssociationSchema.safeParse(asset);
            expect(result.success).toBe(true);
            if (result.success) {
              expect(result.data.categories).toHaveLength(categories.length);
              const trimmedCategories = categories.map(c => c.trim());
              expect(result.data.categories).toEqual(trimmedCategories);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject more than 10 categories per asset', () => {
      fc.assert(
        fc.property(
          fc.array(categoryArb, { minLength: 11, maxLength: 20 }),
          assetIdArb,
          timestampArb,
          userIdArb,
          (categories, assetId, timestamp, userId) => {
            const asset = {
              type: 'internal',
              assetId,
              usageIntent: null,
              isDefault: false,
              categories,
              addedAt: timestamp,
              addedBy: userId
            };

            const result = BrandAssetAssociationSchema.safeParse(asset);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve categories through round-trip operations', () => {
      fc.assert(
        fc.property(assetWithCategoriesArb, (asset) => {
          const parseResult = BrandAssetAssociationSchema.safeParse(asset);
          expect(parseResult.success).toBe(true);

          if (parseResult.success) {
            const parsedAsset = parseResult.data;
            const secondParseResult = BrandAssetAssociationSchema.safeParse(parsedAsset);
            expect(secondParseResult.success).toBe(true);

            if (secondParseResult.success) {
              expect(secondParseResult.data.categories).toEqual(parsedAsset.categories);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should validate category strings are non-empty and within length limits', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 10 }),
          assetIdArb,
          timestampArb,
          userIdArb,
          (categories, assetId, timestamp, userId) => {
            const validCategories = categories.filter(c => c.trim().length > 0);

            const asset = {
              type: 'internal',
              assetId,
              usageIntent: null,
              isDefault: false,
              categories: validCategories,
              addedAt: timestamp,
              addedBy: userId
            };

            const result = BrandAssetAssociationSchema.safeParse(asset);
            expect(result.success).toBe(true);
            if (result.success) {
              result.data.categories?.forEach(category => {
                expect(category.length).toBeGreaterThan(0);
                expect(category.length).toBeLessThanOrEqual(100);
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
