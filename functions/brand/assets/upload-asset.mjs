import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { CreateBrandAssetRequestSchema, validateRequestBody, generateAssetId } from '../../../schemas/brand.mjs';
import { formatResponse } from '../../../utils/api-response.mjs';
import { createStandardizedError, BrandError, BrandErrorCodes } from '../../../utils/error-handler.mjs';

const ddb = new DynamoDBClient();
const s3 = new S3Client();

export const handler = async (event) => {
  const operation = 'upload-asset';

  try {
    const { tenantId } = event.requestContext.authorizer;
    const { brandId } = event.pathParameters;

    if (!tenantId) {
      throw new BrandError('Unauthorized', BrandErrorCodes.UNAUTHORIZED, 401);
    }

    if (!brandId) {
      throw new BrandError('Missing brandId parameter', BrandErrorCodes.VALIDATION_ERROR, 400);
    }

    // Verify brand exists and belongs to tenant
    const brandResponse = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${brandId}`,
        sk: 'metadata'
      })
    }));

    if (!brandResponse.Item) {
      throw new BrandError('Brand not found', BrandErrorCodes.NOT_FOUND, 404);
    }

    const requestData = validateRequestBody(CreateBrandAssetRequestSchema, event.body);

    // Handle file upload data (base64 encoded in body)
    const { fileData, ...assetMetadata } = requestData;

    if (!fileData) {
      throw new BrandError('File data is required', BrandErrorCodes.VALIDATION_ERROR, 400);
    }

    const assetId = generateAssetId();
    const now = new Date().toISOString();
    const s3Bucket = process.env.ASSETS_BUCKET_NAME;
    const s3Key = `${tenantId}/${brandId}/${assetId}`;

    // Upload file to S3
    const fileBuffer = Buffer.from(fileData, 'base64');

    try {
      await s3.send(new PutObjectCommand({
        Bucket: s3Bucket,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: assetMetadata.contentType,
        Metadata: {
          tenantId,
          brandId,
          assetId,
          originalName: assetMetadata.name
        }
      }));
    } catch (s3Error) {
      throw new BrandError('Asset upload failed', BrandErrorCodes.ASSET_UPLOAD_FAILED, 500, {
        s3Error: s3Error.message
      });
    }

    const asset = {
      ...assetMetadata,
      assetId,
      brandId,
      tenantId,
      s3Bucket,
      s3Key,
      fileSize: fileBuffer.length,
      createdAt: now,
      updatedAt: now
    };

    // Store asset metadata in DynamoDB
    await ddb.send(new PutItemCommand({
      TableName: process.env.TABLE_NAME,
      Item: marshall({
        pk: `${tenantId}#${brandId}`,
        sk: `ASSET#${assetId}`,
        GSI1PK: `${tenantId}#${brandId}`,
        GSI1SK: `ASSET#${assetMetadata.type}#${now}`,
        ...asset
      }),
      ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
    }));

    return formatResponse(201, asset);
  } catch (error) {
    return createStandardizedError(error, operation, {
      tenantId: event.requestContext?.authorizer?.tenantId,
      brandId: event.pathParameters?.brandId
    });
  }
};
