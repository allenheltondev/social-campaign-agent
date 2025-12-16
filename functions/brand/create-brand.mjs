import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { CreateBrandRequestSchema, validateRequestBody, generateBrandId } from '../../schemas/brand.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import { createStandardizedError, BrandError, BrandErrorCodes } from '../../utils/error-handler.mjs';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  const operation = 'create-brand';

  try {
    const { tenantId } = event.requestContext.authorizer;

    if (!tenantId) {
      throw new BrandError('Unauthorized', BrandErrorCodes.UNAUTHORIZED, 401);
    }

    const requestData = validateRequestBody(CreateBrandRequestSchema, event.body);

    const brandId = generateBrandId();
    const now = new Date().toISOString();

    const brand = {
      ...requestData,
      brandId,
      tenantId,
      createdAt: now,
      updatedAt: now,
      version: 1,
      status: 'active'
    };

    await ddb.send(new PutItemCommand({
      TableName: process.env.TABLE_NAME,
      Item: marshall({
        pk: `${tenantId}#${brandId}`,
        sk: 'metadata',
        GSI1PK: tenantId,
        GSI1SK: `BRAND#${now}`,
        ...brand
      }),
      ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
    }));

    return formatResponse(201, brand);
  } catch (error) {
    return createStandardizedError(error, operation, {
      tenantId: event.requestContext?.authorizer?.tenantId
    });
  }
};
