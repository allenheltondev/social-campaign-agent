import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { formatResponse } from '../../utils/api-response.mjs';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { campaignId } = event.pathParameters;

    if (!tenantId) {
      return formatResponse(401, { message: 'Unauthorized' });
    }

    const result = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${campaignId}`,
        sk: 'campaign'
      })
    }));

    if (!result.Item) {
      return formatResponse(404, { message: 'Campaign not found' });
    }

    const campaign = unmarshall(result.Item);

    if (campaign.isActive === false) {
      return formatResponse(404, { message: 'Campaign not found' });
    }

    const response = {
      id: campaign.campaignId,
      description: campaign.description,
      personaIds: campaign.personaIds,
      platforms: campaign.platforms,
      brandId: campaign.brandId,
      duration: campaign.duration,
      status: campaign.status,
      planSummary: campaign.planSummary,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      completedAt: campaign.completedAt,
      version: campaign.version
    };

    return formatResponse(200, response);
  } catch (error) {
    console.error('Get campaign error:', error);
    return formatResponse(500, { message: 'Internal server error' });
  }
};
