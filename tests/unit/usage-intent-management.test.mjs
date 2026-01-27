import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { Brand } from '../../models/brand.mjs';

vi.mock('@aws-sdk/client-dynamodb');
vi.mock('../../utils/logger.mjs', () => ({
  brandLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}));

describe('Property 3: Usage Intent Management', () => {
  describe('**Feature: brand-asset-ux-integration, Property 3: Usage Intent Management**', () => {
    it('should accept optional usage intent fields, store them, and preserve through round-trip operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            platforms: fc.option(fc.array(fc.constantFrom('twitter', 'linkedin', 'instagram', 'facebook'), { minLength: 1, maxLength: 4 })),
            themes: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0), { minLength: 1, maxLength: 5 })),
            frequency: fc.option(fc.constantFrom('high', 'medium', 'low'))
          }),
          fc.constantFrom('internal', 'external'),
          async (usageIntent, assetType) => {
            const hasAnyUsageIntent = usageIntent.platforms !== null || usageIntent.themes !== null || usageIntent.frequency !== null;
            const finalUsageIntent = hasAnyUsageIntent ? {
              ...(usageIntent.platforms !== null && { platforms: usageIntent.platforms }),
              ...(usageIntent.themes !== null && { themes: usageIntent.themes }),
              ...(usageIntent.frequency !== null && { frequency: usageIntent.frequency })
            } : null;

            const asset = assetType === 'internal'
              ? {
                  type: 'internal',
                  assetId: 'asset_test_123',
                  usageIntent: finalUsageIntent,
                  isDefault: false,
                  categories: null,
                  addedAt: '2024-01-01T00:00:00Z',
                  addedBy: 'user_test'
                }
              : {
                  type: 'external',
                  url: 'https://example.com/image.jpg',
                  description: 'Test external asset description',
                  contentType: 'image/jpeg',
                  usageIntent: finalUsageIntent,
                  isDefault: false,
                  categories: null,
                  addedAt: '2024-01-01T00:00:00Z',
                  addedBy: 'user_test'
                };

            const brandData = {
              name: 'Test Brand',
              ethos: 'Test brand ethos',
              coreValues: ['value1', 'value2'],
              primaryAudience: 'professionals',
              voiceGuidelines: {
                tone: ['professional'],
                style: ['clear'],
                messaging: ['direct']
              },
              visualIdentity: {
                colorPalette: ['#000000'],
                typography: ['Arial'],
                imagery: ['modern']
              },
              contentStandards: {
                qualityRequirements: ['high quality'],
                restrictions: []
              },
              assets: [asset]
            };

            const validatedBrand = Brand.validateEntity({
              ...brandData,
              brandId: 'brand_test_123',
              tenantId: 'tenant_test',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              status: 'active',
              assetLibraryStats: {
                totalAssets: 1,
                internalAssets: assetType === 'internal' ? 1 : 0,
                externalAssets: assetType === 'external' ? 1 : 0,
                defaultAssets: 0,
                lastUpdated: '2024-01-01T00:00:00Z'
              }
            });

            expect(validatedBrand.assets).toHaveLength(1);
            const storedAsset = validatedBrand.assets[0];

            if (finalUsageIntent === null) {
              expect(storedAsset.usageIntent).toBeNull();
            } else {
              expect(storedAsset.usageIntent).toBeDefined();

              if (usageIntent.platforms !== null) {
                expect(storedAsset.usageIntent.platforms).toEqual(usageIntent.platforms);
              } else {
                expect(storedAsset.usageIntent.platforms).toBeUndefined();
              }

              if (usageIntent.themes !== null) {
                expect(storedAsset.usageIntent.themes).toEqual(usageIntent.themes.map(t => t.trim()));
              } else {
                expect(storedAsset.usageIntent.themes).toBeUndefined();
              }

              if (usageIntent.frequency !== null) {
                expect(storedAsset.usageIntent.frequency).toEqual(usageIntent.frequency);
              } else {
                expect(storedAsset.usageIntent.frequency).toBeUndefined();
              }
            }

            const transformedToDDB = Brand.transformToDynamoDB('tenant_test', validatedBrand);
            expect(transformedToDDB.assets).toHaveLength(1);

            const ddbAsset = transformedToDDB.assets[0];
            if (finalUsageIntent === null) {
              expect(ddbAsset.usageIntent).toBeNull();
            } else {
              expect(ddbAsset.usageIntent).toEqual(storedAsset.usageIntent);
            }

            const transformedFromDDB = Brand.transformFromDynamoDB(transformedToDDB);
            expect(transformedFromDDB.assets).toHaveLength(1);

            const roundTripAsset = transformedFromDDB.assets[0];
            if (finalUsageIntent === null) {
              expect(roundTripAsset.usageIntent).toBeNull();
            } else {
              expect(roundTripAsset.usageIntent).toEqual(storedAsset.usageIntent);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
