import { describe, it, expect } from 'vitest';
import { createStandardizedError, BrandError, BrandErrorCodes } from '../../utils/error-handler.mjs';

describe('Error Handler Utility', () => {
  it('should handle BrandError correctly', () => {
    const error = new BrandError('Test error', BrandErrorCodes.VALIDATION_ERROR, 400, { field: 'name' });
    const result = createStandardizedError(error, 'test-operation', { tenantId: 'test' });

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Test error');
    expect(body.errorCode).toBe('BRAND_VALIDATION_ERROR');
    expect(body.details).toEqual({ field: 'name' });
    expect(body.errorId).toMatch(/^\d{13}-[a-z0-9]{9}$/);
  });

  it('should handle validation errors', () => {
    const error = new Error('Validation error: name is required');
    const result = createStandardizedError(error, 'test-operation');

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('Validation error: name is required');
  });

  it('should handle ConditionalCheckFailedException', () => {
    const error = new Error('ConditionalCheckFailedException');
    error.name = 'ConditionalCheckFailedException';
    const result = createStandardizedError(error, 'test-operation');

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('NOT_FOUND');
    expect(body.message).toBe('Resource not found');
  });

  it('should handle generic errors', () => {
    const error = new Error('Something went wrong');
    const result = createStandardizedError(error, 'test-operation');

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('Internal server error');
  });

  it('should include CORS headers', () => {
    const error = new Error('Test error');
    const result = createStandardizedError(error, 'test-operation');

    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers['Content-Type']).toBe('application/json');
  });
});
