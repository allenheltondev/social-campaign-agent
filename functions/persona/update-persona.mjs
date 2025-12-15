import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { UpdatePersonaRequestSchema, validateRequestBody } from '../../schemas/persona.mjs';
import { formatResponse } from '../../utils/api-response.mjs';

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

    const updates = validateRequestBody(UpdatePersonaRequestSchema, event.body);

    if (Object.keys(updates).length === 0) {
      return formatResponse(400, { message: 'No valid fields to update' });
    }

    // Build update expression dynamically
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    Object.entries(updates).forEach(([key, value], index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;

      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = value;
    });

    // Always update the updatedAt timestamp and increment version
    updateExpressions.push('#updatedAt = :updatedAt', '#version = #version + :inc');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeNames['#version'] = 'version';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();
    expressionAttributeValues[':inc'] = 1;

    const response = await ddb.send(new UpdateItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${personaId}`,
        sk: 'persona'
      }),
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: marshall(expressionAttributeValues),
      ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)',
      ReturnValues: 'ALL_NEW'
    }));

    const updatedPersona = unmarshall(response.Attributes);

    // Remove DynamoDB keys from response
    delete updatedPersona.pk;
    delete updatedPersona.sk;
    delete updatedPersona.GSI1PK;
    delete updatedPersona.GSI1SK;

    return formatResponse(200, updatedPersona);
  } catch (error) {
    console.error('Update persona error:', error);

    if (error.message.includes('Validation error')) {
      return formatResponse(400, { message: error.message });
    }

    if (error.name === 'ConditionalCheckFailedException') {
      return formatResponse(404, { message: 'Persona not found' });
    }

    return formatResponse(500, { message: 'Internal server error' });
  }
};
