import { S3Client } from '@aws-sdk/client-s3';
import { Asset, CreateAssetRequestSchema, validateRequestBody } from '../../models/asset.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import {
  validateContentPolicy,
  generateSecureSignedUrl,
  logAssetOperation,
  AssetSecurityError,
  SecurityViolationTypes
} from '../../utils/asset-security.mjs';
import { assetLogger } from '../../utils/logger.mjs';

const s3Client = new S3Client();

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;

    if (!tenantId) {
      return formatResponse(401, { message: 'Unauthorized: Missing tenant context' });
    }

    const requestData = validateRequestBody(CreateAssetRequestSchema, event.body);

    // Enhanced security validation
    try {
      validateContentPolicy(requestData.contentType, requestData.fileSize, requestData.description);
    } catch (error) {
      if (error instanceof AssetSecurityError && error.violationType === SecurityViolationTypes.CONTENT_POLICY_VIOLATION) {
        logAssetOperation(tenantId, null, 'CREATE', 'SECURITY_VIOLATION', {
          violations: error.details.violations
        });

        return formatResponse(400, {
          message: 'Content policy violation',
          details: error.details.violations
        });
      }
      throw error;
    }

    const asset = await Asset.save(tenantId, {
      contentType: requestData.contentType,
      description: requestData.description,
      fileSize: requestData.fileSize
    });

    const presignedUrl = await generateSecureSignedUrl(
      s3Client,
      process.env.ASSETS_BUCKET,
      asset.objectKey,
      'putObject',
      900
    );

    await Asset.update(tenantId, asset.id, { uploadUrl: presignedUrl });

    logAssetOperation(tenantId, asset.id, 'CREATE', 'SUCCESS', {
      contentType: requestData.contentType,
      fileSize: requestData.fileSize
    });

    return formatResponse(201, {
      asset: {
        id: asset.id,
        contentType: asset.contentType,
        description: asset.description,
        uploadStatus: asset.uploadStatus,
        uploadUrl: presignedUrl,
        objectKey: asset.objectKey,
        createdAt: asset.createdAt
      }
    });

  } catch (error) {
    assetLogger.error('Asset creation failed', {
      operation: 'create-asset',
      tenantId: event.requestContext?.authorizer?.tenantId || 'unknown',
      errorName: error.name,
      errorMessage: error.message
    });

    logAssetOperation(
      event.requestContext?.authorizer?.tenantId || 'unknown',
      null,
      'CREATE',
      'FAILED',
      { errorName: error.name, errorMessage: error.message }
    );

    if (error.name === 'ValidationError') {
      return formatResponse(400, {
        message: error.message,
        details: error.details
      });
    }

    if (error instanceof AssetSecurityError) {
      return formatResponse(403, {
        message: error.message,
        violationType: error.violationType
      });
    }

    return formatResponse(500, { message: 'Failed to create asset' });
  }
};
