import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { marshall } from '@aws-sdk/util-dynamodb';
import { CreateCampaignRequestSchema, validateRequestBody, generateCampaignId } from '../../schemas/campaign.mjs';
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
      campaignId,
      tenantId,
      description: requestData.description,
      personaIds: requestData.personaIds,
      platforms: requestData.platforms,
      brandId: requestData.brandId,
      duration: requestData.duration,
      status: 'planning',
      createdAt: now,
      updatedAt: now,
      version: 1
    };

    await ddb.send(new PutItemCommand({
      TableName: process.env.TABLE_NAME,
      Item: marshall({
        pk: `${tenantId}#${campaignId}`,
        sk: 'campaign',
        GSI1PK: tenantId,
        GSI1SK: `campaign#${now}`,
        ...campaign
      }),
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
            personaIds: requestData.personaIds,
            platforms: requestData.platforms,
            brandId: requestData.brandId,
            duration: requestData.duration,
            description: requestData.description
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
