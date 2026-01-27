import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, UpdateItemCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { z } from 'zod';
import { ulid } from 'ulid';
import { campaignLogger } from '../utils/logger.mjs';

const ddb = new DynamoDBClient();

const PlatformSchema = z.enum(['twitter', 'linkedin', 'instagram', 'facebook']);
const IntentSchema = z.enum(['announce', 'educate', 'opinion', 'invite_discussion', 'social_proof', 'reminder']);
const PostStatusSchema = z.enum(['planned', 'generating', 'completed', 'failed', 'skipped', 'needs_review', 'approved', 'rejected', 'manually_edited']);

const PostApprovalStatusSchema = z.enum(['pending', 'needs_review', 'approved', 'rejected', 'manually_edited']);

const ApprovalMetadataSchema = z.object({
  status: PostApprovalStatusSchema,
  reviewedAt: z.string().datetime().nullable(),
  comments: z.string().nullable()
}).nullable();

const VersionMetadataSchema = z.object({
  current: z.number().int().positive(),
  total: z.number().int().positive(),
  regenerationCount: z.number().int().min(0),
  maxRegenerations: z.number().int().positive().default(3)
}).nullable();

const ErrorTrackingSchema = z.object({
  code: z.string(),
  message: z.string(),
  at: z.iso.datetime(),
  retryable: z.boolean()
}).nullable();

const AssetSelectionReasoningSchema = z.object({
  primaryFactor: z.enum(['usage-intent', 'description-match', 'platform-fit', 'default-required', 'persona-alignment']),
  confidence: z.enum(['high', 'medium', 'low']),
  explanation: z.string().min(10).max(1000),
  alternativesConsidered: z.array(z.string()).optional()
}).nullable();

const NoAssetReasonSchema = z.object({
  reason: z.enum(['no-suitable-match', 'insufficient-assets', 'content-better-without', 'all-assets-used']),
  explanation: z.string().min(10).max(1000)
}).nullable();

const AssignedAssetSchema = z.object({
  type: z.enum(['internal', 'external']),
  assetId: z.string().nullable(),
  url: z.string().nullable(),
  description: z.string(),
  contentType: z.string(),
  source: z.enum(['brand', 'campaign']),
  isDefault: z.boolean(),
  selectionReason: AssetSelectionReasoningSchema,
  assignedAt: z.string().datetime()
}).nullable();

export const SocialPostSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  personaId: z.string(),
  platform: PlatformSchema,
  scheduledAt: z.iso.datetime(),
  topic: z.string().min(1).max(500),
  intent: IntentSchema,
  assetRequirements: z.object({
    imageRequired: z.boolean(),
    imageDescription: z.string().optional(),
    videoRequired: z.boolean(),
    videoDescription: z.string().optional()
  }).optional(),
  assignedAsset: AssignedAssetSchema.optional(),
  noAssetReason: NoAssetReasonSchema.optional(),
  content: z.object({
    text: z.string(),
    hashtags: z.array(z.string()).optional(),
    mentions: z.array(z.string()).optional(),
    generatedAt: z.iso.datetime()
  }).optional(),
  references: z.array(z.object({
    type: z.enum(['url', 'assetId']),
    value: z.string()
  })).optional(),
  status: PostStatusSchema,
  approval: ApprovalMetadataSchema.optional(),
  versions: VersionMetadataSchema.optional(),
  lastError: ErrorTrackingSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
});

export const generatePostId = () => {
  return ulid();
};

