import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, BatchWriteItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { z } from 'zod';
import { ulid } from 'ulid';
import { Brand } from './brand.mjs';
import { Persona } from './persona.mjs';
import crypto from 'crypto';

const ddb = new DynamoDBClient();
const eventBridge = new EventBridgeClient();

const ObjectiveSchema = z.enum(['awareness', 'education', 'conversion', 'event', 'launch']);
const PlatformSchema = z.enum(['twitter', 'linkedin', 'instagram', 'facebook']);
const StatusSchema = z.enum(['planning', 'generating', 'completed', 'failed', 'cancelled', 'awaiting_review']);
const DayOfWeekSchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const IntentSchema = z.enum(['announce', 'educate', 'opinion', 'invite_discussion', 'social_proof', 'reminder']);
const PostStatusSchema = z.enum(['planned', 'generating', 'completed', 'failed', 'skipped', 'needs_review']);

const CTASchema = z.object({
  type: z.string().min(1),
  text: z.string().min(1),
  url: z.string().url().nullable()
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
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  allowedDaysOfWeek: z.array(DayOfWeekSchema).min(1).max(7),
  blackoutDates: z.array(z.string().datetime()).nullable(),
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
  at: z.string().datetime(),
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
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().optional(),
  version: z.number().int().min(1),
  planVersion: z.string().nullable().optional()
});

