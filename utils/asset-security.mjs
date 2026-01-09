import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { utilLogger } from './logger.mjs';

const ddb = new DynamoDBClient();

export const SecurityViolationTypes = {
  TENANT_ISOLATION_VIOLATION: 'TENANT_ISOLATION_VIOLATION',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  INVALID_ASSET_REFERENCE: 'INVALID_ASSET_REFERENCE',
  CONTENT_POLICY_VIOLATION: 'CONTENT_POLICY_VIOLATION'
};

export class AssetSecurityError extends Error {
  constructor(message, violationType, details = {}) {
    super(message);
    this.name = 'AssetSecurityError';
    this.violationType = violationType;
    this.details = details;
  }
}

export const validateTenantOwnership = async (tenantId, assetId) => {
  try {
    const response = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${assetId}`,
        sk: 'asset'
      }),
      ProjectionExpression: 'pk, sk, tenantId'
    }));

    if (!response.Item) {
      throw new AssetSecurityError(
        'Asset not found or access denied',
        SecurityViolationTypes.UNAUTHORIZED_ACCESS,
        { tenantId, assetId }
      );
    }

    const asset = unmarshall(response.Item);

    if (asset.tenantId !== tenantId) {
      logSecurityViolation('TENANT_ISOLATION_VIOLATION', {
        requestedTenantId: tenantId,
        actualTenantId: asset.tenantId,
        assetId
      });

      throw new AssetSecurityError(
        'Tenant isolation violation detected',
        SecurityViolationTypes.TENANT_ISOLATION_VIOLATION,
        { tenantId, assetId, actualTenantId: asset.tenantId }
      );
    }

    return true;
  } catch (error) {
    if (error instanceof AssetSecurityError) {
      throw error;
    }

    utilLogger.error('Tenant ownership validation failed', {
      operation: 'validate-tenant-ownership',
      tenantId,
      assetId,
      errorName: error.name,
      errorMessage: error.message
    });

    throw new AssetSecurityError(
      'Failed to validate asset ownership',
      SecurityViolationTypes.UNAUTHORIZED_ACCESS,
      { tenantId, assetId }
    );
  }
};

export const validateAssetAccess = async (tenantId, assetId, operation) => {
  try {
    await validateTenantOwnership(tenantId, assetId);

    logAssetAccess(tenantId, assetId, operation, 'SUCCESS');

    return true;
  } catch (error) {
    logAssetAccess(tenantId, assetId, operation, 'DENIED', error.violationType);
    throw error;
  }
};

export const validateContentPolicy = (contentType, fileSize, description) => {
  const violations = [];

  const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/mov', 'video/avi'];
  const SUPPORTED_CONTENT_TYPES = [...SUPPORTED_IMAGE_TYPES, ...SUPPORTED_VIDEO_TYPES];

  if (!SUPPORTED_CONTENT_TYPES.includes(contentType)) {
    violations.push({
      field: 'contentType',
      violation: 'UNSUPPORTED_CONTENT_TYPE',
      message: `Content type ${contentType} is not supported`
    });
  }

  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
  const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

  if (SUPPORTED_IMAGE_TYPES.includes(contentType) && fileSize > MAX_IMAGE_SIZE) {
    violations.push({
      field: 'fileSize',
      violation: 'FILE_SIZE_EXCEEDED',
      message: `Image file size ${Math.round(fileSize / 1024 / 1024)}MB exceeds 10MB limit`
    });
  }

  if (SUPPORTED_VIDEO_TYPES.includes(contentType) && fileSize > MAX_VIDEO_SIZE) {
    violations.push({
      field: 'fileSize',
      violation: 'FILE_SIZE_EXCEEDED',
      message: `Video file size ${Math.round(fileSize / 1024 / 1024)}MB exceeds 100MB limit`
    });
  }

  const PROHIBITED_TERMS = [
    'malware', 'virus', 'exploit', 'hack', 'phishing',
    'spam', 'scam', 'fraud', 'illegal', 'pirated'
  ];

  if (!description || description.trim().length < 10) {
    violations.push({
      field: 'description',
      violation: 'DESCRIPTION_TOO_SHORT',
      message: 'Description must be at least 10 characters long'
    });
  }

  if (description && description.length > 500) {
    violations.push({
      field: 'description',
      violation: 'DESCRIPTION_TOO_LONG',
      message: 'Description must not exceed 500 characters'
    });
  }

  const descriptionLower = description.toLowerCase();
  const foundProhibitedTerms = PROHIBITED_TERMS.filter(term =>
    descriptionLower.includes(term)
  );

  if (foundProhibitedTerms.length > 0) {
    violations.push({
      field: 'description',
      violation: 'PROHIBITED_CONTENT',
      message: `Description contains prohibited terms: ${foundProhibitedTerms.join(', ')}`
    });
  }

  if (violations.length > 0) {
    throw new AssetSecurityError(
      'Content policy violations detected',
      SecurityViolationTypes.CONTENT_POLICY_VIOLATION,
      { violations }
    );
  }

  return true;
};

export const generateSecureSignedUrl = async (s3Client, bucket, objectKey, operation = 'getObject', expiresIn = 900) => {
  try {
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const { GetObjectCommand, PutObjectCommand } = await import('@aws-sdk/client-s3');

    let command;
    if (operation === 'putObject') {
      command = new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey
      });
    } else {
      command = new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey
      });
    }

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: Math.min(expiresIn, 900)
    });

    logSignedUrlGeneration(objectKey, operation, expiresIn);

    return signedUrl;
  } catch (error) {
    utilLogger.error('Signed URL generation failed', {
      operation: 'generate-signed-url',
      objectKey,
      errorName: error.name,
      errorMessage: error.message
    });

    throw new AssetSecurityError(
      'Failed to generate secure access URL',
      SecurityViolationTypes.UNAUTHORIZED_ACCESS,
      { objectKey, operation }
    );
  }
};

export const logAssetAccess = (tenantId, assetId, operation, result, violationType = null) => {
  const logData = {
    eventType: 'ASSET_ACCESS',
    tenantId,
    assetId,
    operation,
    result,
    timestamp: new Date().toISOString()
  };

  if (violationType) {
    logData.violationType = violationType;
  }

  if (result !== 'SUCCESS') {
    utilLogger.error('Asset access denied', logData);
  }
};

export const logSecurityViolation = (violationType, details) => {
  utilLogger.error('Security violation detected', {
    operation: 'security-violation',
    eventType: 'SECURITY_VIOLATION',
    violationType,
    details,
    timestamp: new Date().toISOString()
  });
};

export const logSignedUrlGeneration = (_objectKey, _operation, _expiresIn) => {
  // Removed information logging - only log errors
};

export const logAssetOperation = (tenantId, assetId, operation, result, metadata = {}) => {
  const logData = {
    eventType: 'ASSET_OPERATION',
    tenantId,
    assetId,
    operation,
    result,
    metadata,
    timestamp: new Date().toISOString()
  };

  if (result !== 'SUCCESS') {
    utilLogger.error('Asset operation failed', logData);
  }
};
