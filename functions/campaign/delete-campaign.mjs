import { Campaign } from '../../models/campaign.mjs';
import { logger } from '../../utils/logger.mjs';

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { campaignId } = event.pathParameters;

    if (!tenantId || !campaignId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Missing required parameters' })
      };
    }

    const campaign = await Campaign.findById(tenantId, campaignId);

    if (!campaign) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Campaign not found' })
      };
    }

    if (campaign.status === 'generating') {
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          message: 'Cannot delete campaign while content generation is in progress',
          currentStatus: campaign.status
        })
      };
    }

    const updateData = {
      status: 'cancelled',
      deletedAt: new Date().toISOString()
    };

    const updatedCampaign = await Campaign.update(tenantId, campaignId, updateData);

    if (!updatedCampaign) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Campaign not found' })
      };
    }

    return {
      statusCode: 204,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };

  } catch (err) {
    logger.error('Delete campaign operation failed', {
      operation: 'delete-campaign',
      tenantId: event.requestContext?.authorizer?.tenantId,
      campaignId: event.pathParameters?.campaignId,
      errorName: err.name,
      errorMessage: err.message
    });

    if (err.name === 'ConditionalCheckFailedException') {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Campaign not found' })
      };
    }

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
