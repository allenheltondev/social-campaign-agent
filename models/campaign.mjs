import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { z } from 'zod';
import { ulid } from 'ulid';
import { Brand } from './brand.mjs';
import { Persona } from './persona.mjs';
import { Asset, ExternalAssetSchema } from './asset.mjs';
import { logger } from '../utils/logger.mjs';

const ddb = new DynamoDBClient();

const ObjectiveSchema = z.enum(['awareness', 'education', 'conversion', 'event', 'launch']);
const PlatformSchema = z.enum(['twitter', 'linkedin', 'instagram', 'facebook']);
const StatusSchema = z.enum(['planning', 'generating', 'completed', 'failed', 'cancelled']);

const DayOfWeekSchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

const CTASchema = z.object({
  type: z.string().min(1),
  text: z.string().min(1),
  url: z.url().nullable()
}).nullable();

const DistributionSchema = z.object({
  mode: z.enum(['balanced', 'weighted', 'custom']).default('balanced'),
  personaWeights: z.record(z.number().min(0).max(1)).nullable().optional(),
  platformWeights: z.record(z.number().min(0).max(1)).nullable().optional()
});

const PostingWindowSchema = z.object({
  start: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  end: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
});

const ScheduleSchema = z.object({
  timezone: z.string().min(1),
  startDate: z.iso.datetime(),
  endDate: z.iso.datetime(),
  allowedDaysOfWeek: z.array(DayOfWeekSchema).min(1).max(7),
  blackoutDates: z.array(z.iso.datetime()).nullable(),
  postingWindows: z.array(PostingWindowSchema).nullable()
}).refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  { message: 'End date must be after start date' }
);

const CadenceOverridesSchema = z.object({
  minPostsPerWeek: z.number().int().min(1).nullable(),
  maxPostsPerWeek: z.number().int().min(1).nullable(),
  maxPostsPerDay: z.number().int().min(1).nullable()
}).nullable();

const MessagingPillarSchema = z.object({
  name: z.string().min(1),
  weight: z.number().min(0).max(1)
});

const MessagingSchema = z.object({
  pillars: z.array(MessagingPillarSchema).nullable(),
  requiredInclusions: z.array(z.string().min(1)).nullable(),
  campaignAvoidTopics: z.array(z.string().min(1)).nullable()
}).nullable().refine(
  (data) => {
    if (data?.pillars) {
      const totalWeight = data.pillars.reduce((sum, pillar) => sum + pillar.weight, 0);
      return Math.abs(totalWeight - 1.0) < 0.001;
    }
    return true;
  },
  { message: 'Messaging pillar weights must sum to 1.0' }
);

const AssetOverridesSchema = z.object({
  forceVisuals: z.object({
    twitter: z.boolean().nullable(),
    linkedin: z.boolean().nullable(),
    instagram: z.boolean().nullable(),
    facebook: z.boolean().nullable()
  }).nullable()
}).nullable();

const InternalAssetReferenceSchema = z.object({
  assetId: z.string(),
  type: z.literal('internal'),
  addedAt: z.string().optional()
});

const CampaignAssetSchema = z.union([
  InternalAssetReferenceSchema,
  ExternalAssetSchema
]);

const UsageIntentSchema = z.object({
  platforms: z.array(z.string()).nullable(),
  themes: z.array(z.string()).nullable(),
  frequency: z.string().nullable()
}).nullable();

const AssetPoolItemSchema = z.object({
  type: z.enum(['internal', 'external']),
  assetId: z.string().nullable(),
  url: z.string().nullable(),
  description: z.string(),
  contentType: z.string(),
  usageIntent: UsageIntentSchema.optional(),
  isDefault: z.boolean(),
  category: z.string().nullable().optional(),
  source: z.enum(['brand', 'campaign'])
});

const AssetPoolSchema = z.object({
  brandDefaults: z.array(AssetPoolItemSchema),
  campaignSpecific: z.array(AssetPoolItemSchema)
}).nullable();

const AssetPoolStatsSchema = z.object({
  totalAssets: z.number().int().min(0),
  brandAssets: z.number().int().min(0),
  campaignAssets: z.number().int().min(0),
  defaultAssets: z.number().int().min(0)
}).nullable();

