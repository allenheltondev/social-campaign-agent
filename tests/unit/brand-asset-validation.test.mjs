import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Brand } from '../../models/brand.mjs';
import { Asset } from '../../models/asset.mjs';

vi.mock('@aws-sdk/client-dynamodb');
vi.mock('../../utils/logger.mjs', () => ({
  brandLogger: { error: vi.fn() },
  assetLogger: { error: vi.fn() }
}));

describe('Brand Asset Validation', () => {
  const tenantId = 'tenant_123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate that internal asset exists', async () => {
    const mockAsset = {
      id: 'asset_123',
      type: 'internal',
      contentType: 'image/jpeg',
      description: 'Test asset description'
    };

    vi.spyOn(Asset, 'findById').mockResolvedValue(mockAsset);

    const assets = [{
      type: 'internal',
      assetId: 'asset_123',
      usageIntent: null,
      isDefault: false,
      category: null,
      addedAt: new Date().toISOString(),
      addedBy: 'user_123'
    }];

    const validation = await Brand.validateAssetAssociations(tenantId, assets);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
    expect(Asset.findById).toHaveBeenCalledWith(tenantId, 'asset_123');
  });

  it('should reject internal asset that does not exist', async () => {
    vi.spyOn(Asset, 'findById').mockResolvedValue(null);

    const assets = [{
      type: 'internal',
      assetId: 'asset_nonexistent',
      usageIntent: null,
      isDefault: false,
      category: null,
      addedAt: new Date().toISOString(),
      addedBy: 'user_123'
    }];

    const validation = await Brand.validateAssetAssociations(tenantId, assets);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toHaveLength(1);
    expect(validation.errors[0].field).toBe('assets[0].assetId');
    expect(validation.errors[0].message).toContain('does not exist');
  });

  it('should accept external asset with HTTPS URL', async () => {
    const assets = [{
      type: 'external',
      url: 'https://example.com/image.jpg',
      description: 'External asset description',
      contentType: 'image/jpeg',
      usageIntent: null,
      isDefault: false,
      category: null,
      addedAt: new Date().toISOString(),
      addedBy: 'user_123'
    }];

    const validation = await Brand.validateAssetAssociations(tenantId, assets);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should reject external asset with HTTP URL', async () => {
    const assets = [{
      type: 'external',
      url: 'http://example.com/image.jpg',
      description: 'External asset description',
      contentType: 'image/jpeg',
      usageIntent: null,
      isDefault: false,
      category: null,
      addedAt: new Date().toISOString(),
      addedBy: 'user_123'
    }];

    const validation = await Brand.validateAssetAssociations(tenantId, assets);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toHaveLength(1);
    expect(validation.errors[0].field).toBe('assets[0].url');
    expect(validation.errors[0].message).toContain('HTTPS');
  });

  it('should reject external asset without content type', async () => {
    const assets = [{
      type: 'external',
      url: 'https://example.com/image.jpg',
      description: 'External asset description',
      contentType: null,
      usageIntent: null,
      isDefault: false,
      category: null,
      addedAt: new Date().toISOString(),
      addedBy: 'user_123'
    }];

    const validation = await Brand.validateAssetAssociations(tenantId, assets);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toHaveLength(1);
    expect(validation.errors[0].field).toBe('assets[0].contentType');
    expect(validation.errors[0].message).toContain('required');
  });

  it('should reject external asset with short description', async () => {
    const assets = [{
      type: 'external',
      url: 'https://example.com/image.jpg',
      description: 'Short',
      contentType: 'image/jpeg',
      usageIntent: null,
      isDefault: false,
      category: null,
      addedAt: new Date().toISOString(),
      addedBy: 'user_123'
    }];

    const validation = await Brand.validateAssetAssociations(tenantId, assets);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toHaveLength(1);
    expect(validation.errors[0].field).toBe('assets[0].description');
    expect(validation.errors[0].message).toContain('at least 10 characters');
  });

  it('should reject external asset with long description', async () => {
    const longDescription = 'a'.repeat(501);
    const assets = [{
      type: 'external',
      url: 'https://example.com/image.jpg',
      description: longDescription,
      contentType: 'image/jpeg',
      usageIntent: null,
      isDefault: false,
      category: null,
      addedAt: new Date().toISOString(),
      addedBy: 'user_123'
    }];

    const validation = await Brand.validateAssetAssociations(tenantId, assets);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toHaveLength(1);
    expect(validation.errors[0].field).toBe('assets[0].description');
    expect(validation.errors[0].message).toContain('not exceed 500 characters');
  });

  it('should return valid for empty asset array', async () => {
    const validation = await Brand.validateAssetAssociations(tenantId, []);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});
