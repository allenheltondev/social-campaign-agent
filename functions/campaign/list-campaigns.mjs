import { Campaign } from '../../models/campaign.mjs';
import { formatResponse } from '../../utils/api-response.mjs';

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const queryParams = event.queryStringParameters || {};

    if (!tenantId) {
      return formatResponse(400, { message: 'Missing tenant context' });
    }

    const { status, brandId, personaId, limit = '20', nextToken } = queryParams;
    const limitNum = Math.min(parseInt(limit), 100);

    const result = await Campaign.list(tenantId, {
      status,
      brandId,
      personaId,
      limit: limitNum,
      nextToken
    });

    const response = {
      campaigns: result.items,
      ...result.pagination
    };

    return formatResponse(200, response);

  } catch (err) {
    console.error('List campaigns error:', err);
    return formatResponse(500, { message: 'Something went wrong' });
  }
};