const ErrorTrackingSchema = z.object({
  code: z.string(),
  message: z.string(),
  at: z.iso.datetime(),
  retryable: z.boolean()
}).nullable();

export const CampaignSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  brandId: z.string().nullable(),
  name: z.string().min(1).max(200),
  brief: z.object({
    description: z.string().min(10).max(2000),
    objective: ObjectiveSchema,
    primaryCTA: CTASchema
  }).refine(
    (data) => {
      const requiresCTA = ['conversion', 'event'].includes(data.objective);
      return !requiresCTA || data.primaryCTA;
    },
    { message: 'Primary CTA is required for conversion and event objectives' }
  ),
  participants: z.object({
    personaIds: z.array(z.string()).min(1).max(10),
    platforms: z.array(PlatformSchema).min(1),
    distribution: DistributionSchema
  }),
  schedule: ScheduleSchema,
  cadenceOverrides: CadenceOverridesSchema,
  messaging: MessagingSchema,
  assetOverrides: AssetOverridesSchema,
  assets: z.array(CampaignAssetSchema).nullable().optional(),
  assetPool: AssetPoolSchema.optional(),
  assetPoolStats: AssetPoolStatsSchema.optional(),
  status: StatusSchema,
  planSummary: z.object({
    totalPosts: z.number().int().min(0),
    postsPerPlatform: z.record(z.number().int().min(0)),
    postsPerPersona: z.record(z.number().int().min(0))
  }).nullable().optional(),
  lastError: ErrorTrackingSchema.optional(),
  metadata: z.object({
    source: z.enum(['wizard', 'api', 'import']).default('api'),
    externalRef: z.string().nullable()
  }),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable().optional()
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

export const generateCampaignId = () => {
  return ulid();
};

export class Campaign {
  static async validateAssets(tenantId, assets) {
    if (!assets || assets.length === 0) {
      return { valid: true, validatedAssets: [] };
    }

    const validatedAssets = [];
    const errors = [];

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];

