import { S3Client } from '@aws-sdk/client-s3';
import { Asset, AssetSchema } from '../../models/asset.mjs';
import {
  validateContentPolicy,
  generateSecureSignedUrl,
  logAssetOperation,
  AssetSecurityError,
  SecurityViolationTypes
} from '../../utils/asset-security.mjs';
import { logger } from '../../utils/logger.mjs';

const s3Client = new S3Client();

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;

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

    const requestSchema = AssetSchema.pick({
      contentType: true,
      description: true,
      fileSize: true
    }).refine(
      (data) => {
        const maxSize = data.contentType.startsWith('video/') ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
        return data.fileSize <= maxSize;
      },
      (data) => ({
        message: `File size exceeds maximum allowed for ${data.contentType.startsWith('video/') ? 'video' : 'image'} files`
      })
    );

    const body = JSON.parse(event.body);
    const requestData = requestSchema.parse(body);

    // Enhanced security validation
    try {
      validateContentPolicy(requestData.contentType, requestData.fileSize, requestData.description);
    } catch (error) {
      if (error instanceof AssetSecurityError && error.violationType === SecurityViolationTypes.CONTENT_POLICY_VIOLATION) {
        logAssetOperation(tenantId, null, 'CREATE', 'SECURITY_VIOLATION', {
          violations: error.details.violations
        });

        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            message: 'Content policy violation',
            details: error.details.violations
          })
        };
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

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        asset: {
          id: asset.id,
          contentType: asset.contentType,
          description: asset.description,
          uploadStatus: asset.uploadStatus,
          uploadUrl: presignedUrl,
          objectKey: asset.objectKey,
          createdAt: asset.createdAt
        }
      })
    };

  } catch (error) {
    logger.error('Asset creation failed', {
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
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          message: error.message,
          details: error.details
        })
      };
    }

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
      body: JSON.stringify({ message: 'Failed to create asset' })
    };
  }
};
