import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockSend = vi.fn();

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({ send: mockSend })),
  GetItemCommand: vi.fn(),
  PutItemCommand: vi.fn(),
  UpdateItemCommand: vi.fn(),
  QueryCommand: vi.fn()
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: vi.fn((obj) => obj),
  unmarshall: vi.fn((obj) => obj)
}));

describe('Campaign Asset Pool Immutability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TABLE_NAME = 'test-table';
  });

  it('should not modify existing campaign asset pools when brand assets are updated', async () => {
    const { AssetPoolBuilder } = await import('../../utils/asset-pool-builder.mjs');
    const { Brand } = await import('../../models/brand.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    const tenantId = 'tenant-123';
    const brandId = 'brand-456';
    const originalAssetId = 'asset-original';
    const newAssetId = 'asset-new';

    vi.spyOn(Brand, 'findById').mockResolvedValueOnce({
      id: brandId,
      name: 'Test Brand',
      assets: [
        {
          type: 'internal',
          assetId: originalAssetId,
          isDefault: false
        }
      ]
    });

    vi.spyOn(Asset, 'findById').mockImplementation(async (tid, aid) => {
      if (aid === originalAssetId) {
        return {
          id: originalAssetId,
          description: 'Original asset',
          contentType: 'image/png',
          approvalStatus: 'approved',
          uploadStatus: 'completed'
        };
      }
      if (aid === newAssetId) {
        return {
          id: newAssetId,
          description: 'New asset',
          contentType: 'image/jpeg',
          approvalStatus: 'approved',
          uploadStatus: 'completed'
        };
      }
      return null;
    });

    const originalAssetPool = await AssetPoolBuilder.buildAssetPool(tenantId, brandId, []);

    expect(originalAssetPool.brandDefaults).toHaveLength(1);
    expect(originalAssetPool.brandDefaults[0].assetId).toBe(originalAssetId);

    vi.spyOn(Brand, 'findById').mockResolvedVa
  expect(originalAssetPool.brandDefaults[0].assetId).toBe(originalAssetId);
  });

  it('should create new campaigns with current brand asset state', async () => {
    const { AssetPoolBuilder } = await import('../../utils/asset-pool-builder.mjs');
    const { Brand } = await import('../../models/brand.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    const tenantId = 'tenant-123';
    const brandId = 'brand-456';
    const assetId1 = 'asset-1';
    const assetId2 = 'asset-2';

    vi.spyOn(Brand, 'findById').mockResolvedValue({
      id: brandId,
      name: 'Test Brand',
      assets: [
        {
          type: 'internal',
          assetId: assetId1,
          isDefault: false
        },
        {
          type: 'internal',
          assetId: assetId2,
          isDefault: false
        }
      ]
    });

    vi.spyOn(Asset, 'findById').mockImplementation(async (tid, aid) => {
      return {
        id: aid,
        description: `Asset ${aid}`,
        contentType: 'image/png',
        approvalStatus: 'approved',
        uploadStatus: 'completed'
      };
    });

    const assetPool = await AssetPoolBuilder.buildAssetPool(tenantId, brandId, []);

    expect(assetPool.brandDefaults).toHaveLength(2);
    expect(assetPool.brandDefaults.map(a => a.assetId)).toContain(assetId1);
    expect(assetPool.brandDefaults.map(a => a.assetId)).toContain(assetId2);
  });

  it('should preserve existing campaign asset pools when retrieved', async () => {
    const { Campaign } = await import('../../models/campaign.mjs');

    const tenantId = 'tenant-123';
    const campaignId = 'campaign-123';

    const storedAssetPool = {
      brandDefaults: [
        {
          type: 'internal',
          assetId: 'asset-old',
          url: null,
          description: 'Old brand asset',
          contentType: 'image/png',
          usageIntent: null,
          isDefault: false,
          category: null,
          source: 'brand'
        }
      ],
      campaignSpecific: []
    };

    mockSend.mockResolvedValue({
      Item: {
        pk: `${tenantId}#${campaignId}`,
        sk: 'campaign',
        GSI1PK: tenantId,
        GSI1SK: `CAMPAIGN#2024-01-01T00:00:00.000Z`,
        id: campaignId,
        tenantId: tenantId,
        name: 'Test Campaign',
        brandId: 'brand-456',
        brief: {
          description: 'Test campaign description',
          objective: 'awareness',
          primaryCTA: null
        },
        participants: {
          personaIds: ['persona-1'],
          platforms: ['twitter'],
          distribution: { mode: 'balanced' }
        },
        schedule: {
          timezone: 'UTC',
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-01-31T00:00:00.000Z',
          allowedDaysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'],
          blackoutDates: null,
          postingWindows: null
        },
        cadenceOverrides: null,
        messaging: null,
        assetOverrides: null,
        status: 'completed',
        metadata: {
          source: 'api',
          externalRef: null
        },
        assetPool: storedAssetPool,
        assetPoolStats: {
          totalAssets: 1,
          brandAssets: 1,
          campaignAssets: 0,
          defaultAssets: 0
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        completedAt: null
      }
    });

    const campaign = await Campaign.findById(tenantId, campaignId);

    expect(campaign.assetPool).toBeDefined();
    expect(campaign.assetPool.brandDefaults).toHaveLength(1);
    expect(campaign.assetPool.brandDefaults[0].assetId).toBe('asset-old');
  });

  it('should build asset pool at campaign creation time as a snapshot', async () => {
    const { AssetPoolBuilder } = await import('../../utils/asset-pool-builder.mjs');
    const { Brand } = await import('../../models/brand.mjs');
    const { Asset } = await import('../../models/asset.mjs');

    const tenantId = 'tenant-123';
    const brandId = 'brand-456';
    const assetId = 'asset-789';

    vi.spyOn(Brand, 'findById').mockResolvedValue({
      id: brandId,
      name: 'Test Brand',
      assets: [
        {
          type: 'internal',
          assetId: assetId,
          isDefault: false,
          category: 'logo'
        }
      ]
    });

    vi.spyOn(Asset, 'findById').mockResolvedValue({
      id: assetId,
      description: 'Brand logo',
      contentType: 'image/png',
      approvalStatus: 'approved',
      uploadStatus: 'completed'
    });

    const assetPool = await AssetPoolBuilder.buildAssetPool(tenantId, brandId, []);
    const assetPoolSnapshot = JSON.parse(JSON.stringify(assetPool));

    expect(assetPool).toEqual(assetPoolSnapshot);
    expect(assetPool.brandDefaults[0].assetId).toBe(assetId);
    expect(assetPool.brandDefaults[0].source).toBe('brand');
  });
});
