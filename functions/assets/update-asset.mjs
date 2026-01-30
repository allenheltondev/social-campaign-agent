import { Asset, AssetSchema } from '../../models/asset.mjs';
import {
  validateAssetAccess,
  logAssetOperation,
  AssetSecurityError
} from '../../utils/asset-security.mjs';
import { logger } from '../../utils/logger.mjs';

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
      await validateAssetAccess(tenantId, assetId, 'UPDATE');
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

    const requestSchema = AssetSchema.pick({
      description: true
    }).partial();

    const body = JSON.parse(event.body);
    const updateData = requestSchema.parse(body);

    const updatedAsset = await Asset.update(tenantId, assetId, updateData);

    if (!updatedAsset) {
      logAssetOperation(tenantId, assetId, 'UPDATE', 'NOT_FOUND');
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Asset not found' })
      };
    }

    logAssetOperation(tenantId, assetId, 'UPDATE', 'SUCCESS', {
      updatedFields: Object.keys(updateData)
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ asset: updatedAsset })
    };

  } catch (error) {
    logger.error('Asset update operation failed', {
      operation: 'updateAsset',
      tenantId: event.requestContext?.authorizer?.tenantId,
      assetId: event.pathParameters?.assetId,
      errorName: error.name,
      errorMessage: error.message
    });

    logAssetOperation(
      event.requestContext?.authorizer?.tenantId || 'unknown',
      event.pathParameters?.assetId || 'unknown',
      'UPDATE',
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
      body: JSON.stringify({ message: 'Failed to update asset' })
    };
  }
};
