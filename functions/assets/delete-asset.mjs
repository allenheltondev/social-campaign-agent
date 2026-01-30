import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { Asset } from '../../models/asset.mjs';
import {
  validateAssetAccess,
  logAssetOperation,
  AssetSecurityError
} from '../../utils/asset-security.mjs';
import { logger } from '../../utils/logger.mjs';

const s3Client = new S3Client();
const ddb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { assetId } = event.pathParameters;

    if (!tenantId) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Unauthorized: Missing tenant context' })
      };
    }

    if (!assetId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Asset ID is required' })
      };
    }

    // Enhanced security validation with tenant ownership verification
    try {
      await validateAssetAccess(tenantId, assetId, 'DELETE');
    } catch (error) {
      if (error instanceof AssetSecurityError) {
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            message: error.message,
            violationType: error.violationType
          })
        };
      }
      throw error;
    }

    const asset = await Asset.findById(tenantId, assetId);

    if (!asset) {
      logAssetOperation(tenantId, assetId, 'DELETE', 'NOT_FOUND');
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Asset not found' })
      };
    }

    if (asset.uploadStatus === 'completed' && asset.objectKey) {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: process.env.ASSETS_BUCKET,
        Key: asset.objectKey
      }));
    }

    // Soft delete the asset by updating its status
    await ddb.send(new UpdateItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${assetId}`,
        sk: 'asset'
      }),
      UpdateExpression: 'SET #status = :deleted, #updatedAt = :now',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#updatedAt': 'updatedAt'
      },
      ExpressionAttributeValues: marshall({
        ':deleted': 'deleted',
        ':now': new Date().toISOString()
      }),
      ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)'
    }));

    logAssetOperation(tenantId, assetId, 'DELETE', 'SUCCESS', {
      hadS3Object: asset.uploadStatus === 'completed',
      objectKey: asset.objectKey
    });

    return {
      statusCode: 204,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: ''
    };

  } catch (error) {
    logger.error('Asset deletion operation failed', {
      operation: 'deleteAsset',
      tenantId: event.requestContext?.authorizer?.tenantId,
      assetId: event.pathParameters?.assetId,
      errorName: error.name,
      errorMessage: error.message
    });

    logAssetOperation(
      event.requestContext?.authorizer?.tenantId || 'unknown',
      event.pathParameters?.assetId || 'unknown',
      'DELETE',
      'FAILED',
      { errorName: error.name, errorMessage: error.message }
    );

    if (error instanceof AssetSecurityError) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          message: error.message,
          violationType: error.violationType
        })
      };
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Failed to delete asset' })
    };
  }
};
