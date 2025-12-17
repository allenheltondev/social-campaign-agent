import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDynamoDBClient = {
  send: vi.fn()
};

const mockLambdaClient = {
  send: vi.fn()
};

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => mockDynamoDBClient),
  GetItemCommand: vi.fn((params) => ({ params })),
  UpdateItemCommand: vi.fn((params) => ({ params }))
}));

vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: vi.fn(() => mockLambdaClient),
  SendDurableExecutionCallbackSuccessCommand: vi.fn((params) => ({ params })),
  SendDurableExecutionCallbackFailureCommand: vi.fn((params) => ({ params }))
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: vi.fn((obj) => obj),
  unmarshall: vi.fn((obj) => obj)
}));

process.env.TABLE_NAME = 'test-table';

describe('Approval Callback Handler', () => {
  let handler;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import('../../functions/campaign/approval-callback.mjs');
    handler = module.handler;
  });

  const createEvent = (overrides = {}) => ({
    httpMethod: 'POST',
    pathParameters: { campaignId: 'test-campaign' },
    queryStringParameters: { callbackId: 'test-callback-id' },
    body: JSON.stringify({
      decision: 'approved',
      comments: 'Looks good'
    }),
    ...overrides
  });

  it('should handle OPTIONS requests', async () => {
    const event = { httpMethod: 'OPTIONS' };
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ message: 'OK' });
  });

  it('should reject non-POST methods', async () => {
    const event = { httpMethod: 'GET' };
    const result = await handler(event);

    expect(result.statusCode).toBe(405);
    expect(JSON.parse(result.body)).toEqual({ message: 'Method not allowed' });
  });

  it('should reject missing callback ID', async () => {
    const event = createEvent({ queryStringParameters: {} });
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({ message: 'Invalid callback ID' });
  });

  it('should reject missing campaign ID', async () => {
    const event = createEvent({ pathParameters: {} });
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({ message: 'Campaign ID is required' });
  });

  it('should successfully process valid approval', async () => {
    mockDynamoDBClient.send.mockResolvedValueOnce({
      Item: {
        callbackId: 'test-callback-id',
        status: 'pending_approval',
        tenantId: 'test-tenant'
      }
    });

    mockLambdaClient.send.mockResolvedValueOnce({});

    const event = createEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Approval submitted successfully',
      decision: 'approved'
    });
  });

  it('should handle campaign not found', async () => {
    mockDynamoDBClient.send.mockResolvedValueOnce({ Item: null });

    const event = createEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ message: 'Campaign not found or approval expired' });
  });

  it('should validate callback ID matches campaign', async () => {
    mockDynamoDBClient.send.mockResolvedValueOnce({
      Item: {
        callbackId: 'different-callback-id',
        status: 'pending_approval'
      }
    });

    const event = createEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ message: 'Campaign not found or approval expired' });
  });

  it('should validate campaign status is pending approval', async () => {
    mockDynamoDBClient.send.mockResolvedValueOnce({
      Item: {
        callbackId: 'test-callback-id',
        status: 'completed'
      }
    });

    const event = createEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ message: 'Campaign not found or approval expired' });
  });
});
