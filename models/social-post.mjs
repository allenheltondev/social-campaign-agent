import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, UpdateItemCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { z } from 'zod';
import { ulid } from 'ulid';

const ddb = new DynamoDBClient();

const PlatformSchema = z.enum(['twitter', 'linkedin', 'instagram', 'facebook']);
const IntentSchema = z.enum(['announce', 'educate', 'opinion', 'invite_discussion', 'social_proof', 'reminder']);
const PostStatusSchema = z.enum(['planned', 'generating', 'completed', 'failed', 'skipped', 'needs_review']);

const ErrorTrackingSchema = z.object({
  code: z.string(),
  message: z.string(),
  at: z.iso.datetime(),
  retryable: z.boolean()
}).nullable();

const SocialPostInternalSchema = z.object({
  postId: z.string(),
  campaignId: z.string(),
  tenantId: z.string(),
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
  lastError: ErrorTrackingSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
});

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
      console.error('SocialPost findById failed', {
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
      console.error('SocialPost findByCampaign failed', {
        campaignId,
        platform,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new Error('Failed to retrieve social posts');
    }
  }

  static async findByPersona(tenantId, personaId, campaignId = null, limit = 50, nextToken = null) {
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
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :sk)',
        ExpressionAttributeValues: marshall({
          ':pk': `${tenantId}#${personaId}`,
          ':sk': campaignId ? `POST#${campaignId}#` : 'POST#'
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
      console.error('SocialPost findByPersona failed', {
        personaId,
        campaignId,
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
    delete cleanPost.GSI2PK;
    delete cleanPost.GSI2SK;
    delete cleanPost.tenantId;

    cleanPost.id = cleanPost.postId;
    delete cleanPost.postId;

    // Convert null values to undefined for optional fields
    if (cleanPost.references === null) {
      delete cleanPost.references;
    }
    if (cleanPost.content === null) {
      delete cleanPost.content;
    }
    if (cleanPost.assetRequirements === null) {
      delete cleanPost.assetRequirements;
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
      GSI2PK: `${tenantId}#${internalPost.personaId}`,
      GSI2SK: `POST#${campaignId}#${internalPost.scheduledAt}`,
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
      console.error('SocialPost save failed', {
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
      console.error('SocialPost update failed', {
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
      console.error('SocialPost updateStatus failed', {
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
      console.error('SocialPost updateContent failed', {
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
            scheduledAt: post.scheduledDate || post.scheduledAt,
            topic: post.topic,
            intent: post.intent,
            assetRequirements: post.assetRequirements,
            references: post.references,
            status: 'planned',
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
      console.error('Failed to create social posts', {
        campaignId,
        tenantId,
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
