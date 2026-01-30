import { SocialPost } from '../../models/social-post.mjs';
import { logger } from '../../utils/logger.mjs';

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { campaignId } = event.pathParameters;
    const { limit, nextToken } = event.queryStringParameters || {};

    if (!tenantId) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Unauthorized' })
      };
    }

    const queryLimit = limit ? parseInt(limit, 10) : 50;
    const result = await SocialPost.findByCampaign(tenantId, campaignId, queryLimit, nextToken);

    const response = {
      posts: result.items,
      count: result.items.length,
      ...result.pagination
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
    logger.error('List posts operation failed', {
      operation: 'list-posts',
      tenantId: event.requestContext?.authorizer?.tenantId,
      campaignId: event.pathParameters?.campaignId,
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
