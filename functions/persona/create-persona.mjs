import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { ulid } from 'ulid';
import { CreatePersonaRequestSchema, validateRequestBody } from '../../models/persona.mjs';
import { formatResponse } from '../../utils/api-response.mjs';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;

    if (!tenantId) {
      return formatResponse(401, { message: 'Unauthorized' });
    }

    const requestData = validateRequestBody(CreatePersonaRequestSchema, event.body);

    const personaId = ulid();
    const now = new Date().toISOString();

    const persona = {
      ...requestData,
      personaId,
      tenantId,
      createdAt: now,
      updatedAt: now,
      version: 1,
      isActive: true
    };

    // Store in DynamoDB
    await ddb.send(new PutItemCommand({
      TableName: process.env.TABLE_NAME,
      Item: marshall({
        pk: `${tenantId}#${personaId}`,
        sk: 'persona',
        GSI1PK: tenantId,
        GSI1SK: `persona#${now}`,
        ...persona
      }),
      ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
    }));

    return formatResponse(201, { id: personaId });
  } catch (error) {
    console.error('Create persona error:', error);

    if (error.message.includes('Validation error')) {
      return formatResponse(400, { message: error.message });
    }

    return formatResponse(500, { message: 'Internal server error' });
  }
};
