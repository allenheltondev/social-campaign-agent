import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockSend = vi.fn();
const mockLambdaSend = vi.fn();

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({ send: mockSend })),
  GetItemCommand: vi.fn(),
  PutItemCommand: vi.fn(),
  UpdateItemCommand: vi.fn(),
  QueryCommand: vi.fn()
}));

vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: vi.fn(() => ({ send: mockLambdaSend })),
  InvokeCommand: vi.fn()
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: vi.fn((obj) => obj),
  unmarshall: vi.fn((obj) => obj)
}));

describe('Campaign Asset Preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TABLE_NAME = 'test-table';
    process.env.BUILD_CAMPAIGN_FUNCTION_NAME = 'build-campaign-function';
  });

  it('should return asset pool preview when previewAssets is true', async () => {
    const { handler } = await import('../../functions/campaign/create-campaign.mjs');
    const { Brand } = await import('../../models/brand.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    const brandId = 'brand-123';
    const assetId = 'asset-456';

    vi.spyOn(Brand, 'findById').mockResolvedValue({
      id: brandId,
      name: 'Test Brand',
      assets: [{
        type: 'internal',
        assetId: assetId,
        isDefault: true,
        category: 'logo',
        usageIntent: {
          platforms: ['twitter', 'linkedin'],
          themes: ['product'],
          frequency: 'high'
        }
      }]
    });

    vi.spyOn(Asset, 'findById').mockResolvedValue({
      id: assetId,
      description: 'Brand logo',
      contentType: 'image/png',
      approvalStatus: 'approved',
      uploadStatus: 'completed'
    });

    const requestBody = {
      name: 'Test Campaign',
      brandId: brandId,
      brief: {
        description: 'Test campaign description',
        objective: 'awareness',
        primaryCTA: null
      },
      participants: {
        personaIds: ['persona-1'],
        platforms: ['twitter'],
        distribution: null
      },
      schedule: {
        timezone: 'UTC',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        allowedDaysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'],
        blackoutDates: null,
        postingWindows: null
      },
      cadenceOverrides: null,
      messaging: null,
      assetOverrides: null,
      previewAssets: true,
      metadata: null
    };

    const event = {
      requestContext: {
        authorizer: {
          tenantId: 'tenant-123'
        }
      },
      body: JSON.stringify(requestBody)
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.assetPool).toBeDefined();
    expect(body.assetPool.brandDefaults).toHaveLength(1);
    expect(body.assetPool.brandDefaults[0].assetId).toBe(assetId);
    expect(body.assetPool.brandDefaults[0].description).toBe('Brand logo');
    expect(body.assetPool.brandDefaults[0].isDefault).toBe(true);
    expect(body.assetPoolStats).toBeDefined();
    expect(body.assetPoolStats.totalAssets).toBe(1);
    expect(body.message).toContain('preview');
    expect(mockLambdaSend).not.toHaveBeenCalled();
  });

  it('should not invoke build-campaign when previewAssets is true', async () => {
    const { handler } = await import('../../functions/campaign/create-campaign.mjs');
    const { Brand } = await import('../../models/brand.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    vi.spyOn(Brand, 'findById').mockResolvedValue({
      id: 'brand-123',
      name: 'Test Brand',
      assets: []
    });

    vi.spyOn(Asset, 'findById').mockResolvedValue(null);

    const requestBody = {
      name: 'Test Campaign',
      brandId: 'brand-123',
      brief: {
        description: 'Test campaign description',
        objective: 'awareness',
        primaryCTA: null
      },
      participants: {
        personaIds: ['persona-1'],
        platforms: ['twitter'],
        distribution: null
      },
      schedule: {
        timezone: 'UTC',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        allowedDaysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'],
        blackoutDates: null,
        postingWindows: null
      },
      cadenceOverrides: null,
      messaging: null,
      assetOverrides: null,
      previewAssets: true,
      metadata: null
    };

    const event = {
      requestContext: {
        authorizer: {
          tenantId: 'tenant-123'
        }
      },
      body: JSON.stringify(requestBody)
    };

    await handler(event);

    expect(mockLambdaSend).not.toHaveBeenCalled();
  });

  it('should proceed with campaign creation when previewAssets is false', async () => {
    const { handler } = await import('../../functions/campaign/create-campaign.mjs');
    const { Brand } = await import('../../models/brand.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    vi.spyOn(Brand, 'findById').mockResolvedValue({
      id: 'brand-123',
      name: 'Test Brand',
      assets: []
    });

    vi.spyOn(Asset, 'findById').mockResolvedValue(null);

    mockLambdaSend.mockResolvedValue({});

    const requestBody = {
      name: 'Test Campaign',
      brandId: 'brand-123',
      brief: {
        description: 'Test campaign description',
        objective: 'awareness',
        primaryCTA: null
      },
      participants: {
        personaIds: ['persona-1'],
        platforms: ['twitter'],
        distribution: null
      },
      schedule: {
        timezone: 'UTC',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        allowedDaysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'],
        blackoutDates: null,
        postingWindows: null
      },
      cadenceOverrides: null,
      messaging: null,
      assetOverrides: null,
      previewAssets: false,
      metadata: null
    };

    const event = {
      requestContext: {
        authorizer: {
          tenantId: 'tenant-123'
        }
      },
      body: JSON.stringify(requestBody)
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(202);
    const body = JSON.parse(response.body);
    expect(body.id).toBeDefined();
    expect(body.status).toBe('building');
    expect(mockLambdaSend).toHaveBeenCalled();
  });
});
