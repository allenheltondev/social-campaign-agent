import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { z } from 'zod';
import { ulid } from 'ulid';
import { logger } from '../utils/logger.mjs';

const ddb = new DynamoDBClient();

const UsageIntentSchema = z.object({
  platforms: z.array(z.enum(['twitter', 'linkedin', 'instagram', 'facebook'])).optional(),
  themes: z.array(z.string().trim().min(1).max(100)).optional(),
  frequency: z.enum(['high', 'medium', 'low']).optional()
}).optional().nullable();

const InternalAssetAssociationSchema = z.object({
  type: z.literal('internal'),
  assetId: z.string(),
  usageIntent: UsageIntentSchema.optional(),
  isDefault: z.boolean().optional().default(false),
  categories: z.array(z.string().trim().min(1).max(100)).max(10).optional().nullable(),
  addedAt: z.string().optional(),
  addedBy: z.string().optional()
});

const ExternalAssetAssociationSchema = z.object({
  type: z.literal('external'),
  url: z.string().url().refine(url => url.startsWith('https://'), {
    message: 'External asset URLs must use HTTPS protocol'
  }),
  description: z.string().trim().min(10).max(500),
  contentType: z.string().trim().min(1).max(100),
  usageIntent: UsageIntentSchema.optional(),
  isDefault: z.boolean().optional().default(false),
  categories: z.array(z.string().trim().min(1).max(100)).max(10).optional().nullable(),
  addedAt: z.string().optional(),
  addedBy: z.string().optional()
});

const BrandAssetAssociationSchema = z.discriminatedUnion('type', [
  InternalAssetAssociationSchema,
  ExternalAssetAssociationSchema
]);

const AssetLibraryStatsSchema = z.object({
  totalAssets: z.number().int().min(0).default(0),
  internalAssets: z.number().int().min(0).default(0),
  externalAssets: z.number().int().min(0).default(0),
  defaultAssets: z.number().int().min(0).default(0),
  lastUpdated: z.string()
}).optional().nullable();

export const BrandSchema = z.object({
  brandId: z.string(),
  tenantId: z.string(),
  name: z.string().trim().min(1).max(100),
  ethos: z.string().trim().min(1).max(1000),
  coreValues: z.array(z.string().trim().min(1).max(200)).min(1).max(10),
  primaryAudience: z.enum(['executives', 'professionals', 'consumers', 'technical', 'creative']),
  voiceGuidelines: z.object({
    tone: z.array(z.string().trim().min(1).max(50)).min(1).max(10),
    style: z.array(z.string().trim().min(1).max(50)).min(1).max(10),
    messaging: z.array(z.string().trim().min(1).max(100)).min(1).max(10)
  }),
  visualIdentity: z.object({
    colorPalette: z.array(z.string().trim().min(1).max(50)).min(1).max(10),
    typography: z.array(z.string().trim().min(1).max(100)).min(1).max(5),
    imagery: z.array(z.string().trim().min(1).max(100)).min(1).max(10)
  }),
  contentStandards: z.object({
    qualityRequirements: z.array(z.string().trim().min(1).max(100)).min(1).max(10),
    restrictions: z.array(z.string().trim().min(1).max(200)).max(20)
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
    segments: z.array(z.string().trim().min(1).max(100)).max(10).nullable().optional(),
    excluded: z.array(z.string().trim().min(1).max(100)).max(10).nullable().optional()
  }).optional(),
  pillars: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    weight: z.number().min(0).max(1).optional()
  })).max(10).nullable().optional(),
  claimsPolicy: z.object({
    noGuarantees: z.boolean(),
    noPerformanceNumbersUnlessProvided: z.boolean(),
    requireSourceForStats: z.boolean(),
    competitorMentionPolicy: z.enum(['avoid', 'neutral_only', 'allowed'])
  }).optional(),
  ctaLibrary: z.array(z.object({
    type: z.string().trim().min(1).max(50),
    text: z.string().trim().min(1).max(200),
    defaultUrl: z.url().nullable().optional()
  })).max(20).nullable().optional(),
  approvalPolicy: z.object({
    threshold: z.number().min(0).max(1),
    mode: z.enum(['auto_approve', 'require_review_below_threshold', 'always_review'])
  }).optional(),
  assets: z.array(BrandAssetAssociationSchema).max(50).optional().nullable(),
  assetLibraryStats: AssetLibraryStatsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(['active', 'inactive', 'archived'])
});

