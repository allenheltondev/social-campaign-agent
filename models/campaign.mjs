import { DynamoDBClient, GetItemCommand, UpdateItemCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
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
  personaWeights: z.record(z.number().min(0).max(1)).nullable(),
  platformWeights: z.record(z.number().min(0).max(1)).nullable()
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
  }).nullable(),
  lastError: ErrorTrackingSchema,
  metadata: z.object({
    source: z.enum(['wizard', 'api', 'import']).default('api'),
    externalRef: z.string().nullable()
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  version: z.number().int().min(1),
  planVersion: z.string().nullable()
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

    const mergedConfig = this.mergeConfigurations(brandConfig, campaign, personaConfigs);

    return {
      campaign,
      brandConfig,
      personaConfigs,
      mergedConfig
    };
  }

  static mergeConfigurations(brandConfig, campaignConfig, personaConfigs) {
    const cadenceDefaults = Brand.extractCadenceDefaults(brandConfig);
    const assetDefaults = Brand.extractAssetRequirements(brandConfig);
    const brandRestrictions = Brand.extractContentRestrictions(brandConfig);

    const mergedConfig = {
      brandGuidelines: brandConfig || {},
      platformGuidelines: brandConfig?.platformGuidelines || {
        enabled: ['twitter', 'linkedin', 'instagram', 'facebook'],
        defaults: {}
      },
      audienceProfile: brandConfig?.audienceProfile || {
        primary: 'professionals',
        segments: null,
        excluded: null
      },
      cadence: {
        minPostsPerWeek: campaignConfig.cadenceOverrides?.minPostsPerWeek || cadenceDefaults.minPostsPerWeek,
        maxPostsPerWeek: campaignConfig.cadenceOverrides?.maxPostsPerWeek || cadenceDefaults.maxPostsPerWeek,
        maxPostsPerDay: campaignConfig.cadenceOverrides?.maxPostsPerDay || cadenceDefaults.maxPostsPerDay
      },
      messaging: {
        pillars: campaignConfig.messaging?.pillars || brandConfig?.pillars || [
          { name: 'Brand Awareness', weight: 0.4 },
          { name: 'Education', weight: 0.3 },
          { name: 'Engagement', weight: 0.3 }
        ],
        requiredInclusions: campaignConfig.messaging?.requiredInclusions || [],
        campaignAvoidTopics: campaignConfig.messaging?.campaignAvoidTopics || [],
        brandAvoidTopics: brandRestrictions.avoidTopics
      },
      assetRequirements: {
        forceVisuals: campaignConfig.assetOverrides?.forceVisuals || {},
        defaultVisualRequirements: {
          twitter: campaignConfig.assetOverrides?.forceVisuals?.twitter ?? assetDefaults.twitter,
          linkedin: campaignConfig.assetOverrides?.forceVisuals?.linkedin ?? assetDefaults.linkedin,
          instagram: campaignConfig.assetOverrides?.forceVisuals?.instagram ?? assetDefaults.instagram,
          facebook: campaignConfig.assetOverrides?.forceVisuals?.facebook ?? assetDefaults.facebook
        }
      },
      claimsPolicy: brandConfig?.claimsPolicy || {
        noGuarantees: true,
        noPerformanceNumbersUnlessProvided: true,
        requireSourceForStats: true,
        competitorMentionPolicy: 'avoid'
      },
      ctaLibrary: brandConfig?.ctaLibrary || [
        { type: 'learn_more', text: 'Learn more', defaultUrl: null },
        { type: 'get_started', text: 'Get started', defaultUrl: null }
      ],
      personas: personaConfigs.map(persona =>
        Persona.mergeEffectiveRestrictions(
          persona,
          { campaignAvoidTopics: campaignConfig.messaging?.campaignAvoidTopics },
          brandRestrictions
        )
      ),
      approvalPolicy: brandConfig?.approvalPolicy || { mode: 'auto_approve', threshold: 0.7 }
    };

    return mergedConfig;
  }

  static generatePostPlan(campaignId, tenantId, campaign, mergedConfig) {
    const startDate = new Date(campaign.schedule.startDate);
    const endDate = new Date(campaign.schedule.endDate);
    const durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    const totalWeeks = Math.ceil(durationDays / 7);
    const targetPostsPerWeek = Math.min(
      mergedConfig.cadence.maxPostsPerWeek,
      Math.max(mergedConfig.cadence.minPostsPerWeek, campaign.participants.platforms.length * 2)
    );

    const totalPosts = Math.max(1, Math.floor(totalWeeks * targetPostsPerWeek));
    const posts = [];
    const intents = ['announce', 'educate', 'opinion', 'invite_discussion', 'social_proof', 'reminder'];
    const messagingPillars = mergedConfig.messaging.pillars;

    for (let i = 0; i < totalPosts; i++) {
      const dayOffset = Math.floor((i / totalPosts) * durationDays);
      const scheduledDate = new Date(startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);

      if (this.isBlackoutDate(campaign.schedule.blackoutDates, scheduledDate)) {
        continue;
      }

      if (!this.isAllowedDay(campaign.schedule.allowedDaysOfWeek, scheduledDate)) {
        continue;
      }

      const personaIndex = i % campaign.participants.personaIds.length;
      const platformIndex = i % campaign.participants.platforms.length;
      const persona = mergedConfig.personas[personaIndex];
      const platform = campaign.participants.platforms[platformIndex];

      const pillarIndex = i % messagingPillars.length;
      const selectedPillar = messagingPillars[pillarIndex];
      const intent = intents[i % intents.length];

      const topic = `${selectedPillar.name}: ${campaign.brief.description} - ${intent} content for ${platform}`;

      const requiresImage = mergedConfig.assetRequirements.defaultVisualRequirements[platform] ||
                           mergedConfig.assetRequirements.forceVisuals[platform] || false;

      const post = {
        personaId: persona.personaId,
        platform: platform,
        scheduledDate: scheduledDate.toISOString(),
        topic: topic,
        intent: intent,
        assetRequirements: {
          imageRequired: requiresImage,
          imageDescription: requiresImage ? `Visual content for ${topic} on ${platform}` : null,
          videoRequired: false,
          videoDescription: null
        },
        references: campaign.brief.primaryCTA ? [{
          type: 'url',
          value: campaign.brief.primaryCTA.url || '#'
        }] : null,
        messagingPillar: selectedPillar.name,
        personaConstraints: persona.effectiveRestrictions
      };

      posts.push(post);
    }

    const planSummary = {
      totalPosts: posts.length,
      postsPerPlatform: campaign.participants.platforms.reduce((acc, platform) => {
        acc[platform] = posts.filter(p => p.platform === platform).length;
        return acc;
      }, {}),
      postsPerPersona: campaign.participants.personaIds.reduce((acc, personaId) => {
        acc[personaId] = posts.filter(p => p.personaId === personaId).length;
        return acc;
      }, {})
    };

    const planVersion = this.generatePlanVersion(campaign, mergedConfig);

    return {
      posts,
      planSummary,
      planVersion
    };
  }

  static generatePlanVersion(campaign, mergedConfig) {
    return crypto.createHash('sha256')
      .update(JSON.stringify({
        brief: campaign.brief,
        participants: campaign.participants,
        schedule: campaign.schedule,
        cadenceOverrides: mergedConfig.cadence,
        messaging: mergedConfig.messaging,
        assetOverrides: mergedConfig.assetRequirements
      }))
      .digest('hex')
      .substring(0, 16);
  }

  static isBlackoutDate(blackoutDates, scheduledDate) {
    return blackoutDates?.some(blackout =>
      new Date(blackout).toDateString() === scheduledDate.toDateString()
    );
  }

  static isAllowedDay(allowedDaysOfWeek, scheduledDate) {
    const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][scheduledDate.getDay()];
    return allowedDaysOfWeek.includes(dayOfWeek);
  }

  static async createSocialPosts(campaignId, tenantId, planVersion, posts) {
    const createdPosts = [];
    const now = new Date().toISOString();

    const batchSize = 25;
    for (let i = 0; i < posts.length; i += batchSize) {
      const batch = posts.slice(i, i + batchSize);
      const writeRequests = [];

      for (const post of batch) {
        const postId = generatePostId();
        const postItem = {
          postId,
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

    await this.publishPostCreatedEvents(createdPosts, campaignId, tenantId, planVersion);

    return {
      success: true,
      postsCreated: createdPosts.length,
      posts: createdPosts
    };
  }

  static async publishPostCreatedEvents(createdPosts, campaignId, tenantId, planVersion) {
    const eventEntries = createdPosts.map(post => ({
      Source: 'campaign-planner',
      DetailType: 'Social Post Created',
      Detail: JSON.stringify({
        postId: post.postId,
        campaignId,
        tenantId,
        personaId: post.personaId,
        platform: post.platform,
        scheduledAt: post.scheduledAt,
        intent: post.intent,
        planVersion
      }),
      EventBusName: process.env.EVENT_BUS_NAME || 'default'
    }));

    for (let i = 0; i < eventEntries.length; i += 10) {
      const eventBatch = eventEntries.slice(i, i + 10);
      await eventBridge.send(new PutEventsCommand({
        Entries: eventBatch
      }));
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
