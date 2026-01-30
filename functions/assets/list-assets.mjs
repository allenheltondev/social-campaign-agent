import { Asset } from '../../models/asset.mjs';
import { logAssetOperation } from '../../utils/asset-security.mjs';
import { logger } from '../../utils/logger.mjs';

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

    const queryParams = event.queryStringParameters || {};
    const limit = parseInt(queryParams.limit) || 20;
    const {nextToken} = queryParams;

    if (limit < 1 || limit > 100) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Limit must be between 1 and 100' })
      };
    }

    const assetListResponse = await Asset.list(tenantId, {
      limit,
      nextToken
    });

    logAssetOperation(tenantId, null, 'LIST', 'SUCCESS', {
      resultCount: assetListResponse.items.length,
      hasNextPage: assetListResponse.pagination.hasNextPage
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        assets: assetListResponse.items,
        pagination: assetListResponse.pagination
      })
    };

  } catch (error) {
    logger.error('Asset listing operation failed', {
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
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Invalid pagination token' })
      };
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Failed to list assets' })
    };
  }
};
