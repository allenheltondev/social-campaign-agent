import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { Asset } from '../../models/asset.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import {
  validateAssetAccess,
  logAssetOperation,
  AssetSecurityError
} from '../../utils/asset-security.mjs';
import { assetLogger } from '../../utils/logger.mjs';

const s3Client = new S3Client();
const ddb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { assetId } = event.pathParameters;

    if (!tenantId) {
      return formatResponse(401, { message: 'Unauthorized: Missing tenant context' });
    }

    if (!assetId) {
      return formatResponse(400, { message: 'Asset ID is required' });
    }

    // Enhanced security validation with tenant ownership verification
    try {
      await validateAssetAccess(tenantId, assetId, 'DELETE');
    } catch (error) {
      if (error instanceof AssetSecurityError) {
        return formatResponse(403, {
          message: error.message,
          violationType: error.violationType
        });
      }
      throw error;
    }

    const asset = await Asset.findById(tenantId, assetId);

    if (!asset) {
      logAssetOperation(tenantId, assetId, 'DELETE', 'NOT_FOUND');
      return formatResponse(404, { message: 'Asset not found' });
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

    return formatResponse(204, null);

  } catch (error) {
    assetLogger.error('Asset deletion operation failed', {
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
      return formatResponse(403, {
        message: error.message,
        violationType: error.violationType
      });
    }

    return formatResponse(500, { message: 'Failed to delete asset' });
  }
};
