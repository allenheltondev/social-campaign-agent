import { Asset } from '../../models/asset.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import { logAssetOperation } from '../../utils/asset-security.mjs';
import { assetLogger } from '../../utils/logger.mjs';

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;

    if (!tenantId) {
      return formatResponse(401, { message: 'Unauthorized: Missing tenant context' });
    }

    const queryParams = event.queryStringParameters || {};
    const limit = parseInt(queryParams.limit) || 20;
    const {nextToken} = queryParams;
    const {contentType} = queryParams;
    const {createdAfter} = queryParams;

    if (limit < 1 || limit > 100) {
      return formatResponse(400, { message: 'Limit must be between 1 and 100' });
    }

    const assetListResponse = await Asset.list(tenantId, {
      limit,
      nextToken,
      contentType,
      createdAfter
    });

    logAssetOperation(tenantId, null, 'LIST', 'SUCCESS', {
      resultCount: assetListResponse.items.length,
      hasNextPage: assetListResponse.pagination.hasNextPage,
      filters: { contentType, createdAfter }
    });

    return formatResponse(200, {
      assets: assetListResponse.items,
      pagination: assetListResponse.pagination
    });

  } catch (error) {
    assetLogger.error('Asset listing operation failed', {
      operation: 'listAssets',
      tenantId: event.requestContext?.authorizer?.tenantId,
      errorName: error.name,
      errorMessage: error.message
    });

    logAssetOperation(
      event.requestContext?.authorizer?.tenantId || 'unknown',
      null,
      'LIST',
      'FAILED',
      { errorName: error.name, errorMessage: error.message }
    );

    if (error.message === 'Invalid nextToken') {
      return formatResponse(400, { message: 'Invalid pagination token' });
    }

    return formatResponse(500, { message: 'Failed to list assets' });
  }
};
