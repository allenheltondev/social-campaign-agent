import { Brand } from '../../models/brand.mjs';
import { logger } from '../../utils/logger.mjs';

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { nextToken } = event.queryStringParameters || {};

    if (!tenantId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Tenant ID is required' })
      };
    }

    const brandListResponse = await Brand.list(tenantId, {
      limit: parseInt(event.queryStringParameters?.limit || '20'),
      nextToken
    });

    const response = {
      brands: brandListResponse.items,
      ...brandListResponse.pagination
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    logger.error('List brands operation failed', {
      operation: 'listBrands',
      tenantId: event.requestContext?.authorizer?.tenantId,
      errorName: error.name,
      errorMessage: error.message
    });
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};
