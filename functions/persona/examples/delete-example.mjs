import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { formatResponse } from '../../../utils/api-response.mjs';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { personaId, exampleId } = event.pathParameters;

    if (!tenantId) {
      return formatResponse(401, { message: 'Unauthorized' });
    }

    if (!personaId) {
      return formatResponse(400, { message: 'Missing personaId parameter' });
    }

    if (!exampleId) {
      return formatResponse(400, { message: 'Missing exampleId parameter' });
    }

    // Soft delete by removing content and adding deletedAt timestamp with 7-day TTL
    const now = new Date();
    const ttlDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days from now
    const ttlTimestamp = Math.floor(ttlDate.getTime() / 1000); // Convert to Unix timestamp

    await ddb.send(new UpdateItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${personaId}`,
        sk: `example#${exampleId}`
      }),
      UpdateExpression: 'REMOVE #text, #platform, #intent, #notes SET #deletedAt = :deletedAt, #ttl = :ttl',
      ExpressionAttributeNames: {
        '#text': 'text',
        '#platform': 'platform',
        '#intent': 'intent',
        '#notes': 'notes',
        '#deletedAt': 'deletedAt',
        '#ttl': 'ttl'
      },
      ExpressionAttributeValues: marshall({
        ':deletedAt': now.toISOString(),
        ':ttl': ttlTimestamp
      }),
      ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)'
    }));

    return formatResponse(204);
  } catch (error) {
    console.error('Delete example error:', error);

    if (error.name === 'ConditionalCheckFailedException') {
      return formatResponse(404, { message: 'Writing example not found' });
    }

    return formatResponse(500, { message: 'Internal server error' });
  }
};
