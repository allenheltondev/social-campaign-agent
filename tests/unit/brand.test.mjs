import { describe, it, expect } from 'vitest';
import {
  BrandSchema,
  BrandAssetSchema,
  CreateBrandRequestSchema,
  UpdateBrandRequestSchema,
  CreateBrandAssetRequestSchema,
  QueryBrandsRequestSchema,
  validateRequestBody,
  validateQueryParams,
  generateBrandId,
  generateAssetId
} from '../../models/brand.mjs';

describe('Brand Schema Validation', () => {
  describe('Brand Creation Request Validation', () => {
    it('should validate valid brand creation request', () => {
      const validBrandRequest = {
        name: 'Test Brand',
        ethos: 'Innovation and excellence in everything we do',
        coreValues: ['Innovation', 'Quality', 'Customer Focus'],
        personalityTraits: {
          formal: 3,
          innovative: 5,
          trustworthy: 4,
          playful: 2
        },
        contentStandards: {
          toneOfVoice: 'Professional yet approachable',
          styleGuidelines: 'Clear, concise, and engaging content',
          qualityStandards: 'High-quality, error-free content'
        },
        visualGuidelines: {
          colorScheme: {
            primary: '#0066CC',
            secondary: ['#FF6600', '#00CC66'],
            accent: ['#FFCC00']
          },
          typography: {
            primaryFont: 'Arial',
            secondaryFont: 'Helvetica',
            headingStyle: 'Bold, sans-serif'
          },
          imageryStyle: 'Clean, modern, professional photography',
          logoSpecs: {
            minSize: '24px',
            maxSize: '200px',
            clearSpace: '10px',
            placement: 'Top left or center'
          }
        }
      };

      const result = CreateBrandRequestSchema.parse(validBrandRequest);
      expect(result).toEqual(validBrandRequest);
    });

    it('should reject brand creation request with missing required fields', () => {
      const invalidBrandRequest = {
        name: 'Test Brand'
        // Missing all other required fields
      };

      expect(() => CreateBrandRequestSchema.parse(invalidBrandRequest)).toThrow();
    });

    it('should reject brand creation request with invalid personality trait values', () => {
      const invalidBrandRequest = {
        name: 'Test Brand',
        ethos: 'Test ethos',
        coreValues: ['Value 1'],
        personalityTraits: {
          formal: 6, // Invalid: should be 1-5
          innovative: 5,
          trustworthy: 4,
          playful: 2
        },
        contentStandards: {
          toneOfVoice: 'Professional',
          styleGuidelines: 'Clear content',
          primaryAudience: 'Business professionals',
          qualityStandards: 'High quality',
          approvalThreshold: 8
        },
        visualGuidelines: {
          colorScheme: {
            primary: '#0066CC',
            secondary: [],
            accent: []
          },
          typography: {
            primaryFont: 'Arial',
            secondaryFont: 'Helvetica',
            headingStyle: 'Bold'
          },
          imageryStyle: 'Professional',
          logoSpecs: {}
        }
      };

      expect(() => CreateBrandRequestSchema.parse(invalidBrandRequest)).toThrow();
    });

    it('should reject brand creation request with empty name', () => {
      const invalidBrandRequest = {
        name: '', // Invalid: empty string
        ethos: 'Test ethos',
        coreValues: ['Value 1'],
        personalityTraits: {
          formal: 3,
          innovative: 5,
          trustworthy: 4,
          playful: 2
        },
        contentStandards: {
          toneOfVoice: 'Professional',
          styleGuidelines: 'Clear content',
          primaryAudience: 'Business professionals',
          qualityStandards: 'High quality',
          approvalThreshold: 8
        },
        visualGuidelines: {
          colorScheme: {
            primary: '#0066CC',
            secondary: [],
            accent: []
          },
          typography: {
            primaryFont: 'Arial',
            secondaryFont: 'Helvetica',
            headingStyle: 'Bold'
          },
          imageryStyle: 'Professional',
          logoSpecs: {}
        }
      };

      expect(() => CreateBrandRequestSchema.parse(invalidBrandRequest)).toThrow();
    });
  });

  describe('Brand Update Request Validation', () => {
    it('should validate partial brand update request', () => {
      const validUpdateRequest = {
        name: 'Updated Brand Name',
        ethos: 'Updated brand ethos'
      };

      const result = UpdateBrandRequestSchema.parse(validUpdateRequest);
      expect(result).toEqual(validUpdateRequest);
    });

    it('should validate empty brand update request', () => {
      const emptyUpdateRequest = {};

      const result = UpdateBrandRequestSchema.parse(emptyUpdateRequest);
      expect(result).toEqual(emptyUpdateRequest);
    });

    it('should reject brand update request with invalid personality trait values', () => {
      const invalidUpdateRequest = {
        personalityTraits: {
          formal: 0, // Invalid: should be 1-5
          innovative: 5
        }
      };

      expect(() => UpdateBrandRequestSchema.parse(invalidUpdateRequest)).toThrow();
    });
  });

  describe('Complete Brand Entity Validation', () => {
    it('should validate complete brand entity', () => {
      const validBrand = {
        brandId: 'brand_01234567890123456789012345',
        tenantId: 'tenant_123',
        name: 'Test Brand',
        ethos: 'Innovation and excellence',
        coreValues: ['Innovation', 'Quality'],
        personalityTraits: {
          formal: 3,
          innovative: 5,
          trustworthy: 4,
          playful: 2
        },
        platformGuidelines: {
          enabled: ['twitter', 'linkedin'],
          defaults: {
            twitter: { defaultAsset: 'none', linkPolicy: 'allowed', emojiPolicy: 'sparing', hashtagPolicy: 'allowed', typicalCadencePerWeek: 5 },
            linkedin: { defaultAsset: 'none', linkPolicy: 'allowed', emojiPolicy: 'none', hashtagPolicy: 'sparing', typicalCadencePerWeek: 3 }
          }
        },
        audienceProfile: {
          primary: 'professionals',
          segments: ['tech', 'business'],
          excluded: ['students']
        },
        contentStandards: {
          toneOfVoice: 'Professional',
          styleGuidelines: 'Clear content',
          qualityStandards: 'High quality',
          restrictions: ['no politics'],
          avoidTopics: ['controversial'],
          avoidPhrases: ['guaranteed']
        },
        pillars: [
          { name: 'Innovation', weight: 0.5 },
          { name: 'Quality', weight: 0.5 }
        ],
        claimsPolicy: {
          noGuarantees: true,
          noPerformanceNumbersUnlessProvided: true,
          requireSourceForStats: true,
          competitorMentionPolicy: 'avoid'
        },
        ctaLibrary: [
          { type: 'learn_more', text: 'Learn more', defaultUrl: 'https://example.com' }
        ],
        approvalPolicy: {
          threshold: 0.8,
          mode: 'require_review_below_threshold'
        },
        visualGuidelines: {
          colorScheme: {
            primary: '#0066CC',
            secondary: ['#FF6600'],
            accent: ['#FFCC00']
          },
          typography: {
            primaryFont: 'Arial',
            secondaryFont: 'Helvetica',
            headingStyle: 'Bold'
          },
          imageryStyle: 'Professional',
          logoSpecs: {
            minSize: '24px',
            maxSize: '200px'
          }
        },
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        version: 1,
        status: 'active'
      };

      const result = BrandSchema.parse(validBrand);
      expect(result).toEqual(validBrand);
    });

    it('should reject brand entity with invalid status', () => {
      const invalidBrand = {
        brandId: 'brand_01234567890123456789012345',
        tenantId: 'tenant_123',
        name: 'Test Brand',
        ethos: 'Innovation and excellence',
        coreValues: ['Innovation'],
        personalityTraits: {
          formal: 3,
          innovative: 5,
          trustworthy: 4,
          playful: 2
        },
        contentStandards: {
          toneOfVoice: 'Professional',
          styleGuidelines: 'Clear content',
          primaryAudience: 'Business professionals',
          qualityStandards: 'High quality',
          approvalThreshold: 8
        },
        visualGuidelines: {
          colorScheme: {
            primary: '#0066CC',
            secondary: [],
            accent: []
          },
          typography: {
            primaryFont: 'Arial',
            secondaryFont: 'Helvetica',
            headingStyle: 'Bold'
          },
          imageryStyle: 'Professional',
          logoSpecs: {}
        },
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        version: 1,
        status: 'invalid_status' // Invalid status
      };

      expect(() => BrandSchema.parse(invalidBrand)).toThrow();
    });
  });

  describe('Brand Asset Schema Validation', () => {
    it('should validate complete brand asset entity', () => {
      const validAsset = {
        assetId: 'asset_01234567890123456789012345',
        brandId: 'brand_01234567890123456789012345',
        tenantId: 'tenant_123',
        name: 'Brand Logo',
        type: 'logo',
        category: 'Primary Branding',
        tags: ['logo', 'primary', 'svg'],
        s3Bucket: 'brand-assets-bucket',
        s3Key: 'tenant_123/brand_123/logo.svg',
        contentType: 'image/svg+xml',
        fileSize: 2048,
        usageRules: {
          placement: 'Top left corner',
          sizing: {
            minWidth: 100,
            maxWidth: 500,
            minHeight: 50,
            maxHeight: 250
          },
          restrictions: ['No modifications allowed', 'Maintain aspect ratio']
        },
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      };

      const result = BrandAssetSchema.parse(validAsset);
      expect(result).toEqual(validAsset);
    });

    it('should reject brand asset with invalid type', () => {
      const invalidAsset = {
        assetId: 'asset_01234567890123456789012345',
        brandId: 'brand_01234567890123456789012345',
        tenantId: 'tenant_123',
        name: 'Brand Logo',
        type: 'invalid_type', // Invalid type
        category: 'Primary Branding',
        tags: ['logo'],
        s3Bucket: 'brand-assets-bucket',
        s3Key: 'tenant_123/brand_123/logo.svg',
        contentType: 'image/svg+xml',
        fileSize: 2048,
        usageRules: {
          placement: 'Top left corner',
          sizing: {},
          restrictions: []
        },
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      };

      expect(() => BrandAssetSchema.parse(invalidAsset)).toThrow();
    });
  });

  describe('Query Parameters Validation', () => {
    it('should validate valid brand query parameters', () => {
      const validQuery = {
        limit: 25,
        nextToken: 'token_123',
        search: 'tech brand',
        status: 'active',
        industry: 'Technology',
        companySize: 'Medium'
      };

      const result = QueryBrandsRequestSchema.parse(validQuery);
      expect(result).toEqual(validQuery);
    });

    it('should validate empty brand query parameters', () => {
      const emptyQuery = {};

      const result = QueryBrandsRequestSchema.parse(emptyQuery);
      expect(result).toEqual(emptyQuery);
    });

    it('should reject query with invalid limit', () => {
      const invalidQuery = {
        limit: 150 // Invalid: exceeds maximum of 100
      };

      expect(() => QueryBrandsRequestSchema.parse(invalidQuery)).toThrow();
    });

    it('should coerce string limit to number', () => {
      const queryWithStringLimit = {
        limit: '25'
      };

      const result = QueryBrandsRequestSchema.parse(queryWithStringLimit);
      expect(result.limit).toBe(25);
      expect(typeof result.limit).toBe('number');
    });
  });

  describe('Utility Functions', () => {
    describe('validateRequestBody', () => {
      it('should validate valid JSON request body', () => {
        const validBody = JSON.stringify({
          name: 'Test Brand',
          ethos: 'Test ethos',
          coreValues: ['Value 1']
        });

        const result = validateRequestBody(CreateBrandRequestSchema.pick({ name: true, ethos: true, coreValues: true }), validBody);
        expect(result.name).toBe('Test Brand');
        expect(result.ethos).toBe('Test ethos');
        expect(result.coreValues).toEqual(['Value 1']);
      });

      it('should throw error for invalid JSON', () => {
        const invalidBody = '{ invalid json }';

        expect(() => validateRequestBody(CreateBrandRequestSchema, invalidBody)).toThrow('Invalid JSON in request body');
      });

      it('should throw validation error for invalid data', () => {
        const invalidBody = JSON.stringify({
          name: '' // Invalid: empty name
        });

        expect(() => validateRequestBody(CreateBrandRequestSchema, invalidBody)).toThrow('Validation error');
      });
    });

    describe('validateQueryParams', () => {
      it('should validate valid query parameters', () => {
        const validParams = {
          limit: 25,
          status: 'active'
        };

        const result = validateQueryParams(QueryBrandsRequestSchema, validParams);
        expect(result).toEqual(validParams);
      });

      it('should throw validation error for invalid parameters', () => {
        const invalidParams = {
          limit: 150 // Invalid: exceeds maximum
        };

        expect(() => validateQueryParams(QueryBrandsRequestSchema, invalidParams)).toThrow('Query parameter validation error');
      });
    });

    describe('ID Generation', () => {
      it('should generate valid brand IDs', () => {
        const brandId = generateBrandId();
        expect(brandId).toMatch(/^brand_[A-Z0-9]{26}$/);
      });

      it('should generate unique brand IDs', () => {
        const id1 = generateBrandId();
        const id2 = generateBrandId();
        expect(id1).not.toBe(id2);
      });

      it('should generate valid asset IDs', () => {
        const assetId = generateAssetId();
        expect(assetId).toMatch(/^asset_[A-Z0-9]{26}$/);
      });

      it('should generate unique asset IDs', () => {
        const id1 = generateAssetId();
        const id2 = generateAssetId();
        expect(id1).not.toBe(id2);
      });
    });
  });
});
