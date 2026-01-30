import { DynamoDBClient, DeleteItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { logger } from '../../../utils/logger.mjs';

const ddb = new DynamoDBClient();
const s3Client = new S3Client();

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { brandId, assetId } = event.pathParameters;

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

    if (!brandId || !assetId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Missing brandId or assetId parameter' })
      };
    }

    const assetResponse = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${brandId}`,
        sk: `ASSET#${assetId}`
      })
    }));

    if (!assetResponse.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Asset not found' })
      };
    }

    const asset = unmarshall(assetResponse.Item);

    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: asset.s3Bucket,
        Key: asset.s3Key
      }));
    } catch (s3Error) {
      logger.error('S3 cleanup failed but continuing with DynamoDB deletion', {
        operation: 'delete-asset-s3-cleanup',
        s3Bucket: asset.s3Bucket,
        s3Key: asset.s3Key,
        errorName: s3Error.name,
        errorMessage: s3Error.message
      });
    }

    await ddb.send(new DeleteItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${brandId}`,
        sk: `ASSET#${assetId}`
      }),
      ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)'
    }));

    return {
      statusCode: 204,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
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
