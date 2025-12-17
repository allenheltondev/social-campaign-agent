import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { CreateCampaignRequestSchema, validateRequestBody, generateCampaignId } from '../../models/campaign.mjs';
import { formatResponse } from '../../utils/api-response.mjs';

const lambda = new LambdaClient();

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;

    if (!tenantId) {
      return formatResponse(401, { message: 'Unauthorized' });
    }

    const requestData = validateRequestBody(CreateCampaignRequestSchema, event.body);

    const campaignId = generateCampaignId();
    const now = new Date().toISOString();

    const campaign = {
      id: campaignId,
      name: requestData.name,
      brief: requestData.brief,
      participants: {
        ...requestData.participants,
        distribution: requestData.participants.distribution || { mode: 'balanced' }
      },
      schedule: requestData.schedule
    };

    if (requestData.brandId) {
      campaign.brandId = requestData.brandId;
    }

    if (requestData.cadenceOverrides) {
      campaign.cadenceOverrides = requestData.cadenceOverrides;
    }

    if (requestData.messaging) {
      campaign.messaging = requestData.messaging;
    }

    if (requestData.assetOverrides) {
      campaign.assetOverrides = requestData.assetOverrides;
    }

    if (requestData.metadata) {
      campaign.metadata = requestData.metadata;
    } else {
      campaign.metadata = { source: 'api' };
    }

    await lambda.send(new InvokeCommand({
      FunctionName: `${process.env.BUILD_CAMPAIGN_FUNCTION_NAME}:$LATEST`,
      InvocationType: 'Event',
      Payload: JSON.stringify({
        tenantId,
        campaign
      })
    }));

    return formatResponse(202, {
      id: campaignId,
      status: 'building',
      message: 'Campaign creation initiated'
    });
  } catch (error) {
    console.error('Create campaign error:', error);

    if (error.message.includes('Validation error')) {
      return formatResponse(400, { message: error.message });
    }

    return formatResponse(500, { message: 'Internal server error' });
  }
};
