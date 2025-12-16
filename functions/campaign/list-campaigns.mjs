import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { formatResponse } from '../../utils/api-response.mjs';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const queryParams = event.queryStringParameters || {};

    if (!tenantId) {
      return formatResponse(400, { message: 'Missing tenant context' });
    }

    const { status, brandId, personaId, limit = '20', nextToken } = queryParams;
    const limitNum = Math.min(parseInt(limit), 100);

    let queryInput;

    if (status) {
      queryInput = {
        TableName: process.env.TABLE_NAME,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :gsi2pk AND begins_with(GSI2SK, :gsi2sk)',
        ExpressionAttributeValues: marshall({
          ':gsi2pk': tenantId,
          ':gsi2sk': `CAMPAIGN#${status}#`
        }),
        ScanIndexForward: false,
        Limit: limitNum
      };
    } else {
      queryInput = {
        TableName: process.env.TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :gsi1sk)',
        ExpressionAttributeValues: marshall({
          ':gsi1pk': tenantId,
          ':gsi1sk': 'CAMPAIGN#'
        }),
        ScanIndexForward: false,
        Limit: limitNum
      };
    }

    if (nextToken) {
      queryInput.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    }

    const response = await ddb.send(new QueryCommand(queryInput));

    let campaigns = response.Items?.map(item => unmarshall(item)) || [];

    if (brandId) {
      campaigns = campaigns.filter(campaign => campaign.brandId === brandId);
    }

    if (personaId) {
      campaigns = campaigns.filter(campaign =>
        campaign.participants?.personaIds?.includes(personaId)
      );
    }

    campaigns = campaigns.filter(campaign => !campaign.deletedAt);

    const result = {
      campaigns,
      count: campaigns.length
    };

    if (response.LastEvaluatedKey) {
      result.nextToken = Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64');
    }

    return formatResponse(200, result);

  } catch (err) {
    console.error('List campaigns error:', err);
    return formatResponse(500, { message: 'Something went wrong' });
  }
};
