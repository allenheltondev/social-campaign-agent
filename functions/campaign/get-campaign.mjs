import { formatResponse } from '../../utils/api-response.mjs';
import { Campaign } from '../../models/campaign.mjs';

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { campaignId } = event.pathParameters;

    if (!tenantId) {
      return formatResponse(401, { message: 'Unauthorized' });
    }

    const campaign = await Campaign.findById(tenantId, campaignId);

    if (!campaign) {
      return formatResponse(404, { message: 'Campaign not found' });
    }

    return formatResponse(200, campaign);
  } catch (error) {
    console.error('Get campaign error:', error);
    return formatResponse(500, { message: 'Internal server error' });
  }
};
