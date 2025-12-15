import { z } from 'zod';
import {
  PersonaSchema,
  WritingExampleSchema,
  CreatePersonaRequestSchema,
  UpdatePersonaRequestSchema,
  CreateWritingExampleRequestSchema,
  QueryPersonasRequestSchema
} from '../schemas/persona.mjs';

/**
 * Enhanced validation utilities for request/response processing
 */

/**
 * Validate and parse JSON request body
 * @param {string} body - Raw request body
 * @param {z.ZodSchema} schema - Zod schema for validation
 * @returns {Object} Parsed and validated data
 * @throws {Error} Validation error with details
 */
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

/**
 * Validate query parameters
 * @param {Object} params - Query parameters object
 * @param {z.ZodSchema} schema - Zod schema for validation
 * @returns {Object} Validated parameters
 * @throws {Error} Validation error with details
 */
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

/**
 * Validate path parameters
 * @param {Object} pathParams - Path parameters object
 * @param {Array<string>} requiredParams - List of required parameter names
 * @returns {Object} Validated path parameters
 * @throws {Error} If required parameters are missing
 */
export const validatePathParams = (pathParams, requiredParams) => {
  const missing = requiredParams.filter(param => !pathParams[param]);
  if (missing.length > 0) {
    throw new ValidationError('Missing required path parameters',
      missing.map(param => ({ field: param, message: 'Required parameter is missing' }))
    );
  }
  return pathParams;
};

/**
 * Validate tenant context
 * @param {string} tenantId - Tenant identifier from auth context
 * @throws {Error} If tenant ID is missing or invalid
 */
export const validateTenantContext = (tenantId) => {
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new Error('Invalid or missing tenant context');
  }
};

/**
 * Validate persona creation request
 * @param {string} body - Request body
 * @returns {Object} Validated persona data
 */
export const validateCreatePersonaRequest = (body) => {
  return validateRequestBody(body, CreatePersonaRequestSchema);
};

/**
 * Validate persona update request
 * @param {string} body - Request body
 * @returns {Object} Validated update data
 */
export const validateUpdatePersonaRequest = (body) => {
  const data = validateRequestBody(body, UpdatePersonaRequestSchema);

  // Ensure at least one field is being updated
  if (Object.keys(data).length === 0) {
    throw new ValidationError('Update request must contain at least one field to update', []);
  }

  return data;
};

/**
 * Validate writing example creation request
 * @param {string} body - Request body
 * @returns {Object} Validated example data
 */
export const validateCreateExampleRequest = (body) => {
  return validateRequestBody(body, CreateWritingExampleRequestSchema);
};

/**
 * Validate persona query parameters
 * @param {Object} queryParams - Query parameters
 * @returns {Object} Validated query parameters
 */
export const validatePersonaQuery = (queryParams) => {
  return validateQueryParams(queryParams, QueryPersonasRequestSchema);
};

/**
 * Validate complete persona entity (for database operations)
 * @param {Object} persona - Persona object
 * @returns {Object} Validated persona
 */
export const validatePersonaEntity = (persona) => {
  return PersonaSchema.parse(persona);
};

/**
 * Validate complete writing example entity (for database operations)
 * @param {Object} example - Writing example object
 * @returns {Object} Validated example
 */
export const validateExampleEntity = (example) => {
  return WritingExampleSchema.parse(example);
};

/**
 * Custom validation error class for structured error handling
 */
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

/**
 * Sanitize string input to prevent injection attacks
 * @param {string} input - Input string
 * @returns {string} Sanitized string
 */
export const sanitizeString = (input) => {
  if (typeof input !== 'string') {
    return input;
  }

  // Remove potentially dangerous characters while preserving normal text
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
};

/**
 * Sanitize object by applying string sanitization to all string values
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
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
