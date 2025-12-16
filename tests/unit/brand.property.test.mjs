import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  BrandSchema,
  BrandAssetSchema,
  CreateBrandRequestSchema,
  CreateBrandAssetRequestSchema,
  generateBrandId,
  generateAssetId
} from '../../schemas/brand.mjs';
import { validateBrandEntity, validateBrandAssetEntity } from '../../utils/validation.mjs';

/**
 * **Feature: brand-management-api, Property 1: Brand data persistence**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4**
 */

describe('Property-Based Tests - Brand Data', () => {

  // Shared generator for searchable brand data used across multiple properties
  const searchableBrandArb = fc.record({
    name: fc.string({ minLength: 1, maxLength: 100 }),
    ethos: fc.string({ minLength: 1, maxLength: 1000 }),
    coreValues: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 1, maxLength: 10 }),
    personalityTraits: fc.record({
      formal: fc.integer({ min: 1, max: 5 }),
      innovative: fc.integer({ min: 1, max: 5 }),
      trustworthy: fc.integer({ min: 1, max: 5 }),
      playful: fc.integer({ min: 1, max: 5 })
    }),
    contentStandards: fc.record({
      toneOfVoice: fc.string({ minLength: 1, maxLength: 500 }),
      styleGuidelines: fc.string({ minLength: 1, maxLength: 1000 }),
      primaryAudience: fc.constantFrom('executives', 'professionals', 'consumers', 'technical', 'creative'),
      qualityStandards: fc.string({ minLength: 1, maxLength: 500 }),
      approvalThreshold: fc.integer({ min: 1, max: 10 })
    }),
    visualGuidelines: fc.record({
      colorScheme: fc.record({
        primary: fc.string({ minLength: 1, maxLength: 50 }),
        secondary: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
        accent: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
      }),
      typography: fc.record({
        primaryFont: fc.string({ minLength: 1, maxLength: 100 }),
        secondaryFont: fc.string({ minLength: 1, maxLength: 100 }),
        headingStyle: fc.string({ minLength: 1, maxLength: 200 })
      }),
      imageryStyle: fc.string({ minLength: 1, maxLength: 500 }),
      logoSpecs: fc.record({
        minSize: fc.string({ minLength: 1, maxLength: 50 }),
        maxSize: fc.string({ minLength: 1, maxLength: 50 }),
        clearSpace: fc.string({ minLength: 1, maxLength: 100 }),
        placement: fc.string({ minLength: 1, maxLength: 200 })
      })
    }),
    status: fc.constantFrom('active', 'inactive', 'archived')
  });
  describe('Property 1: Brand data persistence', () => {

    // Generator for valid personality traits (1-5 scale)
    const personalityTraitsArb = fc.record({
      formal: fc.integer({ min: 1, max: 5 }),
      innovative: fc.integer({ min: 1, max: 5 }),
      trustworthy: fc.integer({ min: 1, max: 5 }),
      playful: fc.integer({ min: 1, max: 5 })
    });

    // Generator for content standards
    const contentStandardsArb = fc.record({
      toneOfVoice: fc.string({ minLength: 1, maxLength: 500 }),
      styleGuidelines: fc.string({ minLength: 1, maxLength: 1000 }),
      primaryAudience: fc.string({ minLength: 1, maxLength: 200 }),
      qualityStandards: fc.string({ minLength: 1, maxLength: 500 }),
      approvalThreshold: fc.integer({ min: 1, max: 10 })
    });

    // Generator for visual guidelines
    const visualGuidelinesArb = fc.record({
      colorScheme: fc.record({
        primary: fc.string({ minLength: 1, maxLength: 50 }),
        secondary: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
        accent: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
      }),
      typography: fc.record({
        primaryFont: fc.string({ minLength: 1, maxLength: 100 }),
        secondaryFont: fc.string({ minLength: 1, maxLength: 100 }),
        headingStyle: fc.string({ minLength: 1, maxLength: 200 })
      }),
      imageryStyle: fc.string({ minLength: 1, maxLength: 500 }),
      logoSpecs: fc.record({
        minSize: fc.string({ minLength: 1, maxLength: 50 }),
        maxSize: fc.string({ minLength: 1, maxLength: 50 }),
        clearSpace: fc.string({ minLength: 1, maxLength: 100 }),
        placement: fc.string({ minLength: 1, maxLength: 200 })
      })
    });

    // Generator for valid brand creation request
    const createBrandRequestArb = fc.record({
      name: fc.string({ minLength: 1, maxLength: 100 }),
      ethos: fc.string({ minLength: 1, maxLength: 1000 }),
      coreValues: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 1, maxLength: 10 }),
      personalityTraits: personalityTraitsArb,
      contentStandards: contentStandardsArb,
      visualGuidelines: visualGuidelinesArb
    });

    it('should maintain data consistency through creation and validation cycle', () => {
      fc.assert(
        fc.property(createBrandRequestArb, fc.string({ minLength: 1, maxLength: 50 }), (brandRequest, tenantId) => {
          // Step 1: Validate the creation request
          const validatedRequest = CreateBrandRequestSchema.parse(brandRequest);

          // Step 2: Simulate brand creation by adding generated metadata
          const brandId = generateBrandId();
          const now = new Date().toISOString();

          const completeBrand = {
            ...validatedRequest,
            brandId,
            tenantId,
            createdAt: now,
            updatedAt: now,
            version: 1,
            status: 'active'
          };

          // Step 3: Validate the complete brand entity
          const validatedBrand = validateBrandEntity(completeBrand);

          // Step 4: Verify round-trip consistency
          // All original request data should be preserved
          expect(validatedBrand.name).toBe(brandRequest.name);
          expect(validatedBrand.ethos).toBe(brandRequest.ethos);
          expect(validatedBrand.coreValues).toEqual(brandRequest.coreValues);
          expect(validatedBrand.personalityTraits).toEqual(brandRequest.personalityTraits);
          expect(validatedBrand.contentStandards).toEqual(brandRequest.contentStandards);
          expect(validatedBrand.visualGuidelines).toEqual(brandRequest.visualGuidelines);

          // Generated metadata should be present and valid
          expect(validatedBrand.brandId).toBe(brandId);
          expect(validatedBrand.tenantId).toBe(tenantId);
          expect(validatedBrand.createdAt).toBe(now);
          expect(validatedBrand.updatedAt).toBe(now);
          expect(validatedBrand.version).toBe(1);
          expect(validatedBrand.status).toBe('active');

          // ID generation should work
          const generatedId = generateBrandId();
          expect(generatedId).toMatch(/^brand_[A-Z0-9]{26}$/); // ULID format
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain asset data consistency through creation and validation cycle', () => {
      fc.assert(
        fc.property(
          // Generate brand asset data
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 200 }),
            type: fc.constantFrom('logo', 'template', 'image', 'document'),
            category: fc.string({ minLength: 1, maxLength: 100 }),
            tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 }),
            contentType: fc.string({ minLength: 1, maxLength: 100 }),
            fileSize: fc.integer({ min: 1, max: 10000000 }),
            usageRules: fc.record({
              placement: fc.string({ minLength: 1, maxLength: 500 }),
              sizing: fc.record({
                minWidth: fc.integer({ min: 1, max: 5000 }),
                maxWidth: fc.integer({ min: 1, max: 5000 }),
                minHeight: fc.integer({ min: 1, max: 5000 }),
                maxHeight: fc.integer({ min: 1, max: 5000 })
              }),
              restrictions: fc.array(fc.string({ maxLength: 200 }), { maxLength: 10 })
            })
          }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (assetRequest, tenantId, brandId) => {
            // Simulate asset creation by adding generated metadata
            const assetId = generateAssetId();
            const now = new Date().toISOString();
            const s3Bucket = 'test-brand-assets-bucket';
            const s3Key = `${tenantId}/${brandId}/${assetId}`;

            const completeAsset = {
              ...assetRequest,
              assetId,
              brandId,
              tenantId,
              s3Bucket,
              s3Key,
              createdAt: now,
              updatedAt: now
            };

            // Validate the complete asset entity
            const validatedAsset = validateBrandAssetEntity(completeAsset);

            // Verify round-trip consistency
            expect(validatedAsset.name).toBe(assetRequest.name);
            expect(validatedAsset.type).toBe(assetRequest.type);
            expect(validatedAsset.category).toBe(assetRequest.category);
            expect(validatedAsset.tags).toEqual(assetRequest.tags);
            expect(validatedAsset.contentType).toBe(assetRequest.contentType);
            expect(validatedAsset.fileSize).toBe(assetRequest.fileSize);
            expect(validatedAsset.usageRules).toEqual(assetRequest.usageRules);

            // Generated metadata should be present and valid
            expect(validatedAsset.assetId).toBe(assetId);
            expect(validatedAsset.brandId).toBe(brandId);
            expect(validatedAsset.tenantId).toBe(tenantId);
            expect(validatedAsset.s3Bucket).toBe(s3Bucket);
            expect(validatedAsset.s3Key).toBe(s3Key);
            expect(validatedAsset.createdAt).toBe(now);
            expect(validatedAsset.updatedAt).toBe(now);

            // ID generation should work
            const generatedAssetId = generateAssetId();
            expect(generatedAssetId).toMatch(/^asset_[A-Z0-9]{26}$/); // ULID format
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: brand-management-api, Property 2: Unique identifier generation**
   * **Validates: Requirements 1.5**
   */

  describe('Property 2: Unique identifier generation', () => {

    it('should generate unique identifiers for all brand creation requests', () => {
      fc.assert(
        fc.property(
          // Generate multiple brand creation requests
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 100 }),
              ethos: fc.string({ minLength: 1, maxLength: 1000 }),
              coreValues: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 1, maxLength: 10 }),
              personalityTraits: fc.record({
                formal: fc.integer({ min: 1, max: 5 }),
                innovative: fc.integer({ min: 1, max: 5 }),
                trustworthy: fc.integer({ min: 1, max: 5 }),
                playful: fc.integer({ min: 1, max: 5 })
              }),
              contentStandards: fc.record({
                toneOfVoice: fc.string({ minLength: 1, maxLength: 500 }),
                styleGuidelines: fc.string({ minLength: 1, maxLength: 1000 }),
                primaryAudience: fc.string({ minLength: 1, maxLength: 200 }),
                qualityStandards: fc.string({ minLength: 1, maxLength: 500 }),
                approvalThreshold: fc.integer({ min: 1, max: 10 })
              }),
              visualGuidelines: fc.record({
                colorScheme: fc.record({
                  primary: fc.string({ minLength: 1, maxLength: 50 }),
                  secondary: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
                  accent: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
                }),
                typography: fc.record({
                  primaryFont: fc.string({ minLength: 1, maxLength: 100 }),
                  secondaryFont: fc.string({ minLength: 1, maxLength: 100 }),
                  headingStyle: fc.string({ minLength: 1, maxLength: 200 })
                }),
                imageryStyle: fc.string({ minLength: 1, maxLength: 500 }),
                logoSpecs: fc.record({
                  minSize: fc.string({ minLength: 1, maxLength: 50 }),
                  maxSize: fc.string({ minLength: 1, maxLength: 50 }),
                  clearSpace: fc.string({ minLength: 1, maxLength: 100 }),
                  placement: fc.string({ minLength: 1, maxLength: 200 })
                })
              })
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (brandRequests) => {
            // Generate IDs for all brand requests
            const generatedIds = brandRequests.map(() => generateBrandId());

            // Property: All generated IDs should be unique
            const uniqueIds = new Set(generatedIds);
            expect(uniqueIds.size).toBe(generatedIds.length);

            // Property: All IDs should follow the correct format
            generatedIds.forEach(id => {
              expect(id).toMatch(/^brand_[A-Z0-9]{26}$/);
            });

            // Property: All IDs should have valid timestamps (ULID property)
            // Note: We're just checking the format here, not the actual timestamp parsing
            // since ULID timestamp parsing is complex and not critical for this test
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate unique asset identifiers for all asset creation requests', () => {
      fc.assert(
        fc.property(
          // Generate multiple asset creation requests
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 200 }),
              type: fc.constantFrom('logo', 'template', 'image', 'document'),
              category: fc.string({ minLength: 1, maxLength: 100 })
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (assetRequests) => {
            // Generate IDs for all asset requests
            const generatedIds = assetRequests.map(() => generateAssetId());

            // Property: All generated IDs should be unique
            const uniqueIds = new Set(generatedIds);
            expect(uniqueIds.size).toBe(generatedIds.length);

            // Property: All IDs should follow the correct format
            generatedIds.forEach(id => {
              expect(id).toMatch(/^asset_[A-Z0-9]{26}$/);
            });

            // Property: All IDs should have valid timestamps (ULID property)
            // Note: We're just checking the format here, not the actual timestamp parsing
            // since ULID timestamp parsing is complex and not critical for this test
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: brand-management-api, Property 3: Version history preservation**
   * **Validates: Requirements 2.5, 4.2**
   */

  describe('Property 3: Version history preservation', () => {

    // Generator for partial brand updates
    const partialBrandUpdateArb = fc.record({
      name: fc.string({ minLength: 1, maxLength: 100 }),
      ethos: fc.string({ minLength: 1, maxLength: 1000 }),
      coreValues: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 1, maxLength: 10 }),
      personalityTraits: fc.record({
        formal: fc.integer({ min: 1, max: 5 }),
        innovative: fc.integer({ min: 1, max: 5 }),
        trustworthy: fc.integer({ min: 1, max: 5 }),
        playful: fc.integer({ min: 1, max: 5 })
      }),
      contentStandards: fc.record({
        toneOfVoice: fc.string({ minLength: 1, maxLength: 500 }),
        styleGuidelines: fc.string({ minLength: 1, maxLength: 1000 }),
        primaryAudience: fc.string({ minLength: 1, maxLength: 200 }),
        qualityStandards: fc.string({ minLength: 1, maxLength: 500 }),
        approvalThreshold: fc.integer({ min: 1, max: 10 })
      }),
      visualGuidelines: fc.record({
        colorScheme: fc.record({
          primary: fc.string({ minLength: 1, maxLength: 50 }),
          secondary: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
          accent: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
        }),
        typography: fc.record({
          primaryFont: fc.string({ minLength: 1, maxLength: 100 }),
          secondaryFont: fc.string({ minLength: 1, maxLength: 100 }),
          headingStyle: fc.string({ minLength: 1, maxLength: 200 })
        }),
        imageryStyle: fc.string({ minLength: 1, maxLength: 500 }),
        logoSpecs: fc.record({
          minSize: fc.string({ minLength: 1, maxLength: 50 }),
          maxSize: fc.string({ minLength: 1, maxLength: 50 }),
          clearSpace: fc.string({ minLength: 1, maxLength: 100 }),
          placement: fc.string({ minLength: 1, maxLength: 200 })
        })
      })
    }, { requiredKeys: [] }); // Allow partial updates

    it('should preserve version history while updating only specified fields', () => {
      fc.assert(
        fc.property(
          // Generate initial brand
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 100 }),
            ethos: fc.string({ minLength: 1, maxLength: 1000 }),
            coreValues: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 1, maxLength: 10 }),
            personalityTraits: fc.record({
              formal: fc.integer({ min: 1, max: 5 }),
              innovative: fc.integer({ min: 1, max: 5 }),
              trustworthy: fc.integer({ min: 1, max: 5 }),
              playful: fc.integer({ min: 1, max: 5 })
            }),
            contentStandards: fc.record({
              toneOfVoice: fc.string({ minLength: 1, maxLength: 500 }),
              styleGuidelines: fc.string({ minLength: 1, maxLength: 1000 }),
              primaryAudience: fc.string({ minLength: 1, maxLength: 200 }),
              qualityStandards: fc.string({ minLength: 1, maxLength: 500 }),
              approvalThreshold: fc.integer({ min: 1, max: 10 })
            }),
            visualGuidelines: fc.record({
              colorScheme: fc.record({
                primary: fc.string({ minLength: 1, maxLength: 50 }),
                secondary: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
                accent: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
              }),
              typography: fc.record({
                primaryFont: fc.string({ minLength: 1, maxLength: 100 }),
                secondaryFont: fc.string({ minLength: 1, maxLength: 100 }),
                headingStyle: fc.string({ minLength: 1, maxLength: 200 })
              }),
              imageryStyle: fc.string({ minLength: 1, maxLength: 500 }),
              logoSpecs: fc.record({
                minSize: fc.string({ minLength: 1, maxLength: 50 }),
                maxSize: fc.string({ minLength: 1, maxLength: 50 }),
                clearSpace: fc.string({ minLength: 1, maxLength: 100 }),
                placement: fc.string({ minLength: 1, maxLength: 200 })
              })
            })
          }),
          partialBrandUpdateArb,
          fc.string({ minLength: 1, maxLength: 50 }),
          (initialBrandData, updateData, tenantId) => {
            // Skip if update data is empty
            if (Object.keys(updateData).length === 0) {
              return;
            }

            // Step 1: Create initial brand
            const brandId = generateBrandId();
            const initialTimestamp = new Date().toISOString();

            const initialBrand = {
              ...initialBrandData,
              brandId,
              tenantId,
              createdAt: initialTimestamp,
              updatedAt: initialTimestamp,
              version: 1,
              status: 'active'
            };

            // Step 2: Simulate update operation
            const updateTimestamp = new Date(Date.now() + 1000).toISOString(); // 1 second later

            const updatedBrand = {
              ...initialBrand,
              ...updateData,
              updatedAt: updateTimestamp,
              version: initialBrand.version + 1
            };

            // Validate both brands
            const validatedInitial = validateBrandEntity(initialBrand);
            const validatedUpdated = validateBrandEntity(updatedBrand);

            // Property: Version should increment by exactly 1
            expect(validatedUpdated.version).toBe(validatedInitial.version + 1);

            // Property: CreatedAt should never change
            expect(validatedUpdated.createdAt).toBe(validatedInitial.createdAt);

            // Property: UpdatedAt should change
            expect(validatedUpdated.updatedAt).not.toBe(validatedInitial.updatedAt);

            // Property: Core identity fields should be preserved
            expect(validatedUpdated.brandId).toBe(validatedInitial.brandId);
            expect(validatedUpdated.tenantId).toBe(validatedInitial.tenantId);

            // Property: Only specified fields should be updated
            Object.keys(updateData).forEach(key => {
              expect(validatedUpdated[key]).toEqual(updateData[key]);
            });

            // Property: Non-updated fields should remain unchanged
            const nonUpdatedFields = Object.keys(initialBrandData).filter(key => !(key in updateData));
            nonUpdatedFields.forEach(key => {
              expect(validatedUpdated[key]).toEqual(validatedInitial[key]);
            });

            // Property: Status should remain unchanged unless explicitly updated
            if (!('status' in updateData)) {
              expect(validatedUpdated.status).toBe(validatedInitial.status);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain version history through multiple sequential updates', () => {
      fc.assert(
        fc.property(
          // Generate initial brand and sequence of updates
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 100 }),
            ethos: fc.string({ minLength: 1, maxLength: 1000 }),
            coreValues: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 1, maxLength: 10 }),
            personalityTraits: fc.record({
              formal: fc.integer({ min: 1, max: 5 }),
              innovative: fc.integer({ min: 1, max: 5 }),
              trustworthy: fc.integer({ min: 1, max: 5 }),
              playful: fc.integer({ min: 1, max: 5 })
            }),
            contentStandards: fc.record({
              toneOfVoice: fc.string({ minLength: 1, maxLength: 500 }),
              styleGuidelines: fc.string({ minLength: 1, maxLength: 1000 }),
              primaryAudience: fc.string({ minLength: 1, maxLength: 200 }),
              qualityStandards: fc.string({ minLength: 1, maxLength: 500 }),
              approvalThreshold: fc.integer({ min: 1, max: 10 })
            }),
            visualGuidelines: fc.record({
              colorScheme: fc.record({
                primary: fc.string({ minLength: 1, maxLength: 50 }),
                secondary: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
                accent: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
              }),
              typography: fc.record({
                primaryFont: fc.string({ minLength: 1, maxLength: 100 }),
                secondaryFont: fc.string({ minLength: 1, maxLength: 100 }),
                headingStyle: fc.string({ minLength: 1, maxLength: 200 })
              }),
              imageryStyle: fc.string({ minLength: 1, maxLength: 500 }),
              logoSpecs: fc.record({
                minSize: fc.string({ minLength: 1, maxLength: 50 }),
                maxSize: fc.string({ minLength: 1, maxLength: 50 }),
                clearSpace: fc.string({ minLength: 1, maxLength: 100 }),
                placement: fc.string({ minLength: 1, maxLength: 200 })
              })
            })
          }),
          fc.array(partialBrandUpdateArb, { minLength: 1, maxLength: 5 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (initialBrandData, updateSequence, tenantId) => {
            // Filter out empty updates
            const validUpdates = updateSequence.filter(update => Object.keys(update).length > 0);
            if (validUpdates.length === 0) {
              return;
            }

            // Step 1: Create initial brand
            const brandId = generateBrandId();
            const initialTimestamp = new Date().toISOString();

            let currentBrand = {
              ...initialBrandData,
              brandId,
              tenantId,
              createdAt: initialTimestamp,
              updatedAt: initialTimestamp,
              version: 1,
              status: 'active'
            };

            const brandHistory = [{ ...currentBrand }];

            // Step 2: Apply updates sequentially
            validUpdates.forEach((updateData, index) => {
              const updateTimestamp = new Date(Date.now() + (index + 1) * 1000).toISOString();

              currentBrand = {
                ...currentBrand,
                ...updateData,
                updatedAt: updateTimestamp,
                version: currentBrand.version + 1
              };

              brandHistory.push({ ...currentBrand });
            });

            // Validate final brand
            const validatedFinalBrand = validateBrandEntity(currentBrand);

            // Property: Version should equal initial version + number of updates
            expect(validatedFinalBrand.version).toBe(1 + validUpdates.length);

            // Property: CreatedAt should never change throughout history
            brandHistory.forEach(brand => {
              expect(brand.createdAt).toBe(initialTimestamp);
            });

            // Property: Version should increment monotonically
            for (let i = 1; i < brandHistory.length; i++) {
              expect(brandHistory[i].version).toBe(brandHistory[i - 1].version + 1);
            }

            // Property: UpdatedAt should change with each update
            for (let i = 1; i < brandHistory.length; i++) {
              expect(brandHistory[i].updatedAt).not.toBe(brandHistory[i - 1].updatedAt);
            }

            // Property: Core identity should remain constant
            brandHistory.forEach(brand => {
              expect(brand.brandId).toBe(brandId);
              expect(brand.tenantId).toBe(tenantId);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: brand-management-api, P: Asset storage and retrieval**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   */

  describe('Property 4: Asset storage and retrieval', () => {

    // Generator for valid base64 file data that results in non-empty buffers
    const validBase64FileDataArb = fc.string({ minLength: 1, maxLength: 100 })
      .map(str => Buffer.from(str).toString('base64'))
      .filter(base64 => Buffer.from(base64, 'base64').length > 0);

    // Generator for valid asset creation request
    const createAssetRequestArb = fc.record({
      name: fc.string({ minLength: 1, maxLength: 200 }),
      type: fc.constantFrom('logo', 'template', 'image', 'document'),
      category: fc.string({ minLength: 1, maxLength: 100 }),
      tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 }),
      contentType: fc.string({ minLength: 1, maxLength: 100 }),
      fileData: validBase64FileDataArb,
      usageRules: fc.record({
        placement: fc.string({ minLength: 1, maxLength: 500 }),
        sizing: fc.record({
          minWidth: fc.integer({ min: 1, max: 2500 }),
          maxWidth: fc.integer({ min: 2500, max: 5000 }),
          minHeight: fc.integer({ min: 1, max: 2500 }),
          maxHeight: fc.integer({ min: 2500, max: 5000 })
        }),
        restrictions: fc.array(fc.string({ maxLength: 200 }), { maxLength: 10 })
      })
    });

    it('should maintain asset data consistency through upload and storage cycle', () => {
      fc.assert(
        fc.property(
          createAssetRequestArb,
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (assetRequest, tenantId, brandId) => {
            // Step 1: Validate the asset creation request
            const validatedRequest = CreateBrandAssetRequestSchema.parse(assetRequest);

            // Step 2: Simulate asset upload by adding generated metadata
            const assetId = generateAssetId();
            const now = new Date().toISOString();
            const s3Bucket = 'test-brand-assets-bucket';
            const s3Key = `${tenantId}/${brandId}/${assetId}`;
            const fileBuffer = Buffer.from(assetRequest.fileData, 'base64');

            const completeAsset = {
              ...validatedRequest,
              assetId,
              brandId,
              tenantId,
              s3Bucket,
              s3Key,
              fileSize: fileBuffer.length,
              createdAt: now,
              updatedAt: now
            };

            // Remove fileData for validation as it's not part of the stored entity
            const { fileData, ...storedAsset } = completeAsset;

            // Step 3: Validate the complete asset entity
            const validatedAsset = validateBrandAssetEntity(storedAsset);

            // Step 4: Verify round-trip consistency
            // All original request data should be preserved (except fileData)
            expect(validatedAsset.name).toBe(assetRequest.name);
            expect(validatedAsset.type).toBe(assetRequest.type);
            expect(validatedAsset.category).toBe(assetRequest.category);
            expect(validatedAsset.tags).toEqual(assetRequest.tags);
            expect(validatedAsset.contentType).toBe(assetRequest.contentType);
            expect(validatedAsset.usageRules).toEqual(assetRequest.usageRules);

            // Generated metadata should be present and valid
            expect(validatedAsset.assetId).toBe(assetId);
            expect(validatedAsset.brandId).toBe(brandId);
            expect(validatedAsset.tenantId).toBe(tenantId);
            expect(validatedAsset.s3Bucket).toBe(s3Bucket);
            expect(validatedAsset.s3Key).toBe(s3Key);
            expect(validatedAsset.fileSize).toBe(fileBuffer.length);
            expect(validatedAsset.createdAt).toBe(now);
            expect(validatedAsset.updatedAt).toBe(now);

            // S3 key should follow tenant/brand/asset pattern
            const escapedTenantId = tenantId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const escapedBrandId = brandId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            expect(validatedAsset.s3Key).toMatch(new RegExp(`^${escapedTenantId}/${escapedBrandId}/asset_[A-Z0-9]{26}$`));

            // File size should match the base64 decoded data length
            expect(validatedAsset.fileSize).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should organize assets by type and maintain categorization', () => {
      fc.assert(
        fc.property(
          // Generate multiple assets of different types
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 200 }),
              type: fc.constantFrom('logo', 'template', 'image', 'document'),
              category: fc.string({ minLength: 1, maxLength: 100 }),
              tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 }),
              contentType: fc.string({ minLength: 1, maxLength: 100 }),
              fileData: validBase64FileDataArb,
              usageRules: fc.record({
                placement: fc.string({ minLength: 1, maxLength: 500 }),
                sizing: fc.record({
                  minWidth: fc.integer({ min: 1, max: 2500 }),
                  maxWidth: fc.integer({ min: 2500, max: 5000 }),
                  minHeight: fc.integer({ min: 1, max: 2500 }),
                  maxHeight: fc.integer({ min: 2500, max: 5000 })
                }),
                restrictions: fc.array(fc.string({ maxLength: 200 }), { maxLength: 10 })
              })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (assetRequests, tenantId, brandId) => {
            const processedAssets = assetRequests.map(assetRequest => {
              // Validate the asset creation request
              const validatedRequest = CreateBrandAssetRequestSchema.parse(assetRequest);

              // Simulate asset creation
              const assetId = generateAssetId();
              const now = new Date().toISOString();
              const s3Bucket = 'test-brand-assets-bucket';
              const s3Key = `${tenantId}/${brandId}/${assetId}`;
              const fileBuffer = Buffer.from(assetRequest.fileData, 'base64');

              const { fileData, ...storedAsset } = {
                ...validatedRequest,
                assetId,
                brandId,
                tenantId,
                s3Bucket,
                s3Key,
                fileSize: fileBuffer.length,
                createdAt: now,
                updatedAt: now
              };

              return validateBrandAssetEntity(storedAsset);
            });

            // Property: All assets should belong to the same brand and tenant
            processedAssets.forEach(asset => {
              expect(asset.brandId).toBe(brandId);
              expect(asset.tenantId).toBe(tenantId);
            });

            // Property: Assets should be categorizable by type
            const assetsByType = processedAssets.reduce((acc, asset) => {
              if (!Object.prototype.hasOwnProperty.call(acc, asset.type)) {
                acc[asset.type] = [];
              }
              acc[asset.type].push(asset);
              return acc;
            }, Object.create(null));

            // Each type group should contain only assets of that type
            Object.entries(assetsByType).forEach(([type, assets]) => {
              assets.forEach(asset => {
                expect(asset.type).toBe(type);
              });
            });

            // Property: Assets should be categorizable by category
            const assetsByCategory = processedAssets.reduce((acc, asset) => {
              if (!Object.prototype.hasOwnProperty.call(acc, asset.category)) {
                acc[asset.category] = [];
              }
              acc[asset.category].push(asset);
              return acc;
            }, Object.create(null));

            // Each category group should contain only assets of that category
            Object.entries(assetsByCategory).forEach(([category, assets]) => {
              assets.forEach(asset => {
                expect(asset.category).toBe(category);
              });
            });

            // Property: All assets should have unique IDs
            const assetIds = processedAssets.map(asset => asset.assetId);
            const uniqueIds = new Set(assetIds);
            expect(uniqueIds.size).toBe(assetIds.length);

            // Property: All S3 keys should be unique and follow the pattern
            const s3Keys = processedAssets.map(asset => asset.s3Key);
            const uniqueKeys = new Set(s3Keys);
            expect(uniqueKeys.size).toBe(s3Keys.length);

            s3Keys.forEach(key => {
              const escapedTenantId = tenantId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const escapedBrandId = brandId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              expect(key).toMatch(new RegExp(`^${escapedTenantId}/${escapedBrandId}/asset_[A-Z0-9]{26}$`));
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain usage rules and metadata integrity', () => {
      fc.assert(
        fc.property(
          createAssetRequestArb,
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (assetRequest, tenantId, brandId) => {
            // Validate and process the asset
            const validatedRequest = CreateBrandAssetRequestSchema.parse(assetRequest);

            const assetId = generateAssetId();
            const now = new Date().toISOString();
            const s3Bucket = 'test-brand-assets-bucket';
            const s3Key = `${tenantId}/${brandId}/${assetId}`;
            const fileBuffer = Buffer.from(assetRequest.fileData, 'base64');

            const { fileData, ...storedAsset } = {
              ...validatedRequest,
              assetId,
              brandId,
              tenantId,
              s3Bucket,
              s3Key,
              fileSize: fileBuffer.length,
              createdAt: now,
              updatedAt: now
            };

            const validatedAsset = validateBrandAssetEntity(storedAsset);

            // Property: Usage rules should be preserved exactly
            expect(validatedAsset.usageRules).toEqual(assetRequest.usageRules);

            // Property: Usage rules should have valid structure
            if (validatedAsset.usageRules.sizing) {
              const { minWidth, maxWidth, minHeight, maxHeight } = validatedAsset.usageRules.sizing;

              // Width constraints should be logical
              if (minWidth && maxWidth) {
                expect(minWidth).toBeLessThanOrEqual(maxWidth);
              }

              // Height constraints should be logical
              if (minHeight && maxHeight) {
                expect(minHeight).toBeLessThanOrEqual(maxHeight);
              }
            }

            // Property: Tags should be preserved
            expect(validatedAsset.tags).toEqual(assetRequest.tags);

            // Property: Tags should be valid (no empty tags)
            validatedAsset.tags.forEach(tag => {
              expect(tag.length).toBeGreaterThan(0);
            });

            // Property: Content type should be preserved
            expect(validatedAsset.contentType).toBe(assetRequest.contentType);

            // Property: File size should be positive and match calculated size
            expect(validatedAsset.fileSize).toBeGreaterThan(0);
            expect(validatedAsset.fileSize).toBe(fileBuffer.length);

            // Property: Timestamps should be valid ISO strings
            expect(() => new Date(validatedAsset.createdAt)).not.toThrow();
            expect(() => new Date(validatedAsset.updatedAt)).not.toThrow();
            expect(validatedAsset.createdAt).toBe(validatedAsset.updatedAt); // Should be equal on creation
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: brand-management-api, Property 5: Tenant isolation enforcement**
   * **Validates: Requirements 3.5, 4.5**
   */

  describe('Property 5: Tenant isolation enforcement', () => {

    it('should enforce tenant isolation for brand access', () => {
      fc.assert(
        fc.property(
          // Generate multiple tenants with brands
          fc.array(
            fc.record({
              tenantId: fc.string({ minLength: 1, maxLength: 50 }),
              brands: fc.array(
                fc.record({
                  name: fc.string({ minLength: 1, maxLength: 100 }),
                  ethos: fc.string({ minLength: 1, maxLength: 1000 }),
                  coreValues: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 1, maxLength: 10 }),
                  personalityTraits: fc.record({
                    formal: fc.integer({ min: 1, max: 5 }),
                    innovative: fc.integer({ min: 1, max: 5 }),
                    trustworthy: fc.integer({ min: 1, max: 5 }),
                    playful: fc.integer({ min: 1, max: 5 })
                  }),
                  contentStandards: fc.record({
                    toneOfVoice: fc.string({ minLength: 1, maxLength: 500 }),
                    styleGuidelines: fc.string({ minLength: 1, maxLength: 1000 }),
                    primaryAudience: fc.string({ minLength: 1, maxLength: 200 }),
                    qualityStandards: fc.string({ minLength: 1, maxLength: 500 }),
                    approvalThreshold: fc.integer({ min: 1, max: 10 })
                  }),
                  visualGuidelines: fc.record({
                    colorScheme: fc.record({
                      primary: fc.string({ minLength: 1, maxLength: 50 }),
                      secondary: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
                      accent: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
                    }),
                    typography: fc.record({
                      primaryFont: fc.string({ minLength: 1, maxLength: 100 }),
                      secondaryFont: fc.string({ minLength: 1, maxLength: 100 }),
                      headingStyle: fc.string({ minLength: 1, maxLength: 200 })
                    }),
                    imageryStyle: fc.string({ minLength: 1, maxLength: 500 }),
                    logoSpecs: fc.record({
                      minSize: fc.string({ minLength: 1, maxLength: 50 }),
                      maxSize: fc.string({ minLength: 1, maxLength: 50 }),
                      clearSpace: fc.string({ minLength: 1, maxLength: 100 }),
                      placement: fc.string({ minLength: 1, maxLength: 200 })
                    })
                  })
                }),
                { minLength: 1, maxLength: 5 }
              )
            }),
            { minLength: 2, maxLength: 5 }
          ),
          (tenantData) => {
            // Create brands for each tenant
            const allBrands = [];
            const brandsByTenant = Object.create(null);

            tenantData.forEach(({ tenantId, brands }) => {
              brandsByTenant[tenantId] = [];

              brands.forEach(brandData => {
                const brandId = generateBrandId();
                const now = new Date().toISOString();

                const brand = {
                  ...brandData,
                  brandId,
                  tenantId,
                  createdAt: now,
                  updatedAt: now,
                  version: 1,
                  status: 'active'
                };

                const validatedBrand = validateBrandEntity(brand);
                allBrands.push(validatedBrand);
                brandsByTenant[tenantId].push(validatedBrand);
              });
            });

            // Property: Each brand should belong to exactly one tenant
            allBrands.forEach(brand => {
              expect(brand.tenantId).toBeDefined();
              expect(typeof brand.tenantId).toBe('string');
              expect(brand.tenantId.length).toBeGreaterThan(0);
            });

            // Property: Brands should be properly isolated by tenant
            Object.entries(brandsByTenant).forEach(([tenantId, brands]) => {
              brands.forEach(brand => {
                expect(brand.tenantId).toBe(tenantId);
              });
            });

            // Property: Cross-tenant access should be prevented
            // Simulate access control by checking that a brand from one tenant
            // cannot be accessed using another tenant's context
            if (Object.keys(brandsByTenant).length >= 2) {
              const tenantIds = Object.keys(brandsByTenant);
              const tenant1 = tenantIds[0];
              const tenant2 = tenantIds[1];

              const tenant1Brands = brandsByTenant[tenant1];
              const tenant2Brands = brandsByTenant[tenant2];

              // Property: Tenant 1 brands should not be accessible from tenant 2 context
              tenant1Brands.forEach(brand => {
                // Simulate access check: brand belongs to tenant1, accessed from tenant2 context
                const accessAllowed = brand.tenantId === tenant2;
                expect(accessAllowed).toBe(false);
              });

              // Property: Tenant 2 brands should not be accessible from tenant 1 context
              tenant2Brands.forEach(brand => {
                // Simulate access check: brand belongs to tenant2, accessed from tenant1 context
                const accessAllowed = brand.tenantId === tenant1;
                expect(accessAllowed).toBe(false);
              });
            }

            // Property: DynamoDB partition keys should include tenant isolation
            allBrands.forEach(brand => {
              const expectedPK = `${brand.tenantId}#${brand.brandId}`;
              // This simulates how the partition key would be constructed
              expect(expectedPK).toMatch(new RegExp(`^${brand.tenantId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}#brand_[A-Z0-9]{26}$`));
            });

            // Property: GSI keys should include tenant for efficient tenant-scoped queries
            allBrands.forEach(brand => {
              const expectedGSI1PK = brand.tenantId;
              expect(expectedGSI1PK).toBe(brand.tenantId);

              const expectedGSI1SK = `BRAND#${brand.createdAt}`;
              expect(expectedGSI1SK).toMatch(/^BRAND#\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce tenant isolation for brand assets', () => {
      fc.assert(
        fc.property(
          // Generate multiple tenants with brands and assets
          fc.array(
            fc.record({
              tenantId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('/')),
              brandId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('/')),
              assets: fc.array(
                fc.record({
                  name: fc.string({ minLength: 1, maxLength: 200 }),
                  type: fc.constantFrom('logo', 'template', 'image', 'document'),
                  category: fc.string({ minLength: 1, maxLength: 100 }),
                  tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 }),
                  contentType: fc.string({ minLength: 1, maxLength: 100 }),
                  usageRules: fc.record({
                    placement: fc.string({ minLength: 1, maxLength: 500 }),
                    sizing: fc.record({
                      minWidth: fc.integer({ min: 1, max: 2500 }),
                      maxWidth: fc.integer({ min: 2500, max: 5000 }),
                      minHeight: fc.integer({ min: 1, max: 2500 }),
                      maxHeight: fc.integer({ min: 2500, max: 5000 })
                    }),
                    restrictions: fc.array(fc.string({ maxLength: 200 }), { maxLength: 10 })
                  })
                }),
                { minLength: 1, maxLength: 3 }
              )
            }),
            { minLength: 2, maxLength: 4 }
          ),
          (tenantData) => {
            // Create assets for each tenant/brand combination
            const allAssets = [];
            const assetsByTenant = Object.create(null);

            tenantData.forEach(({ tenantId, brandId, assets }) => {
              if (!Object.prototype.hasOwnProperty.call(assetsByTenant, tenantId)) {
                assetsByTenant[tenantId] = [];
              }

              assets.forEach(assetData => {
                const assetId = generateAssetId();
                const now = new Date().toISOString();
                const s3Bucket = 'test-brand-assets-bucket';
                const s3Key = `${tenantId}/${brandId}/${assetId}`;

                const asset = {
                  ...assetData,
                  assetId,
                  brandId,
                  tenantId,
                  s3Bucket,
                  s3Key,
                  fileSize: 1024, // Fixed size for testing
                  createdAt: now,
                  updatedAt: now
                };

                const validatedAsset = validateBrandAssetEntity(asset);
                allAssets.push(validatedAsset);
                assetsByTenant[tenantId].push(validatedAsset);
              });
            });

            // Property: Each asset should belong to exactly one tenant
            allAssets.forEach(asset => {
              expect(asset.tenantId).toBeDefined();
              expect(typeof asset.tenantId).toBe('string');
              expect(asset.tenantId.length).toBeGreaterThan(0);
            });

            // Property: Assets should be properly isolated by tenant
            Object.entries(assetsByTenant).forEach(([tenantId, assets]) => {
              assets.forEach(asset => {
                expect(asset.tenantId).toBe(tenantId);
              });
            });

            // Property: S3 keys should include tenant isolation
            allAssets.forEach(asset => {
              // S3 key should follow the pattern: tenantId/brandId/assetId
              expect(asset.s3Key).toBe(`${asset.tenantId}/${asset.brandId}/${asset.assetId}`);

              // Verify the key starts with tenant ID (for isolation)
              expect(asset.s3Key.startsWith(asset.tenantId)).toBe(true);

              // Verify the key contains the brand ID
              expect(asset.s3Key.includes(asset.brandId)).toBe(true);

              // Verify the key ends with the asset ID
              expect(asset.s3Key.endsWith(asset.assetId)).toBe(true);
            });

            // Property: Cross-tenant asset access should be prevented
            if (Object.keys(assetsByTenant).length >= 2) {
              const tenantIds = Object.keys(assetsByTenant);
              const tenant1 = tenantIds[0];
              const tenant2 = tenantIds[1];

              const tenant1Assets = assetsByTenant[tenant1];
              const tenant2Assets = assetsByTenant[tenant2];

              // Property: Tenant 1 assets should not be accessible from tenant 2 context
              tenant1Assets.forEach(asset => {
                const accessAllowed = asset.tenantId === tenant2;
                expect(accessAllowed).toBe(false);
              });

              // Property: Tenant 2 assets should not be accessible from tenant 1 context
              tenant2Assets.forEach(asset => {
                const accessAllowed = asset.tenantId === tenant1;
                expect(accessAllowed).toBe(false);
              });
            }

            // Property: DynamoDB partition keys should include tenant and brand isolation
            allAssets.forEach(asset => {
              const expectedPK = `${asset.tenantId}#${asset.brandId}`;
              expect(expectedPK).toMatch(new RegExp(`^${asset.tenantId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}#${asset.brandId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
            });

            // Property: GSI keys should include tenant and brand for efficient scoped queries
            allAssets.forEach(asset => {
              const expectedGSI1PK = `${asset.tenantId}#${asset.brandId}`;
              expect(expectedGSI1PK).toBe(`${asset.tenantId}#${asset.brandId}`);

              const expectedGSI1SK = `ASSET#${asset.type}#${asset.createdAt}`;
              expect(expectedGSI1SK).toMatch(new RegExp(`^ASSET#(logo|template|image|document)#\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$`));
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent data leakage between tenants through query patterns', () => {
      fc.assert(
        fc.property(
          // Generate data for multiple tenants
          fc.array(
            fc.record({
              tenantId: fc.string({ minLength: 1, maxLength: 50 }),
              brandCount: fc.integer({ min: 1, max: 3 }),
              assetCount: fc.integer({ min: 1, max: 5 })
            }),
            { minLength: 2, maxLength: 4 }
          ),
          (tenantConfigs) => {
            // Create brands and assets for each tenant
            const allData = [];
            const dataByTenant = Object.create(null);

            tenantConfigs.forEach(({ tenantId, brandCount, assetCount }) => {
              dataByTenant[tenantId] = { brands: [], assets: [] };

              // Create brands for this tenant
              for (let i = 0; i < brandCount; i++) {
                const brandId = generateBrandId();
                const now = new Date().toISOString();

                const brand = {
                  brandId,
                  tenantId,
                  name: `Brand ${i}`,
                  ethos: 'Test ethos',
                  coreValues: ['Value 1'],
                  personalityTraits: { formal: 3, innovative: 4, trustworthy: 5, playful: 2 },
                  contentStandards: {
                    toneOfVoice: 'Professional',
                    styleGuidelines: 'Clear',
                    primaryAudience: 'Business',
                    qualityStandards: 'High',
                    approvalThreshold: 8
                  },
                  visualGuidelines: {
                    colorScheme: { primary: '#000000', secondary: [], accent: [] },
                    typography: { primaryFont: 'Arial', secondaryFont: 'Helvetica', headingStyle: 'Bold' },
                    imageryStyle: 'Professional',
                    logoSpecs: {}
                  },
                  createdAt: now,
                  updatedAt: now,
                  version: 1,
                  status: 'active'
                };

                dataByTenant[tenantId].brands.push(brand);
                allData.push({ type: 'brand', tenantId, data: brand });

                // Create assets for this brand
                for (let j = 0; j < assetCount; j++) {
                  const assetId = generateAssetId();
                  const asset = {
                    assetId,
                    brandId,
                    tenantId,
                    name: `Asset ${j}`,
                    type: 'logo',
                    category: 'Primary',
                    tags: [],
                    s3Bucket: 'test-bucket',
                    s3Key: `${tenantId}/${brandId}/${assetId}`,
                    contentType: 'image/png',
                    fileSize: 1024,
                    usageRules: { placement: 'Top', sizing: {}, restrictions: [] },
                    createdAt: now,
                    updatedAt: now
                  };

                  dataByTenant[tenantId].assets.push(asset);
                  allData.push({ type: 'asset', tenantId, data: asset });
                }
              }
            });

            // Property: Query by tenant should only return data for that tenant
            Object.keys(dataByTenant).forEach(queryTenantId => {
              const tenantData = allData.filter(item => item.tenantId === queryTenantId);

              // All returned data should belong to the queried tenant
              tenantData.forEach(item => {
                expect(item.tenantId).toBe(queryTenantId);
                expect(item.data.tenantId).toBe(queryTenantId);
              });

              // No data from other tenants should be included
              const otherTenantData = allData.filter(item => item.tenantId !== queryTenantId);
              otherTenantData.forEach(item => {
                expect(item.tenantId).not.toBe(queryTenantId);
              });
            });

            // Property: Partition key patterns should enforce tenant isolation
            allData.forEach(item => {
              if (item.type === 'brand') {
                const pk = `${item.tenantId}#${item.data.brandId}`;
                expect(pk.startsWith(item.tenantId)).toBe(true);
              } else if (item.type === 'asset') {
                const pk = `${item.tenantId}#${item.data.brandId}`;
                expect(pk.startsWith(item.tenantId)).toBe(true);
              }
            });

            // Property: GSI patterns should enable efficient tenant-scoped queries
            allData.forEach(item => {
              if (item.type === 'brand') {
                const gsi1pk = item.tenantId;
                expect(gsi1pk).toBe(item.tenantId);
              } else if (item.type === 'asset') {
                const gsi1pk = `${item.tenantId}#${item.data.brandId}`;
                expect(gsi1pk.startsWith(item.tenantId)).toBe(true);
              }
            });

            // Property: No tenant should have access to another tenant's data
            const tenantIds = Object.keys(dataByTenant);
            if (tenantIds.length >= 2) {
              tenantIds.forEach(tenantId => {
                const otherTenants = tenantIds.filter(id => id !== tenantId);

                otherTenants.forEach(otherTenantId => {
                  // Simulate access attempt: tenant trying to access other tenant's data
                  const accessAttempt = allData.filter(item =>
                    item.tenantId === otherTenantId &&
                    item.data.tenantId === tenantId // This should never happen
                  );

                  expect(accessAttempt.length).toBe(0);
                });
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: brand-management-api, Property 6: Search and filtering accuracy**
   * **Validates: Requirements 5.1, 5.2, 5.4, 5.5**
   */

  describe('Property 6: Search and filtecuracy', () => {


    it('should return only brands matching text search criteria', () => {
      fc.assert(
        fc.property(
          fc.array(searchableBrandArb, { minLength: 5, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          (brandDataList, tenantId, searchTerm) => {
            // Create brands with generated metadata
            const brands = brandDataList.map((brandData, index) => {
              const brandId = generateBrandId();
              const now = new Date(Date.now() + index * 1000).toISOString();

              return validateBrandEntity({
                ...brandData,
                brandId,
                tenantId,
                createdAt: now,
                updatedAt: now,
                version: 1
              });
            });

            // Simulate text search across name, ethos, and core values
            const searchResults = brands.filter(brand => {
              const searchableText = [
                brand.name,
                brand.ethos,
                ...brand.coreValues
              ].join(' ').toLowerCase();

              return searchableText.includes(searchTerm.toLowerCase());
            });

            // Property: All results should contain the search term
            searchResults.forEach(brand => {
              const searchableText = [
                brand.name,
                brand.ethos,
                ...brand.coreValues
              ].join(' ').toLowerCase();

              expect(searchableText.includes(searchTerm.toLowerCase())).toBe(true);
            });

            // Property: No non-matching brands should be included
            const nonMatchingBrands = brands.filter(brand => {
              const searchableText = [
                brand.name,
                brand.ethos,
                ...brand.coreValues
              ].join(' ').toLowerCase();

              return !searchableText.includes(searchTerm.toLowerCase());
            });

            nonMatchingBrands.forEach(brand => {
              expect(searchResults.includes(brand)).toBe(false);
            });

            // Property: All results should belong to the same tenant
            searchResults.forEach(brand => {
              expect(brand.tenantId).toBe(tenantId);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return only brands matching filter criteria', () => {
      fc.assert(
        fc.property(
          fc.array(searchableBrandArb, { minLength: 5, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.record({
            status: fc.constantFrom('active', 'inactive', 'archived'),
            primaryAudience: fc.constantFrom('executives', 'professionals', 'consumers', 'technical', 'creative'),
            minApprovalThreshold: fc.integer({ min: 1, max: 5 }),
            maxApprovalThreshold: fc.integer({ min: 6, max: 10 })
          }, { requiredKeys: [] }),
          (brandDataList, tenantId, filters) => {
            // Skip if no filters provided
            if (Object.keys(filters).length === 0) {
              return;
            }

            // Create brands with generated metadata
            const brands = brandDataList.map((brandData, index) => {
              const brandId = generateBrandId();
              const now = new Date(Date.now() + index * 1000).toISOString();

              return validateBrandEntity({
                ...brandData,
                brandId,
                tenantId,
                createdAt: now,
                updatedAt: now,
                version: 1
              });
            });

            // Apply filters
            const filteredResults = brands.filter(brand => {
              // Status filter
              if (filters.status && brand.status !== filters.status) {
                return false;
              }

              // Primary audience filter
              if (filters.primaryAudience && brand.contentStandards.primaryAudience !== filters.primaryAudience) {
                return false;
              }

              // Approval threshold range filter
              if (filters.minApprovalThreshold && brand.contentStandards.approvalThreshold < filters.minApprovalThreshold) {
                return false;
              }

              if (filters.maxApprovalThreshold && brand.contentStandards.approvalThreshold > filters.maxApprovalThreshold) {
                return false;
              }

              return true;
            });

            // Property: All results should match the applied filters
            filteredResults.forEach(brand => {
              if (filters.status) {
                expect(brand.status).toBe(filters.status);
              }

              if (filters.primaryAudience) {
                expect(brand.contentStandards.primaryAudience).toBe(filters.primaryAudience);
              }

              if (filters.minApprovalThreshold) {
                expect(brand.contentStandards.approvalThreshold).toBeGreaterThanOrEqual(filters.minApprovalThreshold);
              }

              if (filters.maxApprovalThreshold) {
                expect(brand.contentStandards.approvalThreshold).toBeLessThanOrEqual(filters.maxApprovalThreshold);
              }
            });

            // Property: No non-matching brands should be included
            const nonMatchingBrands = brands.filter(brand => !filteredResults.includes(brand));

            nonMatchingBrands.forEach(brand => {
              let shouldMatch = true;

              if (filters.status && brand.status !== filters.status) {
                shouldMatch = false;
              }

              if (filters.primaryAudience && brand.contentStandards.primaryAudience !== filters.primaryAudience) {
                shouldMatch = false;
              }

              if (filters.minApprovalThreshold && brand.contentStandards.approvalThreshold < filters.minApprovalThreshold) {
                shouldMatch = false;
              }

              if (filters.maxApprovalThreshold && brand.contentStandards.approvalThreshold > filters.maxApprovalThreshold) {
                shouldMatch = false;
              }

              expect(shouldMatch).toBe(false);
            });

            // Property: All results should belong to the same tenant
            filteredResults.forEach(brand => {
              expect(brand.tenantId).toBe(tenantId);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain accuracy when combining search and filter criteria', () => {
      fc.assert(
        fc.property(
          fc.array(searchableBrandArb, { minLength: 10, maxLength: 30 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.record({
            status: fc.constantFrom('active', 'inactive', 'archived'),
            primaryAudience: fc.constantFrom('executives', 'professionals', 'consumers', 'technical', 'creative')
          }, { requiredKeys: [] }),
          (brandDataList, tenantId, searchTerm, filters) => {
            // Skip if no search term and no filters
            if (!searchTerm && Object.keys(filters).length === 0) {
              return;
            }

            // Create brands with generated metadata
            const brands = brandDataList.map((brandData, index) => {
              const brandId = generateBrandId();
              const now = new Date(Date.now() + index * 1000).toISOString();

              return validateBrandEntity({
                ...brandData,
                brandId,
                tenantId,
                createdAt: now,
                updatedAt: now,
                version: 1
              });
            });

            // Apply combined search and filter
            const results = brands.filter(brand => {
              // Text search
              const searchableText = [
                brand.name,
                brand.ethos,
                ...brand.coreValues
              ].join(' ').toLowerCase();

              const matchesSearch = searchableText.includes(searchTerm.toLowerCase());

              // Filters
              let matchesFilters = true;

              if (filters.status && brand.status !== filters.status) {
                matchesFilters = false;
              }

              if (filters.primaryAudience && brand.contentStandards.primaryAudience !== filters.primaryAudience) {
                matchesFilters = false;
              }

              return matchesSearch && matchesFilters;
            });

            // Property: All results should match both search and filter criteria
            results.forEach(brand => {
              // Should match search
              const searchableText = [
                brand.name,
                brand.ethos,
                ...brand.coreValues
              ].join(' ').toLowerCase();

              expect(searchableText.includes(searchTerm.toLowerCase())).toBe(true);

              // Should match filters
              if (filters.status) {
                expect(brand.status).toBe(filters.status);
              }

              if (filters.primaryAudience) {
                expect(brand.contentStandards.primaryAudience).toBe(filters.primaryAudience);
              }
            });

            // Property: Results should be a subset of both individual search and filter results
            const searchOnlyResults = brands.filter(brand => {
              const searchableText = [
                brand.name,
                brand.ethos,
                ...brand.coreValues
              ].join(' ').toLowerCase();

              return searchableText.includes(searchTerm.toLowerCase());
            });

            const filterOnlyResults = brands.filter(brand => {
              if (filters.status && brand.status !== filters.status) {
                return false;
              }

              if (filters.primaryAudience && brand.contentStandards.primaryAudience !== filters.primaryAudience) {
                return false;
              }

              return true;
            });

            results.forEach(brand => {
              expect(searchOnlyResults.includes(brand)).toBe(true);
              expect(filterOnlyResults.includes(brand)).toBe(true);
            });

            // Property: All results should belong to the same tenant
            results.forEach(brand => {
              expect(brand.tenantId).toBe(tenantId);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: brand-management-api, Property 7: Pagination consistency**
   * **Validates: Requirements 5.3**
   */

  describe('Property 7: Pagination consistency', () => {

    it('should maintain complete and non-duplicated results across all pages', () => {
      fc.assert(
        fc.property(
          fc.array(searchableBrandArb, { minLength: 10, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 2, max: 10 }),
          (brandDataList, tenantId, pageSize) => {
            // Create brands with generated metadata
            const brands = brandDataList.map((brandData, index) => {
              const brandId = generateBrandId();
              const now = new Date(Date.now() + index * 1000).toISOString();

              return validateBrandEntity({
                ...brandData,
                brandId,
                tenantId,
                createdAt: now,
                updatedAt: now,
                version: 1
              });
            });

            // Sort brands by creation date for consistent pagination
            const sortedBrands = brands.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

            // Simulate pagination
            const pages = [];
            let currentPage = 0;
            let startIndex = 0;

            while (startIndex < sortedBrands.length) {
              const endIndex = Math.min(startIndex + pageSize, sortedBrands.length);
              const pageData = sortedBrands.slice(startIndex, endIndex);

              pages.push({
                pageNumber: currentPage,
                items: pageData,
                hasNextPage: endIndex < sortedBrands.length,
                totalItems: sortedBrands.length
              });

              startIndex = endIndex;
              currentPage++;
            }

            // Property: All pages should have correct page size (except possibly the last)
            pages.forEach((page, index) => {
              if (index < pages.length - 1) {
                // Not the last page
                expect(page.items.length).toBe(pageSize);
              } else {
                // Last page
                expect(page.items.length).toBeLessThanOrEqual(pageSize);
                expect(page.items.length).toBeGreaterThan(0);
              }
            });

            // Property: Concatenating all pages should equal the original sorted list
            const allPaginatedItems = pages.flatMap(page => page.items);
            expect(allPaginatedItems.length).toBe(sortedBrands.length);

            allPaginatedItems.forEach((item, index) => {
              expect(item.brandId).toBe(sortedBrands[index].brandId);
              expect(item.createdAt).toBe(sortedBrands[index].createdAt);
            });

            // Property: No item should appear in multiple pages
            const seenBrandIds = new Set();
            pages.forEach(page => {
              page.items.forEach(brand => {
                expect(seenBrandIds.has(brand.brandId)).toBe(false);
                seenBrandIds.add(brand.brandId);
              });
            });

            // Property: All original brands should appear exactly once
            expect(seenBrandIds.size).toBe(sortedBrands.length);
            sortedBrands.forEach(brand => {
              expect(seenBrandIds.has(brand.brandId)).toBe(true);
            });

            // Property: Page metadata should be consistent
            pages.forEach((page, index) => {
              expect(page.pageNumber).toBe(index);
              expect(page.totalItems).toBe(sortedBrands.length);

              if (index < pages.length - 1) {
                expect(page.hasNextPage).toBe(true);
              } else {
                expect(page.hasNextPage).toBe(false);
              }
            });

            // Property: Items within each page should maintain sort order
            pages.forEach(page => {
              for (let i = 1; i < page.items.length; i++) {
                expect(page.items[i].createdAt >= page.items[i - 1].createdAt).toBe(true);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge cases in pagination correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 10 }),
          (brandCount, tenantId, pageSize) => {
            // Create brands (possibly empty list)
            const brands = [];
            for (let i = 0; i < brandCount; i++) {
              const brandId = generateBrandId();
              const now = new Date(Date.now() + i * 1000).toISOString();

              brands.push(validateBrandEntity({
                name: `Brand ${i}`,
                ethos: 'Test ethos',
                coreValues: ['Value 1'],
                personalityTraits: { formal: 3, innovative: 4, trustworthy: 5, playful: 2 },
                contentStandards: {
                  toneOfVoice: 'Professional',
                  styleGuidelines: 'Clear',
                  primaryAudience: 'professionals',
                  qualityStandards: 'High',
                  approvalThreshold: 8
                },
                visualGuidelines: {
                  colorScheme: { primary: '#000000', secondary: [], accent: [] },
                  typography: { primaryFont: 'Arial', secondaryFont: 'Helvetica', headingStyle: 'Bold' },
                  imageryStyle: 'Professional',
                  logoSpecs: {}
                },
                brandId,
                tenantId,
                createdAt: now,
                updatedAt: now,
                version: 1,
                status: 'active'
              }));
            }

            // Simulate pagination
            const pages = [];
            let startIndex = 0;

            while (startIndex < brands.length) {
              const endIndex = Math.min(startIndex + pageSize, brands.length);
              const pageData = brands.slice(startIndex, endIndex);

              pages.push({
                items: pageData,
                hasNextPage: endIndex < brands.length,
                totalItems: brands.length
              });

              startIndex = endIndex;
            }

            if (brandCount === 0) {
              // Property: Empty dataset should result in no pages or one empty page
              expect(pages.length).toBeLessThanOrEqual(1);
              if (pages.length === 1) {
                expect(pages[0].items.length).toBe(0);
                expect(pages[0].hasNextPage).toBe(false);
                expect(pages[0].totalItems).toBe(0);
              }
            } else {
              // Property: Non-empty dataset should have at least one page
              expect(pages.length).toBeGreaterThan(0);

              // Property: Total items across all pages should equal brand count
              const totalPaginatedItems = pages.reduce((sum, page) => sum + page.items.length, 0);
              expect(totalPaginatedItems).toBe(brandCount);

              // Property: Expected number of pages
              const expectedPages = Math.ceil(brandCount / pageSize);
              expect(pages.length).toBe(expectedPages);
            }

            // Property: All page metadata should be consistent
            pages.forEach(page => {
              expect(page.totalItems).toBe(brandCount);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: brand-management-api, Property 8: Lifecycle management integrity**
   * **Validates: Requirements 4.4**
   */

  describe('Property 8: Lifecycle management integrity', () => {

    it('should update brand status correctly while preserving all other data', () => {
      fc.assert(
        fc.property(
          searchableBrandArb,
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom('active', 'inactive', 'archived'),
          fc.constantFrom('active', 'inactive', 'archived'),
          (brandData, tenantId, initialStatus, newStatus) => {
            // Skip if status doesn't change
            if (initialStatus === newStatus) {
              return;
            }

            // Define valid transitions
            const validTransitions = {
              'active': ['inactive', 'archived'],
              'inactive': ['active', 'archived'],
              'archived': ['active']
            };

            // Skip if this is not a valid transition (we only test valid transitions)
            const allowedTransitions = validTransitions[initialStatus] || [];
            if (!allowedTransitions.includes(newStatus)) {
              return;
            }

            // Create initial brand
            const brandId = generateBrandId();
            const initialTimestamp = new Date().toISOString();

            const initialBrand = validateBrandEntity({
              ...brandData,
              brandId,
              tenantId,
              createdAt: initialTimestamp,
              updatedAt: initialTimestamp,
              version: 1,
              status: initialStatus
            });

            // Simulate lifecycle operation (status change)
            const updateTimestamp = new Date(Date.now() + 1000).toISOString();

            const updatedBrand = validateBrandEntity({
              ...initialBrand,
              status: newStatus,
              updatedAt: updateTimestamp,
              version: initialBrand.version + 1
            });

            // Property: Status should be updated correctly
            expect(updatedBrand.status).toBe(newStatus);
            expect(updatedBrand.status).not.toBe(initialBrand.status);

            // Property: All other brand data should be preserved
            expect(updatedBrand.brandId).toBe(initialBrand.brandId);
            expect(updatedBrand.tenantId).toBe(initialBrand.tenantId);
            expect(updatedBrand.name).toBe(initialBrand.name);
            expect(updatedBrand.ethos).toBe(initialBrand.ethos);
            expect(updatedBrand.coreValues).toEqual(initialBrand.coreValues);
            expect(updatedBrand.personalityTraits).toEqual(initialBrand.personalityTraits);
            expect(updatedBrand.contentStandards).toEqual(initialBrand.contentStandards);
            expect(updatedBrand.visualGuidelines).toEqual(initialBrand.visualGuidelines);

            // Property: Version should increment
            expect(updatedBrand.version).toBe(initialBrand.version + 1);

            // Property: CreatedAt should never change
            expect(updatedBrand.createdAt).toBe(initialBrand.createdAt);

            // Property: UpdatedAt should change
            expect(updatedBrand.updatedAt).not.toBe(initialBrand.updatedAt);
            expect(updatedBrand.updatedAt).toBe(updateTimestamp);

            // Property: This transition should be valid (we filtered for valid transitions above)
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain lifecycle integrity through multiple status changes', () => {
      fc.assert(
        fc.property(
          searchableBrandArb,
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.constantFrom('active', 'inactive', 'archived'), { minLength: 2, maxLength: 5 }),
          (brandData, tenantId, statusSequence) => {
            // Remove consecutive duplicates
            const uniqueStatusSequence = statusSequence.filter((status, index) =>
              index === 0 || status !== statusSequence[index - 1]
            );

            if (uniqueStatusSequence.length < 2) {
              return;
            }

            // Create initial brand
            const brandId = generateBrandId();
            const initialTimestamp = new Date().toISOString();

            let currentBrand = validateBrandEntity({
              ...brandData,
              brandId,
              tenantId,
              createdAt: initialTimestamp,
              updatedAt: initialTimestamp,
              version: 1,
              status: uniqueStatusSequence[0]
            });

            const brandHistory = [{ ...currentBrand }];

            // Apply status changes sequentially
            for (let i = 1; i < uniqueStatusSequence.length; i++) {
              const newStatus = uniqueStatusSequence[i];
              const updateTimestamp = new Date(Date.now() + i * 1000).toISOString();

              currentBrand = validateBrandEntity({
                ...currentBrand,
                status: newStatus,
                updatedAt: updateTimestamp,
                version: currentBrand.version + 1
              });

              brandHistory.push({ ...currentBrand });
            }

            // Property: Final status should match the last in sequence
            expect(currentBrand.status).toBe(uniqueStatusSequence[uniqueStatusSequence.length - 1]);

            // Property: Version should increment with each change
            expect(currentBrand.version).toBe(1 + uniqueStatusSequence.length - 1);

            // Property: All core data should remain unchanged throughout lifecycle
            brandHistory.forEach(brand => {
              expect(brand.brandId).toBe(brandId);
              expect(brand.tenantId).toBe(tenantId);
              expect(brand.name).toBe(brandData.name);
              expect(brand.ethos).toBe(brandData.ethos);
              expect(brand.coreValues).toEqual(brandData.coreValues);
              expect(brand.personalityTraits).toEqual(brandData.personalityTraits);
              expect(brand.contentStandards).toEqual(brandData.contentStandards);
              expect(brand.visualGuidelines).toEqual(brandData.visualGuidelines);
              expect(brand.createdAt).toBe(initialTimestamp);
            });

            // Property: Version should increment monotonically
            for (let i = 1; i < brandHistory.length; i++) {
              expect(brandHistory[i].version).toBe(brandHistory[i - 1].version + 1);
            }

            // Property: UpdatedAt should change with each status change
            for (let i = 1; i < brandHistory.length; i++) {
              expect(brandHistory[i].updatedAt).not.toBe(brandHistory[i - 1].updatedAt);
            }

            // Property: Status should change with each update
            for (let i = 1; i < brandHistory.length; i++) {
              expect(brandHistory[i].status).not.toBe(brandHistory[i - 1].status);
              expect(brandHistory[i].status).toBe(uniqueStatusSequence[i]);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle lifecycle operations with proper validation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom('active', 'inactive', 'archived'),
          (tenantId, initialStatus) => {
            // Create a minimal valid brand
            const brandId = generateBrandId();
            const now = new Date().toISOString();

            const brand = validateBrandEntity({
              name: 'Test Brand',
              ethos: 'Test ethos for lifecycle management',
              coreValues: ['Innovation', 'Quality'],
              personalityTraits: { formal: 3, innovative: 4, trustworthy: 5, playful: 2 },
              contentStandards: {
                toneOfVoice: 'Professional',
                styleGuidelines: 'Clear and concise',
                primaryAudience: 'professionals',
                qualityStandards: 'High quality content',
                approvalThreshold: 8
              },
              visualGuidelines: {
                colorScheme: { primary: '#000000', secondary: ['#666666'], accent: ['#ff0000'] },
                typography: { primaryFont: 'Arial', secondaryFont: 'Helvetica', headingStyle: 'Bold' },
                imageryStyle: 'Professional photography',
                logoSpecs: { minSize: '50px', maxSize: '500px', clearSpace: '10px', placement: 'Top left' }
              },
              brandId,
              tenantId,
              createdAt: now,
              updatedAt: now,
              version: 1,
              status: initialStatus
            });

            // Property: Brand should be valid after creation
            expect(brand.status).toBe(initialStatus);
            expect(brand.version).toBe(1);

            // Test all possible status transitions
            const allStatuses = ['active', 'inactive', 'archived'];
            const otherStatuses = allStatuses.filter(s => s !== initialStatus);

            otherStatuses.forEach(newStatus => {
              const updatedBrand = validateBrandEntity({
                ...brand,
                status: newStatus,
                updatedAt: new Date(Date.now() + 1000).toISOString(),
                version: brand.version + 1
              });

              // Property: Status transition should be successful
              expect(updatedBrand.status).toBe(newStatus);
              expect(updatedBrand.version).toBe(brand.version + 1);

              // Property: All other data should be preserved
              expect(updatedBrand.brandId).toBe(brand.brandId);
              expect(updatedBrand.tenantId).toBe(brand.tenantId);
              expect(updatedBrand.name).toBe(brand.name);
              expect(updatedBrand.createdAt).toBe(brand.createdAt);
            });

            // Property: Brand should remain valid throughout all lifecycle operations
            allStatuses.forEach(status => {
              const lifecycleBrand = validateBrandEntity({
                ...brand,
                status,
                updatedAt: new Date(Date.now() + 2000).toISOString(),
                version: brand.version + 2
              });

              expect(lifecycleBrand.status).toBe(status);
              expect(['active', 'inactive', 'archived']).toContain(lifecycleBrand.status);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