export const SocialPostSchema = z.object({
  postId: z.string(),
  campaignId: z.string(),
  tenantId: z.string(),
  personaId: z.string(),
  platform: PlatformSchema,
  scheduledAt: z.string().datetime(),
  topic: z.string().min(1).max(500),
  intent: IntentSchema,
  assetRequirements: z.object({
    imageRequired: z.boolean(),
    imageDescription: z.string().optional(),
    videoRequired: z.boolean(),
    videoDescription: z.string().optional()
  }).optional(),
  content: z.object({
    text: z.string(),
    hashtags: z.array(z.string()).optional(),
    mentions: z.array(z.string()).optional(),
    generatedAt: z.string().datetime()
  }).optional(),
  references: z.array(z.object({
    type: z.enum(['url', 'assetId']),
    value: z.string()
  })).optional(),
  status: PostStatusSchema,
  lastError: ErrorTrackingSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().min(1)
});

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
      throw new Error(`Validation error: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw new Error('Invalid JSON in request body');
  }
};

export const generateCampaignId = () => {
  return `campaign_${ulid()}`;
};

export const generatePostId = () => {
  return `post_${ulid()}`;
};

export class Campaign {
  static async save(tenantId, campaign) {
    const now = new Date().toISOString();
    const campaignData = this.transformToDynamoDB(tenantId, {
      ...campaign,
      planSummary: campaign.planSummary || null,
      lastError: campaign.lastError || null,
      completedAt: campaign.completedAt || null,
      planVersion: campaign.planVersion || null,
      createdAt: campaign.createdAt || now,
      updatedAt: now,
      version: campaign.version || 1
    });

    await ddb.send(new PutItemCommand({
      TableName: process.env.TABLE_NAME,
      Item: marshall(campaignData),
      ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
    }));

    return campaign;
  }

  static async findById(tenantId, campaignId) {
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
    return this.transformFromDynamoDB(rawCampaign);
  }

  static transformFromDynamoDB(rawCampaign) {
    const cleanCampaign = { ...rawCampaign };

    delete cleanCampaign.pk;
    delete cleanCampaign.sk;
    delete cleanCampaign.GSI1PK;
    delete cleanCampaign.GSI1SK;
    delete cleanCampaign.GSI2PK;
    delete cleanCampaign.GSI2SK;

    return CampaignSchema.parse(cleanCampaign);
  }

  static transformToDynamoDB(tenantId, campaign) {
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

  static async loadCampaignPosts(tenantId, campaignId) {
    const response = await ddb.send(new QueryCommand({
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
      ExpressionAttributeValues: marshall({
        ':pk': `${tenantId}#${campaignId}`,
        ':skPrefix': 'POST#'
      })
    }));

    if (!response.Items || response.Items.length === 0) {
      return [];
    }

    return response.Items.map(item => {
      const post = unmarshall(item);
      delete post.pk;
      delete post.sk;
      delete post.GSI1PK;
      delete post.GSI1SK;
      delete post.GSI2PK;
      delete post.GSI2SK;
      return post;
    });
  }

  static generatePlanVersion(campaign, context) {
    return crypto.createHash('sha256')
      .update(JSON.stringify({
        brief: campaign.brief,
        participants: campaign.participants,
        schedule: campaign.schedule,
        cadence: context.cadence,
        messaging: context.messaging,
        assetRequirements: context.assetRequirements
      }))
      .digest('hex')
      .substring(0, 16);
  }

  static async createSocialPosts(campaignId, tenantId, planVersion, posts) {
    const createdPosts = [];
    const now = new Date().toISOString();
    try {
      const batchSize = 25;
      for (let i = 0; i < posts.length; i += batchSize) {
        const batch = posts.slice(i, i + batchSize);
        const writeRequests = [];

        for (const post of batch) {
          const postId = generatePostId();
          const postItem = {
            id: postId,
            campaignId,
            tenantId,
            personaId: post.personaId,
            platform: post.platform,
            scheduledAt: post.scheduledDate,
            topic: post.topic,
            intent: post.intent,
            assetRequirements: post.assetRequirements,
            references: post.references,
            status: 'planned',
            createdAt: now,
            updatedAt: now,
            version: 1
          };

          writeRequests.push({
            PutRequest: {
              Item: marshall({
                pk: `${tenantId}#${campaignId}`,
                sk: `POST#${postId}`,
                GSI1PK: `${tenantId}#${campaignId}`,
                GSI1SK: `POST#${post.platform}#${post.scheduledDate}`,
                GSI2PK: `${tenantId}#${post.personaId}`,
                GSI2SK: `POST#${campaignId}#${post.scheduledDate}`,
                ...postItem
              })
            }
          });

          createdPosts.push({
            postId,
            personaId: post.personaId,
            platform: post.platform,
            scheduledAt: post.scheduledDate,
            intent: post.intent,
            topic: post.topic
          });
        }

        if (writeRequests.length > 0) {
          await ddb.send(new BatchWriteItemCommand({
            RequestItems: {
              [process.env.TABLE_NAME]: writeRequests
            }
          }));
        }
      }

      return {
        success: true,
        postsCreated: createdPosts.length,
        posts: createdPosts
      };
    } catch (err) {
      console.error('Failed to create social posts', {
        campaignId,
        tenantId,
        planVersion,
        totalPosts: posts.length,
        postsCreatedBeforeError: createdPosts.length,
        errorName: err.name,
        errorMessage: err.message,
        errorCode: err.$metadata?.httpStatusCode
      });
      return {
        success: false,
        error: err.message,
        postsCreated: createdPosts.length
      };
    }
  }

  static async updateStatus(campaignId, tenantId, status, planSummary = null, planVersion = null) {
    const now = new Date().toISOString();
    let updateExpression = 'SET #status = :status, updatedAt = :updatedAt, version = version + :inc';
    const expressionAttributeNames = { '#status': 'status' };
    const expressionAttributeValues = {
      ':status': status,
      ':updatedAt': now,
      ':inc': 1
    };

    if (planSummary) {
      updateExpression += ', planSummary = :planSummary';
      expressionAttributeValues[':planSummary'] = planSummary;
    }

    if (planVersion) {
      updateExpression += ', planVersion = :planVersion';
      expressionAttributeValues[':planVersion'] = planVersion;
    }

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

    if (status === 'generating') {
      await this.publishPlanningCompletedEvent(campaignId, tenantId, planSummary, planVersion);
    }

    return {
      success: true,
      campaignId,
      status,
      planSummary,
      planVersion
    };
  }

  static async publishPlanningCompletedEvent(campaignId, tenantId, planSummary, planVersion) {
    const now = new Date().toISOString();

    await eventBridge.send(new PutEventsCommand({
      Entries: [{
        Source: 'campaign-planner',
        DetailType: 'Campaign Planning Completed',
        Detail: JSON.stringify({
          campaignId,
          tenantId,
          success: true,
          workflowType: 'campaign-planning',
          planSummary,
          planVersion,
          timestamp: now
        }),
        EventBusName: process.env.EVENT_BUS_NAME || 'default'
      }]
    }));
  }

  static async markAsFailed(campaignId, tenantId, error) {
    const now = new Date().toISOString();

    await ddb.send(new UpdateItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${campaignId}`,
        sk: 'campaign'
      }),
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt, lastError = :error',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: marshall({
        ':status': 'failed',
        ':updatedAt': now,
        ':error': {
          code: 'CAMPAIGN_PLANNING_FAILED',
          message: error.message || 'Campaign planning workflow failed',
          at: now,
          retryable: false
        }
      })
    }));

    await eventBridge.send(new PutEventsCommand({
      Entries: [{
        Source: 'campaign-planner',
        DetailType: 'Campaign Planning Failed',
        Detail: JSON.stringify({
          campaignId,
          tenantId,
          success: false,
          workflowType: 'campaign-planning',
          error: {
            code: 'CAMPAIGN_PLANNING_FAILED',
            message: error.message || 'Campaign planning workflow failed',
            retryable: false
          },
          timestamp: now
        }),
        EventBusName: process.env.EVENT_BUS_NAME || 'default'
      }]
    }));
  }
}
