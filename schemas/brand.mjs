import { z } from 'zod';
import { ulid } from 'ulid';

// Core brand schema that defines both validation and type
export const BrandSchema = z.object({
  // Identity
  brandId: z.string(),
  tenantId: z.string(),
  name: z.string().min(1).max(100),
  ethos: z.string().min(1).max(1000),
  coreValues: z.array(z.string().min(1).max(200)).min(1).max(10),

  // Personality Traits (1-5 scale)
  personalityTraits: z.object({
    formal: z.number().min(1).max(5),
    innovative: z.number().min(1).max(5),
    trustworthy: z.number().min(1).max(5),
    playful: z.number().min(1).max(5)
  }),

  // Content Standards
  contentStandards: z.object({
    toneOfVoice: z.string().min(1).max(500),
    styleGuidelines: z.string().min(1).max(1000),
    primaryAudience: z.string().min(1).max(200),
    qualityStandards: z.string().min(1).max(500),
    approvalThreshold: z.number().min(1).max(10)
  }),

  // Visual Guidelines
  visualGuidelines: z.object({
    colorScheme: z.object({
      primary: z.string().min(1).max(50).optional(),
      secondary: z.array(z.string().min(1).max(50)).max(10).optional(),
      accent: z.array(z.string().min(1).max(50)).max(10).optional()
    }).optional(),
    typography: z.object({
      primaryFont: z.string().min(1).max(100).optional(),
      secondaryFont: z.string().min(1).max(100).optional(),
      headingStyle: z.string().min(1).max(200).optional()
    }).optional(),
    imageryStyle: z.string().min(1).max(500).optional(),
    logoSpecs: z.object({
      minSize: z.string().max(50).optional(),
      maxSize: z.string().max(50).optional(),
      clearSpace: z.string().max(100).optional(),
      placement: z.string().max(200).optional()
    }).optional()
  }).optional(),

  // Metadata
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().min(1),
  status: z.enum(['active', 'inactive', 'archived'])
});

// Brand asset schema
export const BrandAssetSchema = z.object({
  assetId: z.string(),
  brandId: z.string(),
  tenantId: z.string(),
  name: z.string().min(1).max(200),
  type: z.enum(['logo', 'template', 'image', 'document']),
  category: z.string().min(1).max(100),
  tags: z.array(z.string().min(1).max(50)).max(20),

  // Storage Information
  s3Bucket: z.string().min(1).max(100),
  s3Key: z.string().min(1).max(500),
  contentType: z.string().min(1).max(100),
  fileSize: z.number().int().min(1),

  // Usage Guidelines
  usageRules: z.object({
    placement: z.string().max(500).optional(),
    sizing: z.object({
      minWidth: z.number().int().min(1).optional(),
      maxWidth: z.number().int().min(1).optional(),
      minHeight: z.number().int().min(1).optional(),
      maxHeight: z.number().int().min(1).optional()
    }).optional(),
    restrictions: z.array(z.string().max(200)).max(10)
  }),

  // Metadata
  createdAt: z.string(),
  updatedAt: z.string()
});

// Request schemas for API validation
export const CreateBrandRequestSchema = BrandSchema.omit({
  brandId: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  status: true
});

export const UpdateBrandRequestSchema = CreateBrandRequestSchema.partial();

export const CreateBrandAssetRequestSchema = BrandAssetSchema.omit({
  assetId: true,
  brandId: true,
  tenantId: true,
  s3Bucket: true,
  s3Key: true,
  fileSize: true,
  createdAt: true,
  updatedAt: true
}).extend({
  fileData: z.string().min(1, 'File data is required')
});

export const QueryBrandsRequestSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional(),
  nextToken: z.string().optional(),
  search: z.string().max(200).optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  industry: z.string().max(100).optional(),
  companySize: z.string().max(50).optional()
});

// Utility function to validate request body
export const validateRequestBody = (schema, body) => {
  try {
    const parsed = JSON.parse(body);
    return schema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw new Error('Invalid JSON in request body');
  }
};

// Utility function to validate query parameters
export const validateQueryParams = (schema, params) => {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Query parameter validation error: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
};

// Simple ID generation utilities
export const generateBrandId = () => {
  return `brand_${ulid()}`;
};

export const generateAssetId = () => {
  return `asset_${ulid()}`;
};