export const BrandAssetSchema = z.object({
  assetId: z.string(),
  brandId: z.string(),
  tenantId: z.string(),
  name: z.string().trim().min(1).max(200),
  type: z.enum(['logo', 'template', 'image', 'document']),
  category: z.string().trim().min(1).max(100),
  tags: z.array(z.string().trim().min(1).max(50)).max(20),
  s3Bucket: z.string().trim().min(1).max(100),
  s3Key: z.string().trim().min(1).max(500),
  contentType: z.string().trim().min(1).max(100),
  fileSize: z.number().int().min(1),
  usageRules: z.object({
    placement: z.string().trim().max(500).optional(),
    sizing: z.object({
      minWidth: z.number().int().min(1).optional(),
      maxWidth: z.number().int().min(1).optional(),
      minHeight: z.number().int().min(1).optional(),
      maxHeight: z.number().int().min(1).optional()
    }).optional(),
    restrictions: z.array(z.string().trim().max(200)).max(10)
  }),
  createdAt: z.string(),
  updatedAt: z.string()
});

export {
  UsageIntentSchema,
  InternalAssetAssociationSchema,
  ExternalAssetAssociationSchema,
  BrandAssetAssociationSchema,
  AssetLibraryStatsSchema
};

export const validateRequestBody = (schema, body) => {
  try {
    const parsed = JSON.parse(body);
    return schema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationErrors = (error.errors || []).map(e => ({
        field: (e.path || []).join('.'),
        message: e.message || 'Validation failed',
        code: e.code || 'invalid'
      }));
      const errorMessage = `Validation error: ${validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`;
      const validationError = new Error(errorMessage);
      validationError.name = 'ValidationError';
      validationError.details = { errors: validationErrors };
      throw validationError;
    }
    const parseError = new Error('Invalid JSON in request body');
    parseError.name = 'ParseError';
    throw parseError;
  }
};

