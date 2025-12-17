import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall, marshall } from '@aws-sdk/util-dynamodb';
import { formatResponse } from '../../utils/api-response.mjs';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { campaignId } = event.pathParameters;
    const { platform, persona } = event.queryStringParameters || {};

    if (!tenantId) {
      return formatResponse(401, { message: 'Unauthorized' });
    }

    let queryParams;

    if (platform) {
      queryParams = {
        TableName: process.env.TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :gsi1sk)',
        ExpressionAttributeValues: marshall({
          ':gsi1pk': `${tenantId}#${campaignId}`,
          ':gsi1sk': `POST#${platform}#`
        })
      };
    } else if (persona) {
      queryParams = {
        TableName: process.env.TABLE_NAME,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :gsi2pk AND begins_with(GSI2SK, :gsi2sk)',
        ExpressionAttributeValues: marshall({
          ':gsi2pk': `${tenantId}#${persona}`,
          ':gsi2sk': `POST#${campaignId}#`
        })
      };
    } else {
      queryParams = {
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: marshall({
          ':pk': `${tenantId}#${campaignId}`,
          ':sk': 'POST#'
        })
      };
    }

    const result = await ddb.send(new QueryCommand(queryParams));

    const posts = result.Items?.map(item => {
      const post = unmarshall(item);
      return {
        postId: post.postId,
        campaignId: post.campaignId,
        tenantId: post.tenantId,
        personaId: post.personaId,
        platform: post.platform,
        scheduledAt: post.scheduledAt,
        topic: post.topic,
        intent: post.intent,
        assetRequirements: post.assetRequirements,
        content: post.content,
        references: post.references,
        status: post.status,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        version: post.version
      };
    }) || [];

    return formatResponse(200, { posts, count: posts.length });
  } catch (error) {
    console.error('List posts error:', error);
    return formatResponse(500, { message: 'Internal server error' });
  }
};
