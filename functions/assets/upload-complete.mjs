import { S3Client, GetObjectAttributesCommand } from '@aws-sdk/client-s3';
import { Asset } from '../../models/asset.mjs';
import { logAssetOperation } from '../../utils/asset-security.mjs';
import { assetLogger } from '../../utils/logger.mjs';

const s3Client = new S3Client();

export const handler = async (event) => {
  try {
    for (const record of event.Records) {
      if (record.eventSource !== 'aws:s3' || !record.eventName.startsWith('ObjectCreated:')) {
        continue;
      }

      const bucketName = record.s3.bucket.name;
      const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

      // Extract tenant ID and asset ID from object key: {tenantId}/assets/{assetId}.{extension}
      const keyParts = objectKey.split('/');
      if (keyParts.length !== 3 || keyParts[1] !== 'assets') {
        continue;
      }

      const tenantId = keyParts[0];
      const assetFileName = keyParts[2];
      const assetId = assetFileName.split('.')[0];

      const getObjectAttributesResponse = await s3Client.send(new GetObjectAttributesCommand({
        Bucket: bucketName,
        Key: objectKey,
        ObjectAttributes: ['ObjectSize']
      }));

      const actualFileSize = getObjectAttributesResponse.ObjectSize;

      await Asset.markUploadCompleted(tenantId, assetId, actualFileSize);

      logAssetOperation(tenantId, assetId, 'UPLOAD_COMPLETE', 'SUCCESS', {
        objectKey,
        fileSize: actualFileSize,
        bucketName
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Upload completion processed successfully' })
    };
  } catch (error) {
    assetLogger.error('Asset upload completion processing failed', {
      operation: 'upload-complete',
      tenantId: 'unknown',
      errorName: error.name,
      errorMessage: error.message
    });

    logAssetOperation('unknown', 'unknown', 'UPLOAD_COMPLETE', 'FAILED', {
      errorName: error.name,
      errorMessage: error.message
    });

    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to process upload completion' })
    };
  }
};
