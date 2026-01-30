import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { logger } from '../../../utils/logger.mjs';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { personaId, exampleId } = event.pathParameters;

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

    if (!exampleId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Missing exampleId parameter' })
      };
    }

    const now = new Date();
    const ttlDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
    const ttlTimestamp = Math.floor(ttlDate.getTime() / 1000);

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

    return {
      statusCode: 204,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: ''
    };
  } catch (error) {
    logger.error('Delete example failed', {
      operation: 'delete-example',
      tenantId: event.requestContext?.authorizer?.tenantId,
      personaId: event.pathParameters?.personaId,
      exampleId: event.pathParameters?.exampleId,
      errorName: error.name,
      errorMessage: error.message
    });

    if (error.name === 'ConditionalCheckFailedException') {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Writing example not found' })
      };
    }

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
