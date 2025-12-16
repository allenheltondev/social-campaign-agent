import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
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

    const result = await ddb.send(new QueryCommand({
      TableName: process.env.TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :gsi1sk)',
      ExpressionAttributeValues: marshall({
        ':gsi1pk': `${tenantId}#${campaignId}`,
        ':gsi1sk': 'post#'
      })
    }));

    const posts = result.Items?.map(item => {
      const post = unmarshall(item);
      return {
        id: post.postId,
        campaignId: post.campaignId,
        personaId: post.personaId,
        platform: post.platform,
        scheduledDate: post.scheduledDate,
        topic: post.topic,
        assetRequirements: post.assetRequirements,
        content: post.content,
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
