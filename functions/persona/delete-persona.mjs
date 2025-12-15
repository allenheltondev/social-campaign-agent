import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
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

    // Soft delete by setting isActive to false
    await ddb.send(new UpdateItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${personaId}`,
        sk: 'persona'
      }),
      UpdateExpression: 'SET #isActive = :false, #updatedAt = :updatedAt, #version = #version + :inc',
      ExpressionAttributeNames: {
        '#isActive': 'isActive',
        '#updatedAt': 'updatedAt',
        '#version': 'version'
      },
      ExpressionAttributeValues: marshall({
        ':false': false,
        ':updatedAt': new Date().toISOString(),
        ':inc': 1
      }),
      ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)'
    }));

    return formatResponse(204);
  } catch (error) {
    console.error('Delete persona error:', error);

    if (error.name === 'ConditionalCheckFailedException') {
      return formatResponse(404, { message: 'Persona not found' });
    }

    return formatResponse(500, { message: 'Internal server error' });
  }
};
