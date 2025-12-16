import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { formatResponse } from '../../utils/api-response.mjs';
import { createStandardizedError, BrandError, BrandErrorCodes } from '../../utils/error-handler.mjs';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  const operation = 'delete-brand';

  try {
    const { tenantId } = event.requestContext.authorizer;
    const { brandId } = event.pathParameters;

    if (!tenantId) {
      throw new BrandError('Unauthorized', BrandErrorCodes.UNAUTHORIZED, 401);
    }

    if (!brandId) {
      throw new BrandError('Missing brandId parameter', BrandErrorCodes.VALIDATION_ERROR, 400);
    }

    await ddb.send(new UpdateItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${brandId}`,
        sk: 'metadata'
      }),
      UpdateExpression: 'SET #status = :archived, #updatedAt = :updatedAt, #version = #version + :inc',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
        '#version': 'version'
      },
      ExpressionAttributeValues: marshall({
        ':archived': 'archived',
        ':updatedAt': new Date().toISOString(),
        ':inc': 1
      }),
      ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)'
    }));

    return formatResponse(204);
  } catch (error) {
    return createStandardizedError(error, operation, {
      tenantId: event.requestContext?.authorizer?.tenantId,
      brandId: event.pathParameters?.brandId
    });
  }
};
