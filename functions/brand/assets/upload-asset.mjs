import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { marshall } from '@aws-sdk/util-dynamodb';
import { z } from 'zod';
import { ulid } from 'ulid';
import { logger } from '../../../utils/logger.mjs';

const ddb = new DynamoDBClient();
const s3Client = new S3Client();

const CreateBrandAssetSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['logo', 'image', 'video', 'document']),
  contentType: z.string(),
  fileData: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional()
});

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { brandId } = event.pathParameters;

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

    const brandResponse = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${brandId}`,
        sk: 'metadata'
      })
    }));

    if (!brandResponse.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Brand not found' })
      };
    }

    const requestData = CreateBrandAssetSchema.parse(JSON.parse(event.body));

    const { fileData, ...assetMetadata } = requestData;

    if (!fileData) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'File data is required' })
      };
    }

    const assetId = ulid();
    const now = new Date().toISOString();
    const s3Bucket = process.env.ASSETS_BUCKET_NAME;
    const s3Key = `${tenantId}/${brandId}/${assetId}`;

    const fileBuffer = Buffer.from(fileData, 'base64');

    try {
      await s3Client.send(new PutObjectCommand({
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
      logger.error('Asset upload to S3 failed', {
        operation: 'upload-asset',
        tenantId,
        brandId,
        errorName: s3Error.name,
        errorMessage: s3Error.message
      });
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Asset upload failed' })
      };
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

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(asset)
    };
  } catch (error) {
    logger.error('Upload asset failed', {
      operation: 'upload-asset',
      tenantId: event.requestContext?.authorizer?.tenantId,
      brandId: event.pathParameters?.brandId,
      errorName: error.name,
      errorMessage: error.message
    });

    if (error.message.includes('Validation error')) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: error.message })
      };
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};
