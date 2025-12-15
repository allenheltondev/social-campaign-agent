import { describe, it, expect } from 'vitest';
import { formatResponse } from './api-response.mjs';

describe('API Response Utility', () => {
  it('should create response with object body', () => {
    const response = formatResponse(200, { message: 'success', data: { id: 1 } });

    expect(response.statusCode).toBe(200);
    expect(response.headers['Content-Type']).toBe('application/json');
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.body).toBe('{"message":"success","data":{"id":1}}');
  });

  it('should create response with string body', () => {
    const response = formatResponse(404, 'Not found');

    expect(response.statusCode).toBe(404);
    expect(response.headers['Content-Type']).toBe('application/json');
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.body).toBe('Not found');
  });

  it('should create response with empty string for 204', () => {
    const response = formatResponse(204, '');

    expect(response.statusCode).toBe(204);
    expect(response.headers['Content-Type']).toBe('application/json');
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.body).toBe('');
  });
});