export const validateQueryParams = (schema, params) => {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationErrors = (error.errors || []).map(e => ({
        field: (e.path || []).join('.'),
        message: e.message || 'Validation failed',
        code: e.code || 'invalid'
      }));
      const errorMessage = `Query parameter validation error: ${validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`;
      const validationError = new Error(errorMessage);
      validationError.name = 'ValidationError';
      validationError.details = { errors: validationErrors };
      throw validationError;
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
    try {
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
        return null;
      }

      const rawBrand = unmarshall(response.Item);

      if (rawBrand.status === 'archived') {
        return null;
      }

      return this.fromDynamoDB(rawBrand);
    } catch (error) {
      logger.error('Brand retrieval failed', {
        operation: 'findById',
        tenantId,
        brandId,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new Error('Failed to retrieve brand');
    }
  }

  static async save(tenantId, brand) {
    try {
      const { PutItemCommand } = await import('@aws-sdk/client-dynamodb');

      const now = new Date().toISOString();
      const brandId = brand.id || generateBrandId();

      const assetLibraryStats = this._calculateAssetLibraryStats(brand.assets, now);

      const brandWithDefaults = {
        ...brand,
        brandId,
        tenantId,
        createdAt: brand.createdAt || now,
        updatedAt: now,
        status: brand.status || 'active',
        assetLibraryStats
      };

      const validatedBrand = BrandSchema.parse(brandWithDefaults);
      const dynamoItem = this.toDynamoDB(tenantId, validatedBrand);

      await ddb.send(new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall(dynamoItem),
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
      }));

      return this.fromDynamoDB(dynamoItem);
    } catch (error) {
      logger.error('Brand save failed', {
        operation: 'save',
        tenantId,
        brandId: brand.id,
        errorName: error.name,
        errorMessage: error.message
      });
      if (error.name === 'ValidationError') {
        throw error;
      }
      throw new Error('Failed to save brand');
    }
  }

  static async update(tenantId, brandId, updateData) {
    try {
      const { UpdateItemCommand } = await import('@aws-sdk/client-dynamodb');

      const updateSchema = BrandSchema.omit({
        brandId: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true
      }).partial();
      const validatedUpdateData = updateSchema.parse(updateData);
      const now = new Date().toISOString();

      if (validatedUpdateData.assets !== undefined) {
        validatedUpdateData.assetLibraryStats = this._calculateAssetLibraryStats(validatedUpdateData.assets, now);
      }

      const updateDataWithTimestamp = {
        ...validatedUpdateData,
        updatedAt: now
      };

      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      Object.keys(updateDataWithTimestamp).forEach((key, index) => {
        const attrName = `#attr${index}`;
        const attrValue = `:val${index}`;

        updateExpression.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = key;
        expressionAttributeValues[attrValue] = updateDataWithTimestamp[key];
      });

      const response = await ddb.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({
          pk: `${tenantId}#${brandId}`,
          sk: 'metadata'
        }),
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
        ReturnValues: 'ALL_NEW'
      }));

      if (!response.Attributes) {
        return null;
      }

      return this.fromDynamoDB(unmarshall(response.Attributes));
    } catch (error) {
      logger.error('Brand update failed', {
        operation: 'update',
        tenantId,
        brandId,
        errorName: error.name,
        errorMessage: error.message
      });
      if (error.name === 'ValidationError') {
        throw error;
      }
      throw new Error('Failed to update brand');
    }
  }

  static async delete(tenantId, brandId) {
    try {
      const now = new Date().toISOString();
      const ttl = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

      await ddb.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({
          pk: `${tenantId}#${brandId}`,
          sk: 'metadata'
        }),
        UpdateExpression: 'SET #status = :archived, #updatedAt = :now, #ttl = :ttl',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#updatedAt': 'updatedAt',
          '#ttl': 'ttl'
        },
        ExpressionAttributeValues: marshall({
          ':archived': 'archived',
          ':now': now,
          ':ttl': ttl
        }),
        ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)'
      }));

      return { success: true };
    } catch (error) {
      logger.error('Brand delete failed', {
        operation: 'delete',
        tenantId,
        brandId,
        errorName: error.name,
        errorMessage: error.message
      });
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('Brand not found');
      }
      throw new Error('Failed to delete brand');
    }
  }

  static getDefaultBrandConfiguration() {
    return {
      id: null,
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

  static fromDynamoDB(rawBrand) {
    const cleanBrand = { ...rawBrand };

    delete cleanBrand.pk;
    delete cleanBrand.sk;
    delete cleanBrand.GSI1PK;
    delete cleanBrand.GSI1SK;
    delete cleanBrand.GSI2PK;
    delete cleanBrand.GSI2SK;

    delete cleanBrand.tenantId;

    cleanBrand.id = cleanBrand.brandId;
    delete cleanBrand.brandId;

    return cleanBrand;
  }

  static toDynamoDB(tenantId, brand) {
    const now = new Date().toISOString();
    const brandId = brand.id || brand.brandId;

    return {
      pk: `${tenantId}#${brandId}`,
      sk: 'metadata',
      GSI1PK: tenantId,
      GSI1SK: `BRAND#${now}`,
      ...brand,
      brandId,
      tenantId
    };
  }

  static async list(tenantId, options = {}) {
    try {
      const { QueryCommand } = await import('@aws-sdk/client-dynamodb');
      const { nextToken, limit = 50 } = options;

      let exclusiveStartKey;
      if (nextToken) {
        try {
          exclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
        } catch (e) {
          throw new Error('Invalid nextToken');
        }
      }

      const response = await ddb.send(new QueryCommand({
        TableName: process.env.TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :tenantId AND begins_with(GSI1SK, :brandPrefix)',
        FilterExpression: '#status <> :archived',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: marshall({
          ':tenantId': tenantId,
          ':brandPrefix': 'BRAND#',
          ':archived': 'archived'
        }),
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey ? marshall(exclusiveStartKey) : undefined
      }));

      const brands = response.Items?.map(item => {
        const rawBrand = unmarshall(item);
        return this.fromDynamoDB(rawBrand);
      }) || [];

      const brandListResult = {
        items: brands,
        pagination: {
          limit,
          hasNextPage: !!response.LastEvaluatedKey,
          nextToken: response.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(unmarshall(response.LastEvaluatedKey))).toString('base64')
            : null
        }
      };

      return brandListResult;
    } catch (error) {
      logger.error('Brand list failed', {
        operation: 'list',
        tenantId,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new Error('Failed to list brands');
    }
  }

  static _calculateAssetLibraryStats(assets, timestamp) {
    if (!assets || assets.length === 0) {
      return null;
    }

    const stats = {
      totalAssets: assets.length,
      internalAssets: assets.filter(a => a.type === 'internal').length,
      externalAssets: assets.filter(a => a.type === 'external').length,
      defaultAssets: assets.filter(a => a.isDefault === true).length,
      lastUpdated: timestamp
    };

    return stats;
  }

  static async validateAssetAssociations(tenantId, assets) {
    if (!assets || assets.length === 0) {
      return { valid: true, errors: [] };
    }

    const errors = [];
    const { Asset } = await import('./asset.mjs');

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];

      if (asset.type === 'internal') {
        try {
          const existingAsset = await Asset.findById(tenantId, asset.assetId);
          if (!existingAsset) {
            errors.push({
              index: i,
              field: `assets[${i}].assetId`,
              message: `Asset ${asset.assetId} does not exist`
            });
          }
        } catch (error) {
          errors.push({
            index: i,
            field: `assets[${i}].assetId`,
            message: `Failed to validate asset ${asset.assetId}`
          });
        }
      } else if (asset.type === 'external') {
        if (!asset.url.startsWith('https://')) {
          errors.push({
            index: i,
            field: `assets[${i}].url`,
            message: 'External asset URLs must use HTTPS protocol'
          });
        }

        if (!asset.description || asset.description.trim().length < 10) {
          errors.push({
            index: i,
            field: `assets[${i}].description`,
            message: 'External asset description must be at least 10 characters'
          });
        }

        if (asset.description && asset.description.length > 500) {
          errors.push({
            index: i,
            field: `assets[${i}].description`,
            message: 'External asset description must not exceed 500 characters'
          });
        }

        if (!asset.contentType) {
          errors.push({
            index: i,
            field: `assets[${i}].contentType`,
            message: 'External asset contentType is required'
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

