import { S3Client } from '@aws-sdk/client-s3';
import { Asset } from '../../models/asset.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import {
  validateAssetAccess,
  generateSecureSignedUrl,
  logAssetOperation,
  AssetSecurityError
} from '../../utils/asset-security.mjs';
import { assetLogger } from '../../utils/logger.mjs';

const s3Client = new S3Client();

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
      await validateAssetAccess(tenantId, assetId, 'READ');
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
      logAssetOperation(tenantId, assetId, 'READ', 'NOT_FOUND');
      return formatResponse(404, { message: 'Asset not found' });
    }

    let accessUrl = null;
    if (asset.uploadStatus === 'completed') {
      accessUrl = await generateSecureSignedUrl(
        s3Client,
        process.env.ASSETS_BUCKET,
        asset.objectKey,
        'getObject',
        900 // 15 minutes
      );
    }

    logAssetOperation(tenantId, assetId, 'READ', 'SUCCESS', {
      uploadStatus: asset.uploadStatus,
      hasAccessUrl: !!accessUrl
    });

    return formatResponse(200, {
      asset: {
        ...asset,
        accessUrl
      }
    });

  } catch (error) {
    assetLogger.error('Asset retrieval operation failed', {
      operation: 'getAsset',
      tenantId: event.requestContext?.authorizer?.tenantId,
      assetId: event.pathParameters?.assetId,
      errorName: error.name,
      errorMessage: error.message
    });

    logAssetOperation(
      event.requestContext?.authorizer?.tenantId || 'unknown',
      event.pathParameters?.assetId || 'unknown',
      'READ',
      'FAILED',
      { errorName: error.name, errorMessage: error.message }
    );

    if (error instanceof AssetSecurityError) {
      return formatResponse(403, {
        message: error.message,
        violationType: error.violationType
      });
    }

    return formatResponse(500, { message: 'Failed to retrieve asset' });
  }
};
