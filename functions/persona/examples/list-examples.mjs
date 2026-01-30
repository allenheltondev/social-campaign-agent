import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { logger } from '../../../utils/logger.mjs';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { personaId } = event.pathParameters;

    if (!tenantId) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Unauthorized' })
      };
    }

    if (!personaId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Missing personaId parameter' })
      };
    }

    const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 20;
    let exclusiveStartKey;

    if (event.queryStringParameters?.nextToken) {
      try {
        exclusiveStartKey = JSON.parse(Buffer.from(event.queryStringParameters.nextToken, 'base64').toString());
      } catch (e) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ message: 'Invalid nextToken' })
        };
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
      delete example.pk;
      delete example.sk;
      delete example.GSI1PK;
      delete example.GSI1SK;

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

    const exampleListResponse = { examples };

    if (response.LastEvaluatedKey) {
      exampleListResponse.nextToken = Buffer.from(JSON.stringify(unmarshall(response.LastEvaluatedKey))).toString('base64');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(exampleListResponse)
    };
  } catch (error) {
    logger.error('List examples failed', {
      operation: 'list-examples',
      tenantId: event.requestContext?.authorizer?.tenantId,
      personaId: event.pathParameters?.personaId,
      errorName: error.name,
      errorMessage: error.message
    });
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};
