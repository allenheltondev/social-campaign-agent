import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'social-media-campaign-builder' });

export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  CONFLICT: 'CONFLICT',
  TENANT_ISOLATION_VIOLATION: 'TENANT_ISOLATION_VIOLATION',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SAVE_FAILED: 'SAVE_FAILED',
  UPDATE_FAILED: 'UPDATE_FAILED',
  DELETE_FAILED: 'DELETE_FAILED',
  RETRIEVAL_FAILED: 'RETRIEVAL_FAILED'
};

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

export class ModelError extends Error {
  constructor(message, code, statusCode = 500, details = {}) {
    super(message);
    this.name = 'ModelError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

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
  let errorCode = ErrorCodes.INTERNAL_ERROR;
  let message = 'Internal server error';
  let details = {};

  if (error instanceof ModelError || error instanceof BrandError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    message = error.message;
    details = error.details;
  } else if (error.message?.includes('Validation error')) {
    statusCode = 400;
    errorCode = ErrorCodes.VALIDATION_ERROR;
    message = error.message;
  } else if (error.name === 'ConditionalCheckFailedException') {
    statusCode = 404;
    errorCode = ErrorCodes.NOT_FOUND;
    message = 'Resource not found';
  } else if (error.name === 'ValidationException') {
    statusCode = 400;
    errorCode = ErrorCodes.VALIDATION_ERROR;
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

export const createModelError = (operation, originalError, entityId = null, context = {}) => {
  const errorId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  let code = ErrorCodes.INTERNAL_ERROR;
  let message = `Failed to ${operation}`;
  let statusCode = 500;

  if (originalError.message?.includes('Validation error')) {
    code = ErrorCodes.VALIDATION_ERROR;
    message = originalError.message;
    statusCode = 400;
  } else if (originalError.name === 'ConditionalCheckFailedException') {
    code = ErrorCodes.NOT_FOUND;
    message = 'Resource not found';
    statusCode = 404;
  } else if (originalError.name === 'ValidationException') {
    code = ErrorCodes.VALIDATION_ERROR;
    message = 'Invalid request data';
    statusCode = 400;
  }

  logger.error(`Model operation failed: ${operation}`, {
    errorId,
    operation,
    entityId,
    errorName: originalError.name,
    errorMessage: originalError.message,
    context
  });

  return new ModelError(message, code, statusCode, { errorId, operation, entityId });
};


