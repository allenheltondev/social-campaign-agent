import { DynamoDBClient, DeleteItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { formatResponse } from '../../../utils/api-response.mjs';
import { createStandardizedError, BrandError, BrandErrorCodes } from '../../../utils/error-handler.mjs';
import { brandLogger } from '../../../utils/logger.mjs';

const ddb = new DynamoDBClient();
const s3Client = new S3Client();

export const handler = async (event) => {
  const operation = 'delete-asset';

  try {
    const { tenantId } = event.requestContext.authorizer;
    const { brandId, assetId } = event.pathParameters;

    if (!tenantId) {
      throw new BrandError('Unauthorized', BrandErrorCodes.UNAUTHORIZED, 401);
    }

    if (!brandId || !assetId) {
      throw new BrandError('Missing brandId or assetId parameter', BrandErrorCodes.VALIDATION_ERROR, 400);
    }

    const assetResponse = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${brandId}`,
        sk: `ASSET#${assetId}`
      })
    }));

    if (!assetResponse.Item) {
      throw new BrandError('Asset not found', BrandErrorCodes.ASSET_NOT_FOUND, 404);
    }

    const asset = unmarshall(assetResponse.Item);

    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: asset.s3Bucket,
        Key: asset.s3Key
      }));
    } catch (s3Error) {
      brandLogger.error('S3 cleanup failed but continuing with DynamoDB deletion', {
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

    return formatResponse(204);
  } catch (error) {
    return createStandardizedError(error, operation, {
      tenantId: event.requestContext?.authorizer?.tenantId,
      brandId: event.pathParameters?.brandId,
      assetId: event.pathParameters?.assetId
    });
  }
};
