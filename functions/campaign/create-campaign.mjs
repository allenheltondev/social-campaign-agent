import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { marshall } from '@aws-sdk/util-dynamodb';
import { CreateCampaignRequestSchema, validateRequestBody, generateCampaignId } from '../../models/campaign.mjs';
import { Campaign } from '../../models/campaign.mjs';
import { formatResponse } from '../../utils/api-response.mjs';

const ddb = new DynamoDBClient();
const eventBridge = new EventBridgeClient();

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
      tenantId,
      brandId: requestData.brandId || null,
      name: requestData.name,
      brief: requestData.brief,
      participants: {
        ...requestData.participants,
        distribution: requestData.participants.distribution || { mode: 'balanced' }
      },
      schedule: requestData.schedule,
      cadenceOverrides: requestData.cadenceOverrides || null,
      messaging: requestData.messaging || null,
      assetOverrides: requestData.assetOverrides || null,
      status: 'planning',
      planSummary: null,
      lastError: null,
      metadata: requestData.metadata || { source: 'api' },
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      version: 1,
      planVersion: null
    };

    const dynamoItem = Campaign.transformToDynamoDB(tenantId, campaign);

    await ddb.send(new PutItemCommand({
      TableName: process.env.TABLE_NAME,
      Item: marshall(dynamoItem),
      ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
    }));

    await eventBridge.send(new PutEventsCommand({
      Entries: [
        {
          Source: 'campaign-api',
          DetailType: 'Campaign Created',
          Detail: JSON.stringify({
            campaignId,
            tenantId,
            campaign: campaign
          }),
          EventBusName: process.env.EVENT_BUS_NAME || 'default'
        }
      ]
    }));

    return formatResponse(202, {
      id: campaignId,
      status: 'planning',
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
