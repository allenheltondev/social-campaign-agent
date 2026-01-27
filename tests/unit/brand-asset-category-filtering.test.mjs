import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from '../../functions/brand/get-brand.mjs';
import { Brand } from '../../models/brand.mjs';
import { Asset } from '../../models/asset.mjs';

vi.mock('../../models/brand.mjs', () => ({
  Brand: {
    findById: vi.fn()
  }
}));

vi.mock('../../models/asset.mjs', () => ({
  Asset: {
    findById: vi.fn()
  }
}));

vi.mock('../../utils/logger.mjs', () => ({
  brandLogger: {
    error: vi.fn()
  }
}));

describe('Brand Asset Category Filtering', () => {
  const mockTenantId = 'tenant_123';
  const mockBrandId = 'brand_456';
  const mockUserId = 'user_789';

  const mockBrandWithCategorizedAssets = {
    id: mockBrandId,
    name: 'Test Brand',
    ethos: 'Test ethos',
    coreValues: ['value1'],
    primaryAudience: 'professionals',
    voiceGuidelines: {
      tone: ['professional'],
      style: ['clear'],
      messaging: ['direct']
    },
    visualIdentity: {
      colorPalette: ['#000000'],
      typography: ['Arial'],
      imagery: ['modern']
    },
    contentStandards: {
      qualityRequirements: ['high'],
      restrictions: []
    },
    platformGuidelines: {
      enabled: ['twitter', 'linkedin']
    },
    assets: [
      {
        type: 'internal',
        assetId: 'asset_1',
        categories: ['logo', 'brand'],
        isDefault: false,
        addedAt: '2024-01-01T00:00:00Z',
        addedBy: mockUserId
      },
      {
        type: 'internal',
        assetId: 'asset_2',
        categories: ['product-image'],
        isDefault: false,
        addedAt: '2024-01-01T00:00:00Z',
        addedBy: mockUserId
      },
      {
        type: 'external',
        url: 'https://example.com/image.jpg',
        description: 'External lifestyle image',
        contentType: 'image/jpeg',
        categories: ['lifestyle-image', 'social'],
        isDefault: false,
        addedAt: '2024-01-01T00:00:00Z',
        addedBy: mockUserId
      },
      {
        type: 'internal',
        assetId: 'asset_3',
        categories: null,
        isDefault: false,
        addedAt: '2024-01-01T00:00:00Z',
        addedBy: mockUserId
      }
    ],
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should filter assets by single category', async () => {
    Brand.findById.mockResolvedValue(JSON.parse(JSON.stringify(mockBrandWithCategorizedAssets)));
    Asset.findById.mockResolvedValue({
      contentType: 'image/png',
      description: 'Test asset',
      fileSize: 1024,
      uploadStatus: 'completed'
    });

    const event = {
      requestContext: {
        authorizer: {
          tenantId: mockTenantId
        }
      },
      pathParameters: {
        brandId: mockBrandId
      },
      queryStringParameters: {
        category: 'logo'
      }
    };

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.assets).toHaveLength(1);
    expect(body.assets[0].assetId).toBe('asset_1');
    expect(body.assets[0].categories).toContain('logo');
  });

  it('should filter assets by multiple categories', async () => {
    Brand.findById.mockResolvedValue(JSON.parse(JSON.stringify(mockBrandWithCategorizedAssets)));
    Asset.findById.mockResolvedValue({
      contentType: 'image/png',
      description: 'Test asset',
      fileSize: 1024,
      uploadStatus: 'completed'
    });

    const event = {
      requestContext: {
        authorizer: {
          tenantId: mockTenantId
        }
      },
      pathParameters: {
        brandId: mockBrandId
      },
      queryStringParameters: {
        category: 'logo,product-image'
      }
    };

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.assets).toHaveLength(2);
    expect(body.assets.map(a => a.assetId)).toContain('asset_1');
    expect(body.assets.map(a => a.assetId)).toContain('asset_2');
  });

  it('should return all assets when no category filter is specified', async () => {
    Brand.findById.mockResolvedValue(JSON.parse(JSON.stringify(mockBrandWithCategorizedAssets)));
    Asset.findById.mockResolvedValue({
      contentType: 'image/png',
      description: 'Test asset',
      fileSize: 1024,
      uploadStatus: 'completed'
    });

    const event = {
      requestContext: {
        authorizer: {
          tenantId: mockTenantId
        }
      },
      pathParameters: {
        brandId: mockBrandId
      },
      queryStringParameters: null
    };

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.assets).toHaveLength(4);
  });

  it('should exclude assets without categories when filtering', async () => {
    Brand.findById.mockResolvedValue(JSON.parse(JSON.stringify(mockBrandWithCategorizedAssets)));
    Asset.findById.mockResolvedValue({
      contentType: 'image/png',
      description: 'Test asset',
      fileSize: 1024,
      uploadStatus: 'completed'
    });

    const event = {
      requestContext: {
        authorizer: {
          tenantId: mockTenantId
        }
      },
      pathParameters: {
        brandId: mockBrandId
      },
      queryStringParameters: {
        category: 'logo'
      }
    };

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.assets.every(a => a.categories && a.categories.length > 0)).toBe(true);
  });

  it('should handle category filter with whitespace', async () => {
    Brand.findById.mockResolvedValue(JSON.parse(JSON.stringify(mockBrandWithCategorizedAssets)));
    Asset.findById.mockResolvedValue({
      contentType: 'image/png',
      description: 'Test asset',
      fileSize: 1024,
      uploadStatus: 'completed'
    });

    const event = {
      requestContext: {
        authorizer: {
          tenantId: mockTenantId
        }
      },
      pathParameters: {
        brandId: mockBrandId
      },
      queryStringParameters: {
        category: ' logo , product-image '
      }
    };

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.assets).toHaveLength(2);
  });

  it('should return empty assets array when no assets match category', async () => {
    Brand.findById.mockResolvedValue(JSON.parse(JSON.stringify(mockBrandWithCategorizedAssets)));
    Asset.findById.mockResolvedValue({
      contentType: 'image/png',
      description: 'Test asset',
      fileSize: 1024,
      uploadStatus: 'completed'
    });

    const event = {
      requestContext: {
        authorizer: {
          tenantId: mockTenantId
        }
      },
      pathParameters: {
        brandId: mockBrandId
      },
      queryStringParameters: {
        category: 'nonexistent-category'
      }
    };

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.assets).toHaveLength(0);
  });

  it('should match assets with any of the specified categories', async () => {
    Brand.findById.mockResolvedValue(JSON.parse(JSON.stringify(mockBrandWithCategorizedAssets)));
    Asset.findById.mockResolvedValue({
      contentType: 'image/png',
      description: 'Test asset',
      fileSize: 1024,
      uploadStatus: 'completed'
    });

    const event = {
      requestContext: {
        authorizer: {
          tenantId: mockTenantId
        }
      },
      pathParameters: {
        brandId: mockBrandId
      },
      queryStringParameters: {
        category: 'brand,social'
      }
    };

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.assets).toHaveLength(2);
    expect(body.assets.map(a => a.assetId || a.url)).toContain('asset_1');
    expect(body.assets.map(a => a.assetId || a.url)).toContain('https://example.com/image.jpg');
  });
});