export class SocialPost {
  static validateEntity(post) {
    try {
      return SocialPostSchema.parse(post);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = (error.errors || []).map(e => ({
          field: (e.path || []).join('.'),
          message: e.message || 'Validation failed',
          code: e.code || 'invalid'
        }));
        const errorMessage = `SocialPost validation error: ${validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`;
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
      const updateSchema = SocialPostSchema.omit({
        id: true,
        campaignId: true,
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
        const errorMessage = `SocialPost update validation error: ${validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`;
        const validationError = new Error(errorMessage);
        validationError.name = 'ValidationError';
        validationError.details = { errors: validationErrors };
        throw validationError;
      }
      throw error;
    }
  }
  static async findById(tenantId, campaignId, postId) {
    try {
      const response = await ddb.send(new GetItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({
          pk: `${tenantId}#${campaignId}`,
          sk: `POST#${postId}`
        })
      }));

      if (!response.Item) {
        return null;
      }

      const rawPost = unmarshall(response.Item);
      return this._transformFromDynamoDB(rawPost);
    } catch (error) {
      campaignLogger.error('SocialPost findById failed', {
        operation: 'findById',
        tenantId,
        postId,
        campaignId,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new Error('Failed to retrieve social post');
    }
  }

  static async findByCampaign(tenantId, campaignId, limit = 50, nextToken = null, platform = null) {
    try {
      let exclusiveStartKey;
      if (nextToken) {
        try {
          exclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
        } catch (e) {
          throw new Error('Invalid nextToken');
        }
      }

      const queryParams = {
        TableName: process.env.TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
        ExpressionAttributeValues: marshall({
          ':pk': `${tenantId}#${campaignId}`,
          ':sk': platform ? `POST#${platform}#` : 'POST#'
        }),
        Limit: limit,
        ScanIndexForward: true,
        ExclusiveStartKey: exclusiveStartKey ? marshall(exclusiveStartKey) : undefined
      };

      const response = await ddb.send(new QueryCommand(queryParams));

      const posts = response.Items?.map(item => {
        const rawPost = unmarshall(item);
        return this._transformFromDynamoDB(rawPost);
      }) || [];

      const responseNextToken = response.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(unmarshall(response.LastEvaluatedKey))).toString('base64')
        : null;

      return {
        items: posts,
        pagination: {
          limit,
          hasNextPage: !!response.LastEvaluatedKey,
          nextToken: responseNextToken
        }
      };
    } catch (error) {
      campaignLogger.error('SocialPost findByCampaign failed', {
        operation: 'findByCampaign',
        tenantId,
        campaignId,
        platform,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new Error('Failed to retrieve social posts');
    }
  }

  static _transformFromDynamoDB(rawPost) {
    const cleanPost = { ...rawPost };

    delete cleanPost.pk;
    delete cleanPost.sk;
    delete cleanPost.GSI1PK;
    delete cleanPost.GSI1SK;
    delete cleanPost.tenantId;

    cleanPost.id = cleanPost.postId;
    delete cleanPost.postId;

    if (cleanPost.references === null) {
      delete cleanPost.references;
    }
    if (cleanPost.content === null) {
      delete cleanPost.content;
    }
    if (cleanPost.assetRequirements === null) {
      delete cleanPost.assetRequirements;
    }
    if (cleanPost.approval === null || cleanPost.approval === undefined) {
      delete cleanPost.approval;
    }
    if (cleanPost.versions === null || cleanPost.versions === undefined) {
      delete cleanPost.versions;
    }
    if (cleanPost.assignedAsset === null || cleanPost.assignedAsset === undefined) {
      delete cleanPost.assignedAsset;
    }
    if (cleanPost.noAssetReason === null || cleanPost.noAssetReason === undefined) {
      delete cleanPost.noAssetReason;
    }

    return SocialPostSchema.parse(cleanPost);
  }

  static _transformToDynamoDB(tenantId, campaignId, post) {
    const postId = post.id || post.postId || generatePostId();
    const internalPost = {
      ...post,
      postId,
      tenantId,
      campaignId
    };

    if (internalPost.id) {
      delete internalPost.id;
    }

    return {
      pk: `${tenantId}#${campaignId}`,
      sk: `POST#${postId}`,
      GSI1PK: `${tenantId}#${campaignId}`,
      GSI1SK: `POST#${internalPost.platform}#${internalPost.scheduledAt}`,
      ...internalPost
    };
  }

  static async save(tenantId, campaignId, post) {
    try {
      const now = new Date().toISOString();
      const postWithDefaults = {
        ...post,
        campaignId,
        createdAt: post.createdAt || now,
        updatedAt: now
      };

      const validatedPost = this.validateEntity(postWithDefaults);
      const dynamoItem = this._transformToDynamoDB(tenantId, campaignId, validatedPost);

      await ddb.send(new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall(dynamoItem)
      }));

      return this._transformFromDynamoDB(dynamoItem);
    } catch (error) {
      campaignLogger.error('SocialPost save failed', {
        operation: 'save',
        tenantId,
        postId: post.id || post.postId,
        campaignId,
        errorName: error.name,
        errorMessage: error.message
      });
      if (error.name === 'ValidationError') {
        throw error;
      }
      throw new Error('Failed to save social post');
    }
  }

