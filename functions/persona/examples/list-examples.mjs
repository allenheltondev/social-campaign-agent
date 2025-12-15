import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { formatResponse } from '../../../utils/api-response.mjs';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { personaId } = event.pathParameters;

    if (!tenantId) {
      return formatResponse(401, { message: 'Unauthorized' });
    }

    if (!personaId) {
      return formatResponse(400, { message: 'Missing personaId parameter' });
    }

    const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 20;
    let exclusiveStartKey;

    if (event.queryStringParameters?.nextToken) {
      try {
        exclusiveStartKey = JSON.parse(Buffer.from(event.queryStringParameters.nextToken, 'base64').toString());
      } catch (e) {
        return formatResponse(400, { message: 'Invalid nextToken' });
      }
    }

    const response = await ddb.send(new QueryCommand({
      TableName: process.env.TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :personaKey AND begins_with(GSI1SK, :examplePrefix)',
      ExpressionAttributeValues: marshall({
        ':personaKey': `${tenantId}#${personaId}`,
        ':examplePrefix': 'example#'
      }),
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey ? marshall(exclusiveStartKey) : undefined
    }));

    const examples = response.Items?.map(item => {
      const example = unmarshall(item);
      // Remove DynamoDB keys from response
      delete example.pk;
      delete example.sk;
      delete example.GSI1PK;
      delete example.GSI1SK;

      // Include analysis metadata if available
      return {
        exampleId: example.exampleId,
        personaId: example.personaId,
        platform: example.platform,
        intent: example.intent,
        text: example.text,
        notes: example.notes,
        analyzedAt: example.analyzedAt,
        createdAt: example.createdAt
      };
    }) || [];

    const result = { examples };

    if (response.LastEvaluatedKey) {
      result.nextToken = Buffer.from(JSON.stringify(unmarshall(response.LastEvaluatedKey))).toString('base64');
    }

    return formatResponse(200, result);
  } catch (error) {
    console.error('List examples error:', error);
    return formatResponse(500, { message: 'Internal server error' });
  }
};
