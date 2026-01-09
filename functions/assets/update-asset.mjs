import { Asset, UpdateAssetRequestSchema, validateRequestBody } from '../../models/asset.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import {
  validateAssetAccess,
  logAssetOperation,
  AssetSecurityError
} from '../../utils/asset-security.mjs';
import { assetLogger } from '../../utils/logger.mjs';

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
      await validateAssetAccess(tenantId, assetId, 'UPDATE');
    } catch (error) {
      if (error instanceof AssetSecurityError) {
        return formatResponse(403, {
          message: error.message,
          violationType: error.violationType
        });
      }
      throw error;
    }

    const updateData = validateRequestBody(UpdateAssetRequestSchema, event.body);

    const updatedAsset = await Asset.update(tenantId, assetId, updateData);

    if (!updatedAsset) {
      logAssetOperation(tenantId, assetId, 'UPDATE', 'NOT_FOUND');
      return formatResponse(404, { message: 'Asset not found' });
    }

    logAssetOperation(tenantId, assetId, 'UPDATE', 'SUCCESS', {
      updatedFields: Object.keys(updateData)
    });

    return formatResponse(200, { asset: updatedAsset });

  } catch (error) {
    assetLogger.error('Asset update operation failed', {
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

    return formatResponse(500, { message: 'Failed to update asset' });
  }
};