  static async update(tenantId, campaignId, postId, updateData) {
    try {
      const validatedUpdateData = this.validateUpdateData(updateData);
      const now = new Date().toISOString();
      const updateExpressions = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      updateExpressions.push('updatedAt = :updatedAt');
      expressionAttributeValues[':updatedAt'] = now;

      Object.keys(validatedUpdateData).forEach((key, index) => {
        const attrName = `#attr${index}`;
        const attrValue = `:val${index}`;
        updateExpressions.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = key;
        expressionAttributeValues[attrValue] = validatedUpdateData[key];
      });

      await ddb.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({
          pk: `${tenantId}#${campaignId}`,
          sk: `POST#${postId}`
        }),
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues)
      }));

      return await this.findById(tenantId, campaignId, postId);
    } catch (error) {
      campaignLogger.error('SocialPost update failed', {
        operation: 'update',
        tenantId,
        postId,
        campaignId,
        errorName: error.name,
        errorMessage: error.message
      });
      if (error.name === 'ValidationError') {
        throw error;
      }
      throw new Error('Failed to update social post');
    }
  }

  static async updateStatus(tenantId, campaignId, postId, status, error = null) {
    try {
      const updateData = { status };
      if (error) {
        updateData.lastError = error;
      }

      const updatedPost = await this.update(tenantId, campaignId, postId, updateData);
      return {
        success: true,
        postId,
        status,
        post: updatedPost
      };
    } catch (error) {
      campaignLogger.error('SocialPost updateStatus failed', {
        operation: 'updateStatus',
        tenantId,
        postId,
        campaignId,
        status,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new Error('Failed to update social post status');
    }
  }

  static async updateContent(tenantId, campaignId, postId, content) {
    try {
      const now = new Date().toISOString();
      const contentWithTimestamp = {
        ...content,
        generatedAt: now
      };

      const updatedPost = await this.update(tenantId, campaignId, postId, { content: contentWithTimestamp });
      return {
        success: true,
        postId,
        content: contentWithTimestamp,
        post: updatedPost
      };
    } catch (error) {
      campaignLogger.error('SocialPost updateContent failed', {
        operation: 'updateContent',
        tenantId,
        postId,
        campaignId,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new Error('Failed to update social post content');
    }
  }

  static async createSocialPosts(campaignId, tenantId, posts) {
    const createdPosts = [];
    const now = new Date().toISOString();
    try {
      const batchSize = 25;
      for (let i = 0; i < posts.length; i += batchSize) {
        const batch = posts.slice(i, i + batchSize);
        const writeRequests = [];

        for (const post of batch) {
          const postItem = {
            id: generatePostId(),
            campaignId,
            personaId: post.personaId,
            platform: post.platform,
            scheduledAt: post.scheduledAt,
            topic: post.topic,
            intent: post.intent,
            assetRequirements: post.assetRequirements,
            references: post.references,
            status: 'planned',
            approval: null,
            versions: null,
            lastError: null,
            createdAt: now,
            updatedAt: now
          };

          const dynamoItem = this._transformToDynamoDB(tenantId, campaignId, postItem);

          writeRequests.push({
            PutRequest: {
              Item: marshall(dynamoItem)
            }
          });

          createdPosts.push(this._transformFromDynamoDB(dynamoItem));
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
      campaignLogger.error('Failed to create social posts', {
        operation: 'createPostsForCampaign',
        tenantId,
        campaignId,
        totalPosts: posts.length,
        postsCreatedBeforeError: createdPosts.length,
        errorName: err.name,
        errorMessage: err.message,
        errorCode: err.$metadata?.httpStatusCode
      });
      return {
        success: false,
        message: err.message,
        postsCreated: createdPosts.length
      };
    }
  }
}
