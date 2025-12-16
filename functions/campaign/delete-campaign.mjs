import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { formatResponse } from '../../utils/api-response.mjs';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { campaignId } = event.pathParameters;

    if (!tenantId || !campaignId) {
      return formatResponse(400, { message: 'Missing required parameters' });
    }

    const pk = `${tenantId}#${campaignId}`;
    const sk = 'campaign';

    const getResponse = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({ pk, sk })
    }));

    if (!getResponse.Item) {
      return formatResponse(404, { message: 'Campaign not found' });
    }

    const campaign = unmarshall(getResponse.Item);

    if (campaign.status === 'generating') {
      return formatResponse(409, {
        message: 'Cannot delete campaign while content generation is in progress',
        currentStatus: campaign.status
      });
    }

    const updatedCampaign = {
      ...campaign,
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
      version: campaign.version + 1,
      deletedAt: new Date().toISOString()
    };

    await ddb.send(new UpdateItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({ pk, sk }),
      UpdateExpression: 'SET #data = :data',
      ExpressionAttributeNames: {
        '#data': 'data'
      },
      ExpressionAttributeValues: marshall({
        ':data': updatedCampaign
      }),
      ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)'
    }));

    return formatResponse(204, null);

  } catch (err) {
    console.error('Delete campaign error:', err);

    if (err.name === 'ConditionalCheckFailedException') {
      return formatResponse(404, { message: 'Campaign not found' });
    }

    return formatResponse(500, { message: 'Something went wrong' });
  }
};
