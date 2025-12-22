import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
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
    defaultUrl: z.url().nullable().optional()
  })).max(20).nullable().optional(),
  approvalPolicy: z.object({
    threshold: z.number().min(0).max(1),
    mode: z.enum(['auto_approve', 'require_review_below_threshold', 'always_review'])
  }).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
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
  static validateEntity(brand) {
    try {
      return BrandSchema.parse(brand);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = (error.errors || []).map(e => ({
          field: (e.path || []).join('.'),
          message: e.message || 'Validation failed',
          code: e.code || 'invalid'
        }));
        const errorMessage = `Brand validation error: ${validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`;
        const validationError = new Error(errorMessage);
        validationError.name = 'ValidationError';
        validationError.details = { errors: validationErrors };
        throw validationError;
      }
      throw error;
    }
  }

  static validateUpdateData(updateData) {
    try {
      const updateSchema = BrandSchema.omit({
        brandId: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true
      }).partial();
      return updateSchema.parse(updateData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = (error.errors || []).map(e => ({
          field: (e.path || []).join('.'),
          message: e.message || 'Validation failed',
          code: e.code || 'invalid'
        }));
        const errorMessage = `Brand update validation error: ${validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`;
        const validationError = new Error(errorMessage);
        validationError.name = 'ValidationError';
        validationError.details = { errors: validationErrors };
        throw validationError;
      }
      throw error;
    }
  }
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

      return this._transformFromDynamoDB(rawBrand);
    } catch (error) {
      console.error('Brand retrieval failed', {
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

      const brandWithDefaults = {
        ...brand,
        brandId,
        tenantId,
        createdAt: brand.createdAt || now,
        updatedAt: now,
        status: brand.status || 'active'
      };

      const validatedBrand = this.validateEntity(brandWithDefaults);
      const dynamoItem = this._transformToDynamoDB(tenantId, validatedBrand);

      await ddb.send(new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall(dynamoItem),
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
      }));

      return this._transformFromDynamoDB(dynamoItem);
    } catch (error) {
      console.error('Brand save failed', {
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

      const validatedUpdateData = this.validateUpdateData(updateData);
      const now = new Date().toISOString();
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

      return this._transformFromDynamoDB(unmarshall(response.Attributes));
    } catch (error) {
      console.error('Brand update failed', {
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

      const response = await ddb.send(new UpdateItemCommand({
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
      console.error('Brand delete failed', {
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

  static transformFromDynamoDB(rawBrand) {
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

  static _transformFromDynamoDB(rawBrand) {
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

  static _transformToDynamoDB(tenantId, brand) {
    const now = new Date().toISOString();
    const brandId = brand.id || brand.brandId;

    return {
      pk: `${tenantId}#${brandId}`,
      sk: 'metadata',
      GSI1PK: tenantId,
      GSI1SK: `BRAND#${now}`,
      GSI2PK: `${tenantId}#${brand.status}`,
      GSI2SK: `BRAND#${now}`,
      ...brand,
      brandId,
      tenantId
    };
  }

  static transformToDynamoDB(tenantId, brand) {
    return this._transformToDynamoDB(tenantId, brand);
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

  static async list(tenantId, options = {}) {
    try {
      const { QueryCommand } = await import('@aws-sdk/client-dynamodb');
      const { limit = 20, nextToken, search, status } = options;

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
        FilterExpression: status ? '#status = :status AND #status <> :archived' : '#status <> :archived',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: marshall({
          ':tenantId': tenantId,
          ':brandPrefix': 'BRAND#',
          ':archived': 'archived',
          ...(status && { ':status': status })
        }),
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey ? marshall(exclusiveStartKey) : undefined
      }));

      let brands = response.Items?.map(item => {
        const rawBrand = unmarshall(item);
        return this._transformFromDynamoDB(rawBrand);
      }) || [];

      if (search) {
        const searchTerm = search.toLowerCase();
        brands = brands.filter(brand =>
          brand.name.toLowerCase().includes(searchTerm) ||
          brand.ethos.toLowerCase().includes(searchTerm) ||
          brand.coreValues.some(value => value.toLowerCase().includes(searchTerm))
        );
      }

      const result = {
        items: brands,
        pagination: {
          limit,
          hasNextPage: !!response.LastEvaluatedKey,
          nextToken: response.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(unmarshall(response.LastEvaluatedKey))).toString('base64')
            : null
        }
      };

      return result;
    } catch (error) {
      console.error('Brand list failed', {
        tenantId,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new Error('Failed to list brands');
    }
  }

  static extractContentRestrictions(brand) {
    return {
      avoidTopics: brand?.contentStandards?.restrictions || [],
      avoidPhrases: brand?.contentStandards?.restrictions || []
    };
  }
}
