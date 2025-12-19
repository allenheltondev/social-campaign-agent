import { Campaign } from '../../models/campaign.mjs';
import { formatResponse } from '../../utils/api-response.mjs';

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { campaignId } = event.pathParameters;

    if (!tenantId || !campaignId) {
      return formatResponse(400, { message: 'Missing required parameters' });
    }

    const campaign = await Campaign.findById(tenantId, campaignId);

    if (!campaign) {
      return formatResponse(404, { message: 'Campaign not found' });
    }

    if (campaign.status === 'generating') {
      return formatResponse(409, {
        message: 'Cannot delete campaign while content generation is in progress',
        currentStatus: campaign.status
      });
    }

    const updateData = {
      status: 'cancelled',
      deletedAt: new Date().toISOString()
    };

    const updatedCampaign = await Campaign.update(tenantId, campaignId, updateData);

    if (!updatedCampaign) {
      return formatResponse(404, { message: 'Campaign not found' });
    }

    return formatResponse(204, null);

  } catch (err) {
    console.error('Delete campaign error:', err);

    if (err.name === 'ConditionalCheckFailedException') {
      return formatResponse(404, { message: 'Campaign not found' });
    }

    return formatResponse(500, { message: 'Something went wrong' });
  }
};
