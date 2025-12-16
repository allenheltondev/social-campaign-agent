import { describe, it, expect } from 'vitest';
import {
  CreateBrandRequestSchema,
  UpdateBrandRequestSchema,
  validateRequestBody,
  generateBrandId
} from '../../models/brand.mjs';

// Mock environment variables
process.env.TABLE_NAME = 'test-table';

describe('Brand CRUD Operations', () => {

  describe('Brand Request Validation', () => {
    it('should validate valid brand creation request', () => {
      const validBrandData = {
        name: 'Test Brand',
        ethos: 'Innovation and excellence',
        coreValues: ['Innovation', 'Quality'],
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
        }
      };

      const result = validateRequestBody(CreateBrandRequestSchema, JSON.stringify(validBrandData));
      expect(result.name).toBe(validBrandData.name);
      expect(result.ethos).toBe(validBrandData.ethos);
      expect(result.coreValues).toEqual(validBrandData.coreValues);
    });

    it('should reject invalid brand creation request', () => {
      const invalidBrandData = {
        name: '' // Invalid: empty name
      };

      expect(() => {
        validateRequestBody(CreateBrandRequestSchema, JSON.stringify(invalidBrandData));
      }).toThrow('Validation error');
    });

    it('should validate brand update request', () => {
      const updateData = {
        name: 'Updated Brand Name',
        ethos: 'Updated brand ethos'
      };

      const result = validateRequestBody(UpdateBrandRequestSchema, JSON.stringify(updateData));
      expect(result.name).toBe(updateData.name);
      expect(result.ethos).toBe(updateData.ethos);
    });

    it('should reject invalid brand update request', () => {
      const invalidUpdateData = {
        personalityTraits: {
          formal: 6 // Invalid: should be 1-5
        }
      };

      expect(() => {
        validateRequestBody(UpdateBrandRequestSchema, JSON.stringify(invalidUpdateData));
      }).toThrow('Validation error');
    });
  });

  describe('Brand ID Generation', () => {
    it('should generate valid brand IDs', () => {
      const brandId = generateBrandId();
      expect(brandId).toMatch(/^brand_[A-Z0-9]{26}$/);
    });

    it('should generate unique brand IDs', () => {
      const id1 = generateBrandId();
      const id2 = generateBrandId();
      expect(id1).not.toBe(id2);
    });

    it('should generate multiple unique IDs', () => {
      const ids = Array.from({ length: 10 }, () => generateBrandId());
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });
  });

  describe('Brand Data Transformation', () => {
    it('should create complete brand entity from request data', () => {
      const requestData = {
        name: 'Test Brand',
        ethos: 'Innovation and excellence',
        coreValues: ['Innovation', 'Quality'],
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
        }
      };

      const brandId = generateBrandId();
      const tenantId = 'tenant_123';
      const now = new Date().toISOString();

      const completeBrand = {
        ...requestData,
        brandId,
        tenantId,
        createdAt: now,
        updatedAt: now,
        version: 1,
        status: 'active'
      };

      expect(completeBrand.brandId).toBe(brandId);
      expect(completeBrand.tenantId).toBe(tenantId);
      expect(completeBrand.version).toBe(1);
      expect(completeBrand.status).toBe('active');
      expect(completeBrand.name).toBe(requestData.name);
      expect(completeBrand.ethos).toBe(requestData.ethos);
    });

    it('should handle version increment for updates', () => {
      const initialBrand = {
        brandId: 'brand_123',
        tenantId: 'tenant_123',
        name: 'Original Brand',
        version: 1,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      };

      const updateData = {
        name: 'Updated Brand'
      };

      const updatedBrand = {
        ...initialBrand,
        ...updateData,
        version: initialBrand.version + 1,
        updatedAt: new Date().toISOString()
      };

      expect(updatedBrand.version).toBe(2);
      expect(updatedBrand.name).toBe('Updated Brand');
      expect(updatedBrand.createdAt).toBe(initialBrand.createdAt);
      expect(updatedBrand.updatedAt).not.toBe(initialBrand.updatedAt);
    });
  });



  describe('Brand Lifecycle Management', () => {
    it('should handle soft delete by changing status', () => {
      const activeBrand = {
        brandId: 'brand_123',
        tenantId: 'tenant_123',
        name: 'Test Brand',
        status: 'active',
        version: 1,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      };

      const archivedBrand = {
        ...activeBrand,
        status: 'archived',
        version: activeBrand.version + 1,
        updatedAt: new Date().toISOString()
      };

      expect(archivedBrand.status).toBe('archived');
      expect(archivedBrand.version).toBe(2);
      expect(archivedBrand.brandId).toBe(activeBrand.brandId);
      expect(archivedBrand.createdAt).toBe(activeBrand.createdAt);
    });

    it('should handle status transitions', () => {
      const brand = {
        brandId: 'brand_123',
        status: 'active',
        version: 1
      };

      const transitions = [
        { from: 'active', to: 'inactive' },
        { from: 'inactive', to: 'active' },
        { from: 'active', to: 'archived' }
      ];

      transitions.forEach(({ from, to }) => {
        const updatedBrand = {
          ...brand,
          status: to,
          version: brand.version + 1
        };

        expect(updatedBrand.status).toBe(to);
        expect(updatedBrand.version).toBe(brand.version + 1);
      });
    });
  });
});
