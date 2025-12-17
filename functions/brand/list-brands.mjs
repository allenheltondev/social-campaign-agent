import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { formatResponse } from '../../utils/api-response.mjs';
import { createStandardizedError, BrandError, BrandErrorCodes } from '../../utils/error-handler.mjs';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  const operation = 'list-brands';

  try {
    const { tenantId } = event.requestContext.authorizer;
    const { search, limit = 20, lastEvaluatedKey } = event.queryStringParameters || {};

    if (!tenantId) {
      throw new BrandError('Tenant ID is required', BrandErrorCodes.VALIDATION_ERROR, 400);
    }

    const queryParams = {
      TableName: process.env.TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :tenantId AND begins_with(GSI1SK, :brandPrefix)',
      ExpressionAttributeValues: marshall({
        ':tenantId': tenantId,
        ':brandPrefix': 'BRAND#'
      }),
      ScanIndexForward: true,
      Limit: parseInt(limit)
    };

    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastEvaluatedKey));
    }

    const response = await ddb.send(new QueryCommand(queryParams));
    let brands = response.Items?.map(item => unmarshall(item)) || [];

    if (search) {
      const searchTerm = search.toLowerCase();
      brands = brands.filter(brand => {
        const coreValuesArray = Array.isArray(brand.coreValues) ? brand.coreValues : [];
        const searchableText = [
          brand.name,
          brand.ethos,
          ...coreValuesArray
        ].join(' ').toLowerCase();

        return searchableText.includes(searchTerm);
      });
    }

    const result = {
      brands: brands.map(brand => ({
        brandId: brand.brandId,
        name: brand.name,
        ethos: brand.ethos,
        coreValues: brand.coreValues,
        status: brand.status,
        createdAt: brand.createdAt,
        updatedAt: brand.updatedAt,
        version: brand.version,
        personalityTraits: brand.personalityTraits,
        contentStandards: {
          primaryAudience: brand.contentStandards?.primaryAudience,
          approvalThreshold: brand.contentStandards?.approvalThreshold,
          toneOfVoice: brand.contentStandards?.toneOfVoice
        }
      })),
      pagination: {
        limit: parseInt(limit),
        hasNextPage: !!response.LastEvaluatedKey,
        lastEvaluatedKey: response.LastEvaluatedKey ?
          encodeURIComponent(JSON.stringify(response.LastEvaluatedKey)) : null
      }
    };

    return formatResponse(200, result);

  } catch (error) {
    return createStandardizedError(error, operation, {
      tenantId: event.tenantId
    });
  }
};
