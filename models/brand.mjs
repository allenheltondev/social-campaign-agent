import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { z } from 'zod';
import { ulid } from 'ulid';

const ddb = new DynamoDBClient();

export const BrandSchema = z.object({
  brandId: z.string(),
  tenantId: z.string(),
  name: z.string().min(1).max(100),
  ethos: z.string().min(1).max(1000),
  coreValues: z.array(z.string().min(1).max(200)).min(1).max(10),
  primaryAudience: z.enum(['executives', 'professionals', 'consumers', 'technical', 'creative']),
  voiceGuidelines: z.object({
    tone: z.array(z.string().min(1).max(50)).min(1).max(10),
    style: z.array(z.string().min(1).max(50)).min(1).max(10),
    messaging: z.array(z.string().min(1).max(100)).min(1).max(10)
  }),
  visualIdentity: z.object({
    colorPalette: z.array(z.string().min(1).max(50)).min(1).max(10),
    typography: z.array(z.string().min(1).max(100)).min(1).max(5),
    imagery: z.array(z.string().min(1).max(100)).min(1).max(10)
  }),
  contentStandards: z.object({
    qualityRequirements: z.array(z.string().min(1).max(100)).min(1).max(10),
    restrictions: z.array(z.string().min(1).max(200)).max(20)
  }),
  platformGuidelines: z.object({
    enabled: z.array(z.enum(['twitter', 'linkedin', 'instagram', 'facebook'])).min(1),
    defaults: z.record(
      z.enum(['twitter', 'linkedin', 'instagram', 'facebook']),
      z.object({
        defaultAsset: z.enum(['none', 'image', 'video']),
        linkPolicy: z.enum(['allowed', 'discouraged', 'never']),
        emojiPolicy: z.enum(['none', 'sparing', 'allowed']),
        hashtagPolicy: z.enum(['none', 'sparing', 'allowed']),
        typicalCadencePerWeek: z.number().min(0).max(21)
      })
    )
  }).optional(),
  audienceProfile: z.object({
    segments: z.array(z.string().min(1).max(100)).max(10).nullable().optional(),
    excluded: z.array(z.string().min(1).max(100)).max(10).nullable().optional()
  }).optional(),
  pillars: z.array(z.object({
    name: z.string().min(1).max(100),
    weight: z.number().min(0).max(1).optional()
  })).max(10).nullable().optional(),
  claimsPolicy: z.object({
    noGuarantees: z.boolean(),
    noPerformanceNumbersUnlessProvided: z.boolean(),
    requireSourceForStats: z.boolean(),
    competitorMentionPolicy: z.enum(['avoid', 'neutral_only', 'allowed'])
  }).optional(),
  ctaLibrary: z.array(z.object({
    type: z.string().min(1).max(50),
    text: z.string().min(1).max(200),
    defaultUrl: z.string().url().nullable().optional()
  })).max(20).nullable().optional(),
  approvalPolicy: z.object({
    threshold: z.number().min(0).max(1),
    mode: z.enum(['auto_approve', 'require_review_below_threshold', 'always_review'])
  }).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().min(1),
  status: z.enum(['active', 'inactive', 'archived'])
});

export const BrandAssetSchema = z.object({
  assetId: z.string(),
  brandId: z.string(),
  tenantId: z.string(),
  name: z.string().min(1).max(200),
  type: z.enum(['logo', 'template', 'image', 'document']),
  category: z.string().min(1).max(100),
  tags: z.array(z.string().min(1).max(50)).max(20),
  s3Bucket: z.string().min(1).max(100),
  s3Key: z.string().min(1).max(500),
  contentType: z.string().min(1).max(100),
  fileSize: z.number().int().min(1),
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
  createdAt: z.string(),
  updatedAt: z.string()
});

