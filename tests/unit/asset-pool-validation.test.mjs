import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssetPoolBuilder } from '../../utils/asset-pool-builder.mjs';
import { Brand } from '../../models/brand.mjs';
import { Asset } from '../../models/asset.mjs';

vi.mock('@aws-sdk/client-dynamodb');
vi.mock('../../utils/logger.mjs', () => ({
  brandLogger: { error: vi.fn() },
  assetLogger: { error: vi.fn() }
}));

describe('Asset Pool Validation', () => {
  const tenantId = 'tenant_123';
  const brandId = 'brand_456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Brand validation', () => {
    it('should return error when brand does not exist', async () => {
      vi.spyOn(Brand, 'findById').mockResolvedValue(null);

      const result = await AssetPoolBuilder.validateAssetPool(tenantId, brandId, []);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('brandId');
      expect(result.errors[0].message).toContain('not found');
    });

    it('should validate brand assets when brand exists', async () => {
      vi.spyOn(Brand, 'findById').mockResolvedValue({
        id: brandId,
        assets: [
          {
            type: 'internal',
            assetId: 'asset_789'
          }
        ]
      });

      vi.spyOn(Asset, 'findById').mockResolvedValue(null);

      const result = await AssetPoolBuilder.validateAssetPool(tenantId, brandId, []);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('brandAssets[0].assetId');
      expect(result.errors[0].message).toContain('not found');
    });

    it('should pass validation when brand has valid assets', async () => {
      vi.spyOn(Brand, 'findById').mockResolvedValue({
        id: brandId,
        assets: [
          {
            type: 'internal',
            assetId: 'asset_789'
          },
          {
            type: 'external',
            url: 'https://example.com/image.jpg',
            description: 'A valid external asset description',
            contentType: 'image/jpeg'
          }
        ]
      });

      vi.spyOn(Asset, 'findById').mockResolvedValue({
        id: 'asset_789',
        description: 'Internal asset',
        contentType: 'image/jpeg'
      });

      const result = await AssetPoolBuilder.validateAssetPool(tenantId, brandId, []);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Internal asset validation', () => {
    it('should return error when internal asset does not exist', async () => {
      vi.spyOn(Asset, 'findById').mockResolvedValue(null);

      const campaignAssets = [
        {
          type: 'internal',
          assetId: 'asset_nonexistent'
        }
      ];

      const result = await AssetPoolBuilder.validateAssetPool(tenantId, null, campaignAssets);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('campaignAssets[0].assetId');
      expect(result.errors[0].message).toContain('not found');
    });

    it('should pass validation when internal asset exists', async () => {
      vi.spyOn(Asset, 'findById').mockResolvedValue({
        id: 'asset_123',
        description: 'Valid asset',
        contentType: 'image/jpeg'
      });

      const campaignAssets = [
        {
          type: 'internal',
          assetId: 'asset_123'
        }
      ];

      const result = await AssetPoolBuilder.validateAssetPool(tenantId, null, campaignAssets);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('External asset validation', () => {
    it('should return error when external URL is not HTTPS', async () => {
      const campaignAssets = [
        {
          type: 'external',
          url: 'http://example.com/image.jpg',
          description: 'Valid description here',
          contentType: 'image/jpeg'
        }
      ];

      const result = await AssetPoolBuilder.validateAssetPool(tenantId, null, campaignAssets);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('campaignAssets[0].url');
      expect(result.errors[0].message).toContain('HTTPS');
    });

    it('should return error when description is too short', async () => {
      const campaignAssets = [
        {
          type: 'external',
          url: 'https://example.com/image.jpg',
          description: 'Short',
          contentType: 'image/jpeg'
        }
      ];

      const result = await AssetPoolBuilder.validateAssetPool(tenantId, null, campaignAssets);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('campaignAssets[0].description');
      expect(result.errors[0].message).toContain('at least 10 characters');
    });

    it('should return error when contentType is missing', async () => {
      const campaignAssets = [
        {
          type: 'external',
          url: 'https://example.com/image.jpg',
          description: 'Valid description here'
        }
      ];

      const result = await AssetPoolBuilder.validateAssetPool(tenantId, null, campaignAssets);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('campaignAssets[0].contentType');
      expect(result.errors[0].message).toContain('required');
    });

    it('should pass validation with valid external asset', async () => {
      const campaignAssets = [
        {
          type: 'external',
          url: 'https://example.com/image.jpg',
          description: 'This is a valid description with enough characters',
          contentType: 'image/jpeg'
        }
      ];

      const result = await AssetPoolBuilder.validateAssetPool(tenantId, null, campaignAssets);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Multiple validation errors', () => {
    it('should return all validation errors', async () => {
      vi.spyOn(Asset, 'findById').mockResolvedValue(null);

      const campaignAssets = [
        {
          type: 'internal',
          assetId: 'asset_missing'
        },
        {
          type: 'external',
          url: 'http://example.com/image.jpg',
          description: 'Short',
          contentType: 'image/jpeg'
        },
        {
          type: 'external',
          url: 'https://example.com/video.mp4',
          description: 'Valid description here'
        }
      ];

      const result = await AssetPoolBuilder.validateAssetPool(tenantId, null, campaignAssets);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('Graceful error handling', () => {
    it('should handle missing or invalid assets gracefully', async () => {
      vi.spyOn(Asset, 'findById').mockResolvedValue(null);

      const campaignAssets = [
        {
          type: 'internal',
          assetId: 'asset_missing1'
        },
        {
          type: 'internal',
          assetId: 'asset_missing2'
        }
      ];

      const result = await AssetPoolBuilder.validateAssetPool(tenantId, null, campaignAssets);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      result.errors.forEach(error => {
        expect(error).toHaveProperty('field');
        expect(error).toHaveProperty('message');
        expect(error.message).toBeTruthy();
      });
    });

    it('should provide actionable error messages', async () => {
      const campaignAssets = [
        {
          type: 'external',
          url: 'http://example.com/image.jpg',
          description: 'Too short',
          contentType: 'image/jpeg'
        }
      ];

      const result = await AssetPoolBuilder.validateAssetPool(tenantId, null, campaignAssets);

      expect(result.valid).toBe(false);
      result.errors.forEach(error => {
        expect(error.message.length).toBeGreaterThan(10);
        expect(error.message).not.toContain('undefined');
        expect(error.message).not.toContain('null');
      });
    });
  });
});
