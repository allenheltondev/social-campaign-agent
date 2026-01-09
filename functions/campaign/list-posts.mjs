import { SocialPost } from '../../models/social-post.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import { campaignLogger } from '../../utils/logger.mjs';

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { campaignId } = event.pathParameters;
    const { platform, persona, limit, nextToken } = event.queryStringParameters || {};

    if (!tenantId) {
      return formatResponse(401, { message: 'Unauthorized' });
    }

    let result;
    const queryLimit = limit ? parseInt(limit, 10) : 50;

    if (persona) {
      result = await SocialPost.findByPersona(tenantId, persona, campaignId, queryLimit, nextToken);
    } else {
      result = await SocialPost.findByCampaign(tenantId, campaignId, queryLimit, nextToken, platform);
    }

    const response = {
      posts: result.items,
      count: result.items.length,
      ...result.pagination
    };

    return formatResponse(200, response);
  } catch (error) {
    campaignLogger.error('List posts operation failed', {
      operation: 'list-posts',
      tenantId: event.requestContext?.authorizer?.tenantId,
      campaignId: event.pathParameters?.campaignId,
      errorName: error.name,
      errorMessage: error.message
    });
    return formatResponse(500, { message: 'Internal server error' });
  }
};
