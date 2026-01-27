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
  InvokeCommand: vi.fn((input) => ({ input }))
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: vi.fn((obj) => obj),
  unmarshall: vi.fn((obj) => obj)
}));

describe('Campaign Creation with Assets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TABLE_NAME = 'test-table';
    process.env.BUILD_CAMPAIGN_FUNCTION_NAME = 'build-campaign-function';
  });

  it('should include brand assets when campaign has brand ID', async () => {
    const { handler } = await import('../../functions/campaign/create-campaign.mjs');
    const { Brand } = await import('../../models/brand.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    const brandId = 'brand-123';
    const brandAssetId = 'brand-asset-456';

    vi.spyOn(Brand, 'findById').mockResolvedValue({
      id: brandId,
      name: 'Test Brand',
      assets: [{
        type: 'internal',
        assetId: brandAssetId,
        isDefault: true,
        category: 'logo'
      }]
    });

    vi.spyOn(Asset, 'findById').mockResolvedValue({
      id: brandAssetId,
      description: 'Brand logo',
      contentType: 'image/png',
      approvalStatus: 'approved',
      uploadStatus: 'completed'
    });

    let capturedPayload = null;
    mockLambdaSend.mockImplementation(async (command) => {
      capturedPayload = JSON.parse(command.input.Payload);
      return {};
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
    expect(mockLambdaSend).toHaveBeenCalled();
    expect(capturedPayload.campaign.assetPool).toBeDefined();
    expect(capturedPayload.campaign.assetPool.brandDefaults).toHaveLength(1);
    expect(capturedPayload.campaign.assetPool.brandDefaults[0].assetId).toBe(brandAssetId);
    expect(capturedPayload.campaign.assetPool.brandDefaults[0].source).toBe('brand');
  });

  it('should use only campaign assets when no brand ID is provided', async () => {
    const { handler } = await import('../../functions/campaign/create-campaign.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    const campaignAssetId = 'campaign-asset-789';

    vi.spyOn(Asset, 'findById').mockResolvedValue({
      id: campaignAssetId,
      description: 'Campaign specific asset',
      contentType: 'image/jpeg',
      approvalStatus: 'approved',
      uploadStatus: 'completed'
    });

    let capturedPayload2 = null;
    mockLambdaSend.mockImplementation(async (command) => {
      capturedPayload2 = JSON.parse(command.input.Payload);
      return {};
    });

    const requestBody = {
      name: 'Test Campaign',
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
      assets: [{
        type: 'internal',
        assetId: campaignAssetId
      }],
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

    if (response.statusCode !== 202) {
      console.log('Test 2 - Response status:', response.statusCode);
      console.log('Test 2 - Response body:', JSON.parse(response.body));
    }

    expect(response.statusCode).toBe(202);
    expect(mockLambdaSend).toHaveBeenCalled();
    expect(capturedPayload2.campaign.assetPool).toBeDefined();
    expect(capturedPayload2.campaign.assetPool.brandDefaults).toHaveLength(0);
    expect(capturedPayload2.campaign.assetPool.campaignSpecific).toHaveLength(1);
    expect(capturedPayload2.campaign.assetPool.campaignSpecific[0].assetId).toBe(campaignAssetId);
    expect(capturedPayload2.campaign.assetPool.campaignSpecific[0].source).toBe('campaign');
  });

  it('should merge brand and campaign assets correctly', async () => {
    const { handler } = await import('../../functions/campaign/create-campaign.mjs');
    const { Brand } = await import('../../models/brand.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    const brandId = 'brand-123';
    const brandAssetId = 'brand-asset-456';
    const campaignAssetId = 'campaign-asset-789';

    vi.spyOn(Brand, 'findById').mockResolvedValue({
      id: brandId,
      name: 'Test Brand',
      assets: [{
        type: 'internal',
        assetId: brandAssetId,
        isDefault: false
      }]
    });

    vi.spyOn(Asset, 'findById').mockImplementation(async (tenantId, assetId) => {
      if (assetId === brandAssetId) {
        return {
          id: brandAssetId,
          description: 'Brand asset',
          contentType: 'image/png',
          approvalStatus: 'approved',
          uploadStatus: 'completed'
        };
      }
      if (assetId === campaignAssetId) {
        return {
          id: campaignAssetId,
          description: 'Campaign asset',
          contentType: 'image/jpeg',
          approvalStatus: 'approved',
          uploadStatus: 'completed'
        };
      }
      return null;
    });

    let capturedPayload3 = null;
    mockLambdaSend.mockImplementation(async (command) => {
      capturedPayload3 = JSON.parse(command.input.Payload);
      return {};
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
      assets: [{
        type: 'internal',
        assetId: campaignAssetId
      }],
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

    if (response.statusCode !== 202) {
      console.log('Test 3 - Response status:', response.statusCode);
      console.log('Test 3 - Response body:', JSON.parse(response.body));
    }

    expect(response.statusCode).toBe(202);
    expect(mockLambdaSend).toHaveBeenCalled();
    expect(capturedPayload3.campaign.assetPool).toBeDefined();
    expect(capturedPayload3.campaign.assetPool.brandDefaults).toHaveLength(1);
    expect(capturedPayload3.campaign.assetPool.campaignSpecific).toHaveLength(1);
    expect(capturedPayload3.campaign.assetPool.brandDefaults[0].assetId).toBe(brandAssetId);
    expect(capturedPayload3.campaign.assetPool.brandDefaults[0].source).toBe('brand');
    expect(capturedPayload3.campaign.assetPool.campaignSpecific[0].assetId).toBe(campaignAssetId);
    expect(capturedPayload3.campaign.assetPool.campaignSpecific[0].source).toBe('campaign');
    expect(capturedPayload3.campaign.assetPoolStats.totalAssets).toBe(2);
    expect(capturedPayload3.campaign.assetPoolStats.brandAssets).toBe(1);
    expect(capturedPayload3.campaign.assetPoolStats.campaignAssets).toBe(1);
  });
});
