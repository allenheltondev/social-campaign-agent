import { describe, it, expect } from 'vitest';
import { formatResponse } from '../../utils/api-response.mjs';

describe('API Response Utility Unit Tests', () => {
  it('should format successful response correctly', () => {
    const response = formatResponse(200, { message: 'success', data: { id: 1 } });

    expect(response.statusCode).toBe(200);
    expect(response.headers['Content-Type']).toBe('application/json');
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.body).toBe('{"message":"success","data":{"id":1}}');
  });

  it('should format error response correctly', () => {
    const response = formatResponse(400, { message: 'Bad request' });

    expect(response.statusCode).toBe(400);
    expect(response.headers['Content-Type']).toBe('application/json');
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.body).toBe('{"message":"Bad request"}');
  });

  it('should handle string body', () => {
    const response = formatResponse(404, 'Not found');

    expect(response.statusCode).toBe(404);
    expect(response.headers['Content-Type']).toBe('application/json');
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.body).toBe('Not found');
  });

  it('should handle empty body for 204 status', () => {
    const response = formatResponse(204, '');

    expect(response.statusCode).toBe(204);
    expect(response.headers['Content-Type']).toBe('application/json');
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.body).toBe(''); // Empty string is preserved
  });

  it('should handle null body', () => {
    const response = formatResponse(500, null);

    expect(response.statusCode).toBe(500);
    expect(response.headers['Content-Type']).toBe('application/json');
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.body).toBeUndefined(); // null results in no body property
  });

  it('should handle undefined body', () => {
    const response = formatResponse(204, undefined);

    expect(response.statusCode).toBe(204);
    expect(response.headers['Content-Type']).toBe('application/json');
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.body).toBeUndefined(); // undefined results in no body property
  });
});
