import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { formatResponse } from '../../../utils/api-response.mjs';
import { createStandardizedError, BrandError, BrandErrorCodes } from '../../../utils/error-handler.mjs';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  const operation = 'list-assets';

  try {
    const { tenantId } = event.requestContext.authorizer;
    const { brandId } = event.pathParameters;
    const { limit = 25, nextToken, type, category } = event.queryStringParameters || {};

    if (!tenantId) {
      throw new BrandError('Unauthorized', BrandErrorCodes.UNAUTHORIZED, 401);
    }

    if (!brandId) {
      throw new BrandError('Missing brandId parameter', BrandErrorCodes.VALIDATION_ERROR, 400);
    }

    const queryParams = {
      TableName: process.env.TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :gsi1pk',
      ExpressionAttributeValues: marshall({
        ':gsi1pk': `${tenantId}#${brandId}`
      }),
      Limit: parseInt(limit),
      ScanIndexForward: false // Most recent first
    };

    // Add type filter if specified
    if (type) {
      queryParams.KeyConditionExpression += ' AND begins_with(GSI1SK, :typePrefix)';
      queryParams.ExpressionAttributeValues[':typePrefix'] = marshall({ ':typePrefix': `ASSET#${type}#` })[':typePrefix'];
    } else {
      queryParams.KeyConditionExpression += ' AND begins_with(GSI1SK, :assetPrefix)';
      queryParams.ExpressionAttributeValues[':assetPrefix'] = marshall({ ':assetPrefix': 'ASSET#' })[':assetPrefix'];
    }

    // Add category filter if specified
    if (category) {
      queryParams.FilterExpression = '#category = :category';
      queryParams.ExpressionAttributeNames = { '#category': 'category' };
      queryParams.ExpressionAttributeValues[':category'] = marshall({ ':category': category })[':category'];
    }

    if (nextToken) {
      queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    }

    const response = await ddb.send(new QueryCommand(queryParams));

    const assets = response.Items?.map(item => {
      const asset = unmarshall(item);
      delete asset.pk;
      delete asset.sk;
      delete asset.GSI1PK;
      delete asset.GSI1SK;
      return asset;
    }) || [];

    const result = {
      assets,
      count: assets.length
    };

    if (response.LastEvaluatedKey) {
      result.nextToken = Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64');
    }

    return formatResponse(200, result);
  } catch (error) {
    return createStandardizedError(error, operation, {
      tenantId: event.requestContext?.authorizer?.tenantId,
      brandId: event.pathParameters?.brandId
    });
  }
};