export const CreateBrandRequestSchema = BrandSchema.omit({
  brandId: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  status: true
}).partial({
  platformGuidelines: true,
  audienceProfile: true,
  pillars: true,
  claimsPolicy: true,
  ctaLibrary: true,
  approvalPolicy: true
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

export const generateBrandId = () => {
  return `brand_${ulid()}`;
};

export const generateAssetId = () => {
  return `asset_${ulid()}`;
};

export class Brand {
  static async findById(tenantId, brandId) {
    if (!brandId) {
      return this.getDefaultBrandConfiguration();
    }

    const response = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${brandId}`,
        sk: 'metadata'
      })
    }));

    if (!response.Item) {
      throw new Error(`Brand ${brandId} not found`);
    }

    const rawBrand = unmarshall(response.Item);
    return this.transformFromDynamoDB(rawBrand);
  }

  static getDefaultBrandConfiguration() {
    return {
      brandId: null,
      platformGuidelines: {
        enabled: ['twitter', 'linkedin', 'instagram', 'facebook'],
        defaults: {
          twitter: {
            defaultAsset: 'none',
            linkPolicy: 'allowed',
            emojiPolicy: 'sparing',
            hashtagPolicy: 'allowed',
            typicalCadencePerWeek: 5
          },
          linkedin: {
            defaultAsset: 'none',
            linkPolicy: 'allowed',
            emojiPolicy: 'none',
            hashtagPolicy: 'sparing',
            typicalCadencePerWeek: 3
          },
          instagram: {
            defaultAsset: 'image',
            linkPolicy: 'discouraged',
            emojiPolicy: 'allowed',
            hashtagPolicy: 'allowed',
            typicalCadencePerWeek: 7
          },
          facebook: {
            defaultAsset: 'none',
            linkPolicy: 'allowed',
            emojiPolicy: 'sparing',
            hashtagPolicy: 'sparing',
            typicalCadencePerWeek: 4
          }
        }
      },
      audienceProfile: {
        segments: null,
        excluded: null
      },
      claimsPolicy: {
        noGuarantees: true,
        noPerformanceNumbersUnlessProvided: true,
        requireSourceForStats: true,
        competitorMentionPolicy: 'avoid'
      },
      ctaLibrary: [
        { type: 'learn_more', text: 'Learn more', defaultUrl: null },
        { type: 'get_started', text: 'Get started', defaultUrl: null }
      ],
      approvalPolicy: {
        threshold: 0.7,
        mode: 'auto_approve'
      },
      pillars: [
        { name: 'Brand Awareness', weight: 0.4 },
        { name: 'Education', weight: 0.3 },
        { name: 'Engagement', weight: 0.3 }
      ]
    };
  }

  static transformFromDynamoDB(rawBrand) {
    const cleanBrand = { ...rawBrand };

    delete cleanBrand.pk;
    delete cleanBrand.sk;
    delete cleanBrand.GSI1PK;
    delete cleanBrand.GSI1SK;
    delete cleanBrand.GSI2PK;
    delete cleanBrand.GSI2SK;

    return cleanBrand;
  }

  static transformToDynamoDB(tenantId, brand) {
    const now = new Date().toISOString();

    return {
      pk: `${tenantId}#${brand.brandId}`,
      sk: 'metadata',
      GSI1PK: tenantId,
      GSI1SK: `BRAND#${now}`,
      GSI2PK: `${tenantId}#${brand.status}`,
      GSI2SK: `BRAND#${now}`,
      ...brand
    };
  }

  static extractCadenceDefaults(brand) {
    const platformDefaults = brand?.platformGuidelines?.defaults || {};
    const averageCadence = Object.values(platformDefaults).reduce((sum, platform) =>
      sum + (platform.typicalCadencePerWeek || 3), 0) / Math.max(Object.keys(platformDefaults).length, 1) || 3;

    return {
      averageCadence,
      minPostsPerWeek: Math.max(1, Math.floor(averageCadence * 0.7)),
      maxPostsPerWeek: Math.ceil(averageCadence * 1.3),
      maxPostsPerDay: 2
    };
  }

  static extractAssetRequirements(brand) {
    const platformDefaults = brand?.platformGuidelines?.defaults || {};

    return {
      twitter: platformDefaults.twitter?.defaultAsset === 'image',
      linkedin: platformDefaults.linkedin?.defaultAsset === 'image',
      instagram: platformDefaults.instagram?.defaultAsset !== 'none',
      facebook: platformDefaults.facebook?.defaultAsset === 'image'
    };
  }

  static extractContentRestrictions(brand) {
    return {
      avoidTopics: brand?.contentStandards?.avoidTopics || [],
      avoidPhrases: brand?.contentStandards?.avoidPhrases || []
    };
  }
}
