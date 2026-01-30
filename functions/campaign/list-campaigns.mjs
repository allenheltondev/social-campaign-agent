import { Campaign } from '../../models/campaign.mjs';
import { logger } from '../../utils/logger.mjs';

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const queryParams = event.queryStringParameters || {};

    if (!tenantId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Missing tenant context' })
      };
    }

    const { limit = '20', nextToken } = queryParams;
    const limitNum = Math.min(parseInt(limit), 100);

    const campaignListResult = await Campaign.list(tenantId, {
      limit: limitNum,
      nextToken
    });

    const response = {
      campaigns: campaignListResult.items,
      ...campaignListResult.pagination
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(response)
    };

  } catch (err) {
    logger.error('List campaigns operation failed', {
      operation: 'list-campaigns',
      tenantId: event.requestContext?.authorizer?.tenantId,
      errorName: err.name,
      errorMessage: err.message
    });
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Something went wrong' })
    };
  }
};
