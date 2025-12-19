import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { z } from 'zod';
import { ulid } from 'ulid';
import { Brand } from './brand.mjs';
import { Persona } from './persona.mjs';

const ddb = new DynamoDBClient();

const ObjectiveSchema = z.enum(['awareness', 'education', 'conversion', 'event', 'launch']);
const PlatformSchema = z.enum(['twitter', 'linkedin', 'instagram', 'facebook']);
const StatusSchema = z.enum(['planning', 'generating', 'completed', 'failed', 'cancelled', 'awaiting_review']);
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

export const CampaignDTOSchema = CampaignSchema.omit({ tenantId: true });

export const CreateCampaignRequestSchema = z.object({
  name: z.string().min(1).max(200),
  brandId: z.string().nullable().optional(),
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
    distribution: DistributionSchema.nullable()
  }),
  schedule: ScheduleSchema,
  cadenceOverrides: CadenceOverridesSchema,
  messaging: MessagingSchema,
  assetOverrides: AssetOverridesSchema,
  metadata: z.object({
    source: z.enum(['wizard', 'api', 'import']).default('api'),
    externalRef: z.string().nullable()
  }).nullable()
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
  static validateEntity(campaign) {
    try {
      return CampaignSchema.parse(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = (error.errors || []).map(e => ({
          field: (e.path || []).join('.'),
          message: e.message || 'Validation failed',
          code: e.code || 'invalid'
        }));
        const errorMessage = `Campaign validation error: ${validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`;
        const validationError = new Error(errorMessage);
        validationError.name = 'ValidationError';
        validationError.details = { errors: validationErrors };
        throw validationError;
      }
      throw error;
    }
  }

  static async save(tenantId, campaign) {
    try {
      const now = new Date().toISOString();
      const campaignWithDefaults = {
        ...campaign,
        tenantId,
        planSummary: campaign.planSummary || null,
        lastError: campaign.lastError || null,
        completedAt: campaign.completedAt || null,
        createdAt: campaign.createdAt || now,
        updatedAt: now
      };

      const validatedCampaign = this.validateEntity(campaignWithDefaults);
      const campaignData = this._transformToDynamoDB(tenantId, validatedCampaign);

      await ddb.send(new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall(campaignData),
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
      }));

      return this._transformFromDynamoDB(campaignData);
    } catch (error) {
      console.error('Campaign save failed', {
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
      return this._transformFromDynamoDB(rawCampaign);
    } catch (error) {
      console.error('Campaign retrieval failed', {
        campaignId,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new Error('Failed to retrieve campaign');
    }
  }

  static _transformFromDynamoDB(rawCampaign) {
    const cleanCampaign = { ...rawCampaign };

    delete cleanCampaign.pk;
    delete cleanCampaign.sk;
    delete cleanCampaign.GSI1PK;
    delete cleanCampaign.GSI1SK;
    delete cleanCampaign.GSI2PK;
    delete cleanCampaign.GSI2SK;
    delete cleanCampaign.tenantId;

    cleanCampaign.id = cleanCampaign.id || rawCampaign.pk?.split('#')[1];

    return CampaignDTOSchema.parse(cleanCampaign);
  }

  static _transformToDynamoDB(tenantId, campaign) {
    const now = new Date().toISOString();

    return {
      pk: `${tenantId}#${campaign.id}`,
      sk: 'campaign',
      GSI1PK: tenantId,
      GSI1SK: `CAMPAIGN#${now}`,
      GSI2PK: tenantId,
      GSI2SK: `CAMPAIGN#${campaign.status}#${now}`,
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

  static validateUpdateData(updateData) {
    try {
      const updateSchema = CampaignSchema.omit({
        id: true,
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
        const errorMessage = `Campaign update validation error: ${validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`;
        const validationError = new Error(errorMessage);
        validationError.name = 'ValidationError';
        validationError.details = { errors: validationErrors };
        throw validationError;
      }
      throw error;
    }
  }

  static async update(tenantId, campaignId, updateData) {
    try {
      const validatedUpdateData = this.validateUpdateData(updateData);
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
      console.error('Campaign update failed', {
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
      const { limit = 20, nextToken, status, brandId, personaId } = options;

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
        FilterExpression: status ? '#status = :status' : undefined,
        ExpressionAttributeNames: status ? { '#status': 'status' } : undefined,
        ExpressionAttributeValues: marshall({
          ':tenantId': tenantId,
          ':campaignPrefix': 'CAMPAIGN#',
          ...(status && { ':status': status })
        }),
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey ? marshall(exclusiveStartKey) : undefined
      }));

      let campaigns = response.Items?.map(item => {
        const rawCampaign = unmarshall(item);
        return this._transformFromDynamoDB(rawCampaign);
      }) || [];

      if (brandId) {
        campaigns = campaigns.filter(campaign => campaign.brandId === brandId);
      }

      if (personaId) {
        campaigns = campaigns.filter(campaign =>
          campaign.participants.personaIds.includes(personaId)
        );
      }

      const result = {
        items: campaigns,
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
      console.error('Campaign list failed', {
        tenantId,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new Error('Failed to list campaigns');
    }
  }
}
