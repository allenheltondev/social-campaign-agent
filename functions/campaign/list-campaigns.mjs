import { Campaign } from '../../models/campaign.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import { campaignLogger } from '../../utils/logger.mjs';

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const queryParams = event.queryStringParameters || {};

    if (!tenantId) {
      return formatResponse(400, { message: 'Missing tenant context' });
    }

    const { status, brandId, personaId, limit = '20', nextToken } = queryParams;
    const limitNum = Math.min(parseInt(limit), 100);

    const campaignListResult = await Campaign.list(tenantId, {
      status,
      brandId,
      personaId,
      limit: limitNum,
      nextToken
    });

    const response = {
      campaigns: campaignListResult.items,
      ...campaignListResult.pagination
    };

    return formatResponse(200, response);

  } catch (err) {
    campaignLogger.error('List campaigns operation failed', {
      operation: 'list-campaigns',
      tenantId: event.requestContext?.authorizer?.tenantId,
      errorName: err.name,
      errorMessage: err.message
    });
    return formatResponse(500, { message: 'Something went wrong' });
  }
};
