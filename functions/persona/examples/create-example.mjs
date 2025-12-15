import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { ulid } from 'ulid';
import { CreateWritingExampleRequestSchema, validateRequestBody } from '../../../schemas/persona.mjs';
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

    const requestData = validateRequestBody(CreateWritingExampleRequestSchema, event.body);

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

    return formatResponse(201, example);
  } catch (error) {
    console.error('Create example error:', error);

    if (error.message.includes('Validation error')) {
      return formatResponse(400, { message: error.message });
    }

    return formatResponse(500, { message: 'Internal server error' });
  }
};