      try {
        if (asset.type === 'internal') {
          const existingAsset = await Asset.findById(tenantId, asset.assetId);
          if (!existingAsset) {
            errors.push(`Internal asset ${asset.assetId} not found`);
            continue;
          }
          if (existingAsset.uploadStatus !== 'completed') {
            errors.push(`Internal asset ${asset.assetId} upload not completed`);
            continue;
          }

          validatedAssets.push({
            ...asset,
            addedAt: asset.addedAt || new Date().toISOString()
          });
        } else if (asset.type === 'external') {
          if (!asset.url.startsWith('https://')) {
            errors.push(`External asset URL must use HTTPS protocol: ${asset.url}`);
            continue;
          }

          validatedAssets.push({
            ...asset,
            addedAt: asset.addedAt || new Date().toISOString()
          });
        } else {
          errors.push(`Invalid asset type at index ${i}: ${asset.type}`);
        }
      } catch (error) {
        errors.push(`Asset validation failed at index ${i}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      const validationError = new Error(`Asset validation errors: ${errors.join(', ')}`);
      validationError.name = 'ValidationError';
      validationError.details = { errors: errors.map(error => ({ message: error })) };
      throw validationError;
    }

    return { valid: true, validatedAssets };
  }

  static async save(tenantId, campaign) {
    try {
      const now = new Date().toISOString();

      let validatedAssets = [];
      if (campaign.assets) {
        const { validatedAssets: assets } = await this.validateAssets(tenantId, campaign.assets);
        validatedAssets = assets;
      }

      const campaignWithDefaults = {
        ...campaign,
        tenantId,
        assets: validatedAssets.length > 0 ? validatedAssets : null,
        planSummary: campaign.planSummary || null,
        lastError: campaign.lastError || null,
        completedAt: campaign.completedAt || null,
        createdAt: campaign.createdAt || now,
        updatedAt: now
      };

      const validatedCampaign = CampaignSchema.parse(campaignWithDefaults);
      const campaignData = this.toDynamoDB(tenantId, validatedCampaign);

      await ddb.send(new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall(campaignData),
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
      }));

      return this.fromDynamoDB(campaignData);
    } catch (error) {
      logger.error('Campaign save failed', {
        operation: 'save',
        tenantId,
        campaignId: campaign.id,
        errorName: error.name,
        errorMessage: error.message
      });
      if (error.name === 'ValidationError') {
        throw error;
      }
      throw new Error('Failed to save campaign');
    }
  }

  static async findById(tenantId, campaignId) {
    try {
      const response = await ddb.send(new GetItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({
          pk: `${tenantId}#${campaignId}`,
          sk: 'campaign'
        })
      }));

      if (!response.Item) {
        return null;
      }

      const rawCampaign = unmarshall(response.Item);
      return this.fromDynamoDB(rawCampaign);
    } catch (error) {
      logger.error('Campaign retrieval failed', {
        operation: 'findById',
        tenantId,
        campaignId,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new Error('Failed to retrieve campaign');
    }
  }

  static fromDynamoDB(rawCampaign) {
    const cleanCampaign = { ...rawCampaign };

    delete cleanCampaign.pk;
    delete cleanCampaign.sk;
    delete cleanCampaign.GSI1PK;
    delete cleanCampaign.GSI1SK;
    delete cleanCampaign.tenantId;

    cleanCampaign.id = cleanCampaign.id || rawCampaign.pk?.split('#')[1];

    return CampaignSchema.omit({ tenantId: true }).parse(cleanCampaign);
  }

  static toDynamoDB(tenantId, campaign) {
    const now = new Date().toISOString();

    return {
      pk: `${tenantId}#${campaign.id}`,
      sk: 'campaign',
      GSI1PK: tenantId,
      GSI1SK: `CAMPAIGN#${now}`,
      ...campaign
    };
  }

  static async loadFullConfiguration(tenantId, campaignId) {
    const campaign = await this.findById(tenantId, campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    const [brandConfig, personaConfigs] = await Promise.all([
      Brand.findById(tenantId, campaign.brandId),
      Persona.findByIds(tenantId, campaign.participants.personaIds)
    ]);

    return {
      campaign,
      brandConfig,
      personaConfigs
    };
  }

  static async update(tenantId, campaignId, updateData) {
    try {
      const validatedUpdateData = CampaignSchema.omit({
        id: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true
      }).partial().parse(updateData);
      const now = new Date().toISOString();
      const updateDataWithTimestamp = { ...validatedUpdateData, updatedAt: now };

      const updateExpressionParts = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      Object.keys(updateDataWithTimestamp).forEach((key, index) => {
        const attributeName = `#attr${index}`;
        const attributeValue = `:val${index}`;

        updateExpressionParts.push(`${attributeName} = ${attributeValue}`);
        expressionAttributeNames[attributeName] = key;
        expressionAttributeValues[attributeValue] = updateDataWithTimestamp[key];
      });

      const updateExpression = `SET ${updateExpressionParts.join(', ')}`;

      await ddb.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({
          pk: `${tenantId}#${campaignId}`,
          sk: 'campaign'
        }),
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues)
      }));

      const updatedCampaign = await this.findById(tenantId, campaignId);
      return updatedCampaign;
    } catch (error) {
      logger.error('Campaign update failed', {
        operation: 'update',
        tenantId,
        campaignId,
        errorName: error.name,
        errorMessage: error.message
      });
      if (error.name === 'ValidationError') {
        throw error;
      }
      throw new Error('Failed to update campaign');
    }
  }

  static async list(tenantId, options = {}) {
    try {
      const { QueryCommand } = await import('@aws-sdk/client-dynamodb');
      const { limit = 20, nextToken } = options;

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
        KeyConditionExpression: 'GSI1PK = :tenantId AND begins_with(GSI1SK, :campaignPrefix)',
        ExpressionAttributeValues: marshall({
          ':tenantId': tenantId,
          ':campaignPrefix': 'CAMPAIGN#'
        }),
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey ? marshall(exclusiveStartKey) : undefined
      }));

      const campaigns = response.Items?.map(item => {
        const rawCampaign = unmarshall(item);
        return this.fromDynamoDB(rawCampaign);
      }) || [];

      const campaignListResponse = {
        items: campaigns,
        pagination: {
          limit,
          hasNextPage: !!response.LastEvaluatedKey,
          nextToken: response.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(unmarshall(response.LastEvaluatedKey))).toString('base64')
            : null
        }
      };

      return campaignListResponse;
    } catch (error) {
      logger.error('Campaign list failed', {
        operation: 'list',
        tenantId,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new Error('Failed to list campaigns');
    }
  }
}

