import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { ulid } from 'ulid';
import { z } from 'zod';
import { logger } from '../../../utils/logger.mjs';

const ddb = new DynamoDBClient();

const CreateExampleSchema = z.object({
  content: z.string().min(1),
  platform: z.enum(['twitter', 'linkedin', 'instagram', 'facebook', 'blog']).optional(),
  context: z.string().optional()
});

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

    const requestData = CreateExampleSchema.parse(JSON.parse(event.body));

    const exampleId = ulid();
    const now = new Date().toISOString();

    const example = {
      ...requestData,
      exampleId,
      personaId,
      tenantId,
      createdAt: now
    };

    await ddb.send(new PutItemCommand({
      TableName: process.env.TABLE_NAME,
      Item: marshall({
        pk: `${tenantId}#${personaId}`,
        sk: `example#${exampleId}`,
        GSI1PK: `${tenantId}#${personaId}`,
        GSI1SK: `example#${now}`,
        ...example
      })
    }));

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(example)
    };
  } catch (error) {
    logger.error('Create example failed', {
      operation: 'create-example',
      tenantId: event.requestContext?.authorizer?.tenantId,
      personaId: event.pathParameters?.personaId,
      errorName: error.name,
      errorMessage: error.message
    });

    if (error.message.includes('Validation error')) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: error.message })
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

