import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { z } from 'zod';
import { ulid } from 'ulid';
import { logger } from '../utils/logger.mjs';

const ddb = new DynamoDBClient();

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/mov', 'video/avi'];
const SUPPORTED_CONTENT_TYPES = [...SUPPORTED_IMAGE_TYPES, ...SUPPORTED_VIDEO_TYPES];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

export const AssetSchema = z.object({
  assetId: z.string(),
  tenantId: z.string(),
  type: z.literal('internal'),
  contentType: z.enum(SUPPORTED_CONTENT_TYPES),
  description: z.string().min(10).max(500),
  fileSize: z.number().int().min(1),
  objectKey: z.string(),
  fileExtension: z.string(),
  uploadStatus: z.enum(['pending', 'completed', 'failed']),
  uploadUrl: z.string().nullable(),
  ttl: z.number().nullable(),
  approvalStatus: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  approvalHistory: z.array(z.object({
    status: z.enum(['pending', 'approved', 'rejected']),
    reviewedBy: z.string(),
    reviewedAt: z.string(),
    feedback: z.string().nullable()
  })).default([]),
  brandAssociations: z.array(z.object({
    brandId: z.string(),
    brandName: z.string(),
    associatedAt: z.string(),
    isDefault: z.boolean(),
    category: z.string().nullable()
  })).nullable().default(null),
  usageStats: z.object({
    totalCampaigns: z.number().int().min(0).default(0),
    totalPosts: z.number().int().min(0).default(0),
    lastUsedAt: z.string().nullable(),
    brandUsage: z.record(z.object({
      campaignCount: z.number().int().min(0).default(0),
      postCount: z.number().int().min(0).default(0)
    })).nullable().default(null)
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().min(1).default(1)
});

export const ExternalAssetSchema = z.object({
  type: z.literal('external'),
  url: z.string().url().refine(url => url.startsWith('https://'), {
    message: 'External asset URLs must use HTTPS protocol'
  }),
  description: z.string().min(10).max(500),
  contentType: z.enum(SUPPORTED_CONTENT_TYPES),
  addedAt: z.string().optional()
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

export const validateContentType = (contentType) => {
  if (!SUPPORTED_CONTENT_TYPES.includes(contentType)) {
    throw new Error(`Unsupported content type. Must be one of: ${SUPPORTED_CONTENT_TYPES.join(', ')}`);
  }
  return true;
};

export const validateFileSize = (contentType, fileSize) => {
  if (SUPPORTED_IMAGE_TYPES.includes(contentType) && fileSize > MAX_IMAGE_SIZE) {
    throw new Error(`Image file size exceeds 10MB limit. Provided: ${Math.round(fileSize / 1024 / 1024)}MB`);
  }
  if (SUPPORTED_VIDEO_TYPES.includes(contentType) && fileSize > MAX_VIDEO_SIZE) {
    throw new Error(`Video file size exceeds 100MB limit. Provided: ${Math.round(fileSize / 1024 / 1024)}MB`);
  }
  return true;
};

export const validateAssetDescription = (description) => {
  if (!description || typeof description !== 'string') {
    throw new Error('Asset description is required');
  }
  if (description.length < 10) {
    throw new Error('Asset description must be at least 10 characters');
  }
  if (description.length > 500) {
    throw new Error('Asset description must not exceed 500 characters');
  }
  return true;
};

export const generateAssetId = () => {
  return `asset_${ulid()}`;
};

export const generateObjectKey = (tenantId, assetId, fileExtension) => {
  return `${tenantId}/assets/${assetId}.${fileExtension}`;
};

export const getFileExtension = (contentType) => {
  const extensionMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/mov': 'mov',
    'video/avi': 'avi'
  };
  return extensionMap[contentType] || 'bin';
};

export class Asset {

  static async findById(tenantId, assetId) {
    try {
      const response = await ddb.send(new GetItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({
          pk: `${tenantId}#${assetId}`,
          sk: 'asset'
        })
      }));

      if (!response.Item) {
        return null;
      }

      const rawAsset = unmarshall(response.Item);
      return this.fromDynamoDB(rawAsset);
    } catch (error) {
      logger.error('Asset retrieval failed', {
        operation: 'findById',
        tenantId,
        assetId,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new Error('Failed to retrieve asset');
    }
  }

  static async save(tenantId, asset) {
    try {
      const now = new Date().toISOString();
      const assetId = asset.assetId || generateAssetId();
      const fileExtension = getFileExtension(asset.contentType);
      const objectKey = generateObjectKey(tenantId, assetId, fileExtension);

      const assetWithDefaults = {
        ...asset,
        assetId,
        tenantId,
        type: 'internal',
        objectKey,
        fileExtension,
        uploadStatus: 'pending',
        uploadUrl: null,
        ttl: Math.floor(Date.now() / 1000) + (60 * 60),
        approvalStatus: 'pending',
        approvalHistory: [],
        brandAssociations: null,
        usageStats: {
          totalCampaigns: 0,
          totalPosts: 0,
          lastUsedAt: null,
          brandUsage: null
        },
        createdAt: now,
        updatedAt: now,
        version: 1
      };

      const validatedAsset = AssetSchema.parse(assetWithDefaults);
      const dynamoItem = this.toDynamoDB(tenantId, validatedAsset);

      await ddb.send(new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall(dynamoItem),
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
      }));

      return this.fromDynamoDB(dynamoItem);
    } catch (error) {
      logger.error('Asset save failed', {
        operation: 'save',
        tenantId,
        assetId: asset.assetId,
        errorName: error.name,
        errorMessage: error.message
      });
      if (error.name === 'ValidationError') {
        throw error;
      }
      throw new Error('Failed to save asset');
    }
  }

  static async update(tenantId, assetId, updateData) {
    try {
      const existingAsset = await this.findById(tenantId, assetId);
      if (!existingAsset) {
        return null;
      }

      const validatedUpdateData = z.object({
        description: z.string().min(10).max(500)
      }).parse(updateData);
      const now = new Date().toISOString();

      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      updateExpression.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = now;

      Object.keys(validatedUpdateData).forEach((key, index) => {
        const attrName = `#attr${index}`;
        const attrValue = `:val${index}`;
        updateExpression.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = key;
        expressionAttributeValues[attrValue] = validatedUpdateData[key];
      });

      if (existingAsset.approvalStatus === 'approved') {
        updateExpression.push('#approvalStatus = :pending');
        expressionAttributeNames['#approvalStatus'] = 'approvalStatus';
        expressionAttributeValues[':pending'] = 'pending';

        const resetEntry = {
          status: 'pending',
          reviewedBy: 'system',
          reviewedAt: now,
          feedback: 'Reset to pending due to asset modification'
        };
        updateExpression.push('#approvalHistory = list_append(#approvalHistory, :resetEntry)');
        expressionAttributeNames['#approvalHistory'] = 'approvalHistory';
        expressionAttributeValues[':resetEntry'] = [resetEntry];
      }

      const response = await ddb.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({
          pk: `${tenantId}#${assetId}`,
          sk: 'asset'
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
      logger.error('Asset update failed', {
        operation: 'update',
        tenantId,
        assetId,
        errorName: error.name,
        errorMessage: error.message
      });
      if (error.name === 'ValidationError') {
        throw error;
      }
      throw new Error('Failed to update asset');
    }
  }

  static async list(tenantId, options = {}) {
    try {
      const { nextToken, limit = 20 } = options;

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
        KeyConditionExpression: 'GSI1PK = :tenantId AND begins_with(GSI1SK, :assetPrefix)',
        ExpressionAttributeValues: marshall({
          ':tenantId': tenantId,
          ':assetPrefix': 'ASSET#'
        }),
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey ? marshall(exclusiveStartKey) : undefined
      }));

      const assets = response.Items?.map(item => {
        const rawAsset = unmarshall(item);
        return this.fromDynamoDB(rawAsset);
      }) || [];

      const assetListResponse = {
        items: assets,
        pagination: {
          limit,
          hasNextPage: !!response.LastEvaluatedKey,
          nextToken: response.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(unmarshall(response.LastEvaluatedKey))).toString('base64')
            : null
        }
      };

      return assetListResponse;
    } catch (error) {
      logger.error('Asset list failed', {
        operation: 'list',
        tenantId,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new Error('Failed to list assets');
    }
  }

  static fromDynamoDB(rawAsset) {
    const cleanAsset = { ...rawAsset };

    delete cleanAsset.pk;
    delete cleanAsset.sk;
    delete cleanAsset.GSI1PK;
    delete cleanAsset.GSI1SK;
    delete cleanAsset.tenantId;

    cleanAsset.id = cleanAsset.assetId;
    delete cleanAsset.assetId;

    return cleanAsset;
  }

  static toDynamoDB(tenantId, asset) {
    const now = new Date().toISOString();

    return {
      pk: `${tenantId}#${asset.assetId}`,
      sk: 'asset',
      GSI1PK: tenantId,
      GSI1SK: `ASSET#${asset.contentType}#${now}`,
      ...asset,
      tenantId
    };
  }

  static async markUploadCompleted(tenantId, assetId, actualFileSize) {
    try {
      const now = new Date().toISOString();

      await ddb.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({
          pk: `${tenantId}#${assetId}`,
          sk: 'asset'
        }),
        UpdateExpression: 'SET #uploadStatus = :completed, #fileSize = :fileSize, #updatedAt = :now REMOVE #ttl, #uploadUrl',
        ExpressionAttributeNames: {
          '#uploadStatus': 'uploadStatus',
          '#fileSize': 'fileSize',
          '#updatedAt': 'updatedAt',
          '#ttl': 'ttl',
          '#uploadUrl': 'uploadUrl'
        },
        ExpressionAttributeValues: marshall({
          ':completed': 'completed',
          ':fileSize': actualFileSize,
          ':now': now
        }),
        ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)'
      }));

      return { success: true };
    } catch (error) {
      logger.error('Asset upload completion failed', {
        operation: 'markUploadCompleted',
        tenantId,
        assetId,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new Error('Failed to mark asset upload as completed');
    }
  }

  static async updateUsageStats(tenantId, assetId, campaignId = null, postId = null) {
    try {
      const now = new Date().toISOString();
      const updateExpression = ['#lastUsedAt = :now'];
      const expressionAttributeNames = { '#lastUsedAt': 'usageStats.lastUsedAt' };
      const expressionAttributeValues = { ':now': now };

      if (campaignId) {
        updateExpression.push('#totalCampaigns = #totalCampaigns + :one');
        expressionAttributeNames['#totalCampaigns'] = 'usageStats.totalCampaigns';
        expressionAttributeValues[':one'] = 1;
      }

      if (postId) {
        updateExpression.push('#totalPosts = #totalPosts + :one');
        expressionAttributeNames['#totalPosts'] = 'usageStats.totalPosts';
        if (!expressionAttributeValues[':one']) {
          expressionAttributeValues[':one'] = 1;
        }
      }

      await ddb.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({
          pk: `${tenantId}#${assetId}`,
          sk: 'asset'
        }),
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues)
      }));

      return { success: true };
    } catch (error) {
      logger.error('Asset usage stats update failed', {
        operation: 'updateUsageStats',
        tenantId,
        assetId,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new Error('Failed to update asset usage statistics');
    }
  }

  static async updateApprovalStatus(tenantId, assetId, status, reviewedBy, feedback = null) {
    try {
      const now = new Date().toISOString();

      const approvalEntry = {
        status,
        reviewedBy,
        reviewedAt: now,
        feedback
      };

      await ddb.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({
          pk: `${tenantId}#${assetId}`,
          sk: 'asset'
        }),
        UpdateExpression: 'SET #approvalStatus = :status, #approvalHistory = list_append(if_not_exists(#approvalHistory, :emptyList), :newEntry), #updatedAt = :now',
        ExpressionAttributeNames: {
          '#approvalStatus': 'approvalStatus',
          '#approvalHistory': 'approvalHistory',
          '#updatedAt': 'updatedAt'
        },
        ExpressionAttributeValues: marshall({
          ':status': status,
          ':newEntry': [approvalEntry],
          ':emptyList': [],
          ':now': now
        }),
        ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)'
      }));

      return { success: true, approvalEntry };
    } catch (error) {
      logger.error('Asset approval status update failed', {
        operation: 'updateApprovalStatus',
        tenantId,
        assetId,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new Error('Failed to update asset approval status');
    }
  }

  static async addBrandAssociation(tenantId, assetId, brandId, brandName, isDefault = false, category = null) {
    try {
      const now = new Date().toISOString();

      const association = {
        brandId,
        brandName,
        associatedAt: now,
        isDefault,
        category
      };

      await ddb.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({
          pk: `${tenantId}#${assetId}`,
          sk: 'asset'
        }),
        UpdateExpression: 'SET #brandAssociations = list_append(if_not_exists(#brandAssociations, :emptyList), :newAssociation), #updatedAt = :now',
        ExpressionAttributeNames: {
          '#brandAssociations': 'brandAssociations',
          '#updatedAt': 'updatedAt'
        },
        ExpressionAttributeValues: marshall({
          ':newAssociation': [association],
          ':emptyList': [],
          ':now': now
        }),
        ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)'
      }));

      return { success: true, association };
    } catch (error) {
      logger.error('Brand association addition failed', {
        operation: 'addBrandAssociation',
        tenantId,
        assetId,
        brandId,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new Error('Failed to add brand association');
    }
  }

  static async updateBrandUsageStats(tenantId, assetId, brandId, campaignId = null, postId = null) {
    try {
      const asset = await this.findById(tenantId, assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      const now = new Date().toISOString();
      const currentBrandUsage = asset.usageStats?.brandUsage || {};
      const brandStats = currentBrandUsage[brandId] || { campaignCount: 0, postCount: 0 };

      if (campaignId) {
        brandStats.campaignCount += 1;
      }
      if (postId) {
        brandStats.postCount += 1;
      }

      currentBrandUsage[brandId] = brandStats;

      const updateExpression = ['#brandUsage = :brandUsage', '#lastUsedAt = :now'];
      const expressionAttributeNames = {
        '#brandUsage': 'usageStats.brandUsage',
        '#lastUsedAt': 'usageStats.lastUsedAt'
      };
      const expressionAttributeValues = {
        ':brandUsage': currentBrandUsage,
        ':now': now
      };

      if (campaignId) {
        updateExpression.push('#totalCampaigns = #totalCampaigns + :one');
        expressionAttributeNames['#totalCampaigns'] = 'usageStats.totalCampaigns';
        expressionAttributeValues[':one'] = 1;
      }

      if (postId) {
        updateExpression.push('#totalPosts = #totalPosts + :one');
        expressionAttributeNames['#totalPosts'] = 'usageStats.totalPosts';
        if (!expressionAttributeValues[':one']) {
          expressionAttributeValues[':one'] = 1;
        }
      }

      await ddb.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({
          pk: `${tenantId}#${assetId}`,
          sk: 'asset'
        }),
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues)
      }));

      return { success: true };
    } catch (error) {
      logger.error('Brand usage stats update failed', {
        operation: 'updateBrandUsageStats',
        tenantId,
        assetId,
        brandId,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new Error('Failed to update brand usage statistics');
    }
  }
}

