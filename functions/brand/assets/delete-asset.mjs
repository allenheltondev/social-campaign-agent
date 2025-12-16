import { DynamoDBClient, DeleteItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { formatResponse } from '../../../utils/api-response.mjs';
import { createStandardizedError, BrandError, BrandErrorCodes } from '../../../utils/error-handler.mjs';

const ddb = new DynamoDBClient();
const s3 = new S3Client();

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

    // Get asset metadata to retrieve S3 information
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

    // Delete from S3
    try {
      await s3.send(new DeleteObjectCommand({
        Bucket: asset.s3Bucket,
        Key: asset.s3Key
      }));
    } catch (s3Error) {
      console.error('S3 cleanup failed but continuing with DynamoDB deletion:', s3Error);
    }

    // Delete from DynamoDB
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
