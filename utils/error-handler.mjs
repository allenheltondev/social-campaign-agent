import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'brand-management-api' });

export const BrandErrorCodes = {
  VALIDATION_ERROR: 'BRAND_VALIDATION_ERROR',
  NOT_FOUND: 'BRAND_NOT_FOUND',
  UNAUTHORIZED: 'BRAND_UNAUTHORIZED',
  CONFLICT: 'BRAND_CONFLICT',
  ASSET_NOT_FOUND: 'BRAND_ASSET_NOT_FOUND',
  ASSET_UPLOAD_FAILED: 'BRAND_ASSET_UPLOAD_FAILED',
  INVALID_FILE_TYPE: 'BRAND_INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'BRAND_FILE_TOO_LARGE',
  TENANT_ISOLATION_VIOLATION: 'BRAND_TENANT_ISOLATION_VIOLATION',
  INTERNAL_ERROR: 'BRAND_INTERNAL_ERROR'
};

export class BrandError extends Error {
  constructor(message, code, statusCode = 500, details = {}) {
    super(message);
    this.name = 'BrandError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const createStandardizedError = (error, operation, context = {}) => {
  const errorId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  let statusCode = 500;
  let errorCode = BrandErrorCodes.INTERNAL_ERROR;
  let message = 'Internal server error';
  let details = {};

  if (error instanceof BrandError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    message = error.message;
    details = error.details;
  } else if (error.message?.includes('Validation error')) {
    statusCode = 400;
    errorCode = BrandErrorCodes.VALIDATION_ERROR;
    message = error.message;
  } else if (error.name === 'ConditionalCheckFailedException') {
    statusCode = 404;
    errorCode = BrandErrorCodes.NOT_FOUND;
    message = 'Resource not found';
  } else if (error.name === 'ValidationException') {
    statusCode = 400;
    errorCode = BrandErrorCodes.VALIDATION_ERROR;
    message = 'Invalid request data';
  }

  logger.error('Operation failed', {
    errorId,
    operation,
    errorCode,
    statusCode,
    message: error.message,
    stack: error.stack,
    context
  });

  return {
    statusCode,
    body: JSON.stringify({
      message,
      errorCode,
      errorId,
      details
    }),
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  };
};


