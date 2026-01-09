import { z } from 'zod';
import {
  PersonaSchema,
  WritingExampleSchema,
  CreatePersonaRequestSchema,
  UpdatePersonaRequestSchema,
  CreateWritingExampleRequestSchema,
  QueryPersonasRequestSchema
} from '../models/persona.mjs';
import {
  BrandSchema,
  BrandAssetSchema,
  CreateBrandRequestSchema,
  UpdateBrandRequestSchema,
  CreateBrandAssetRequestSchema,
  QueryBrandsRequestSchema
} from '../models/brand.mjs';

export const validateRequestBody = (body, schema) => {
  try {
    if (!body) {
      throw new Error('Request body is required');
    }

    const parsed = JSON.parse(body);
    return schema.parse(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON in request body');
    }
    if (error instanceof z.ZodError) {
      const errorDetails = error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
        received: e.received
      }));
      throw new ValidationError('Request validation failed', errorDetails);
    }
    throw error;
  }
};

export const validateQueryParams = (params, schema) => {
  try {
    return schema.parse(params || {});
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorDetails = error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
        received: e.received
      }));
      throw new ValidationError('Query parameter validation failed', errorDetails);
    }
    throw error;
  }
};

export const validatePathParams = (pathParams, requiredParams) => {
  const missing = requiredParams.filter(param => !pathParams[param]);
  if (missing.length > 0) {
    throw new ValidationError('Missing required path parameters',
      missing.map(param => ({ field: param, message: 'Required parameter is missing' }))
    );
  }
  return pathParams;
};

export const validateTenantContext = (tenantId) => {
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new Error('Invalid or missing tenant context');
  }
};

export const validateCreatePersonaRequest = (body) => {
  return validateRequestBody(body, CreatePersonaRequestSchema);
};

export const validateUpdatePersonaRequest = (body) => {
  const validatedPersonaData = validateRequestBody(body, UpdatePersonaRequestSchema);

  if (Object.keys(validatedPersonaData).length === 0) {
    throw new ValidationError('Update request must contain at least one field to update', []);
  }

  return validatedPersonaData;
};

export const validateCreateExampleRequest = (body) => {
  return validateRequestBody(body, CreateWritingExampleRequestSchema);
};

export const validatePersonaQuery = (queryParams) => {
  return validateQueryParams(queryParams, QueryPersonasRequestSchema);
};

export const validatePersonaEntity = (persona) => {
  return PersonaSchema.parse(persona);
};

export const validateExampleEntity = (example) => {
  return WritingExampleSchema.parse(example);
};

export const validateCreateBrandRequest = (body) => {
  return validateRequestBody(body, CreateBrandRequestSchema);
};

export const validateUpdateBrandRequest = (body) => {
  const validatedBrandData = validateRequestBody(body, UpdateBrandRequestSchema);

  if (Object.keys(validatedBrandData).length === 0) {
    throw new ValidationError('Update request must contain at least one field to update', []);
  }

  return validatedBrandData;
};

export const validateCreateBrandAssetRequest = (body) => {
  return validateRequestBody(body, CreateBrandAssetRequestSchema);
};

export const validateBrandQuery = (queryParams) => {
  return validateQueryParams(queryParams, QueryBrandsRequestSchema);
};

export const validateBrandEntity = (brand) => {
  return BrandSchema.parse(brand);
};

export const validateBrandAssetEntity = (asset) => {
  return BrandAssetSchema.parse(asset);
};

export class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      details: this.details
    };
  }
}

export const sanitizeString = (input) => {
  if (typeof input !== 'string') {
    return input;
  }

  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
};

export const sanitizeObject = (obj) => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};
