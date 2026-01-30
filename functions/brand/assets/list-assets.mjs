import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { brandId } = event.pathParameters;
    const { nextToken, type, category } = event.queryStringParameters || {};
    const requestedLimit = parseInt(event.queryStringParameters?.limit) || 25;

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

    if (!brandId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Missing brandId parameter' })
      };
    }

    const queryParams = {
      TableName: process.env.TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :gsi1pk',
      ExpressionAttributeValues: marshall({
        ':gsi1pk': `${tenantId}#${brandId}`
      }),
      Limit: requestedLimit,
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

    const assetListResponse = {
      assets,
      count: assets.length
    };

    if (response.LastEvaluatedKey) {
      assetListResponse.nextToken = Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(assetListResponse)
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: error.statusCode || 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: error.message || 'Internal server error' })
    };
  }
};
