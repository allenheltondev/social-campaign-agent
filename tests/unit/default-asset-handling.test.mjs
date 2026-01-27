import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { AssetPoolBuilder } from '../../utils/asset-pool-builder.mjs';
import { Brand } from '../../models/brand.mjs';
import { Asset } from '../../models/asset.mjs';

vi.mock('@aws-sdk/client-dynamodb');
vi.mock('../../utils/logger.mjs', () => ({
  brandLogger: { error: vi.fn() },
  assetLogger: { error: vi.fn() }
}));

describe('Feature: brand-asset-ux-integration, Property 6: Default Asset Handling', () => {
  describe('**Validates: Requirements 9.1, 9.2, 9.3**', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });
    it('should accept isDefault flag in brand asset associations', async () => {
      const mockBrand = {
        id: 'brand_123',
        assets: [
          { type: 'internal', assetId: 'asset_1', isDefault: true, usageIntent: null, category: null, addedAt: '2024-01-01', addedBy: 'user_1' },
          { type: 'internal', assetId: 'asset_2', isDefault: false, usageIntent: null, category: null, addedAt: '2024-01-01', addedBy: 'user_1' }
        ]
      };

      vi.spyOn(Brand, 'findById').mockResolvedValue(mockBrand);
      vi.spyOn(Asset, 'findById').mockImplementation(async () => ({
        id: 'test-asset',
        description: 'Test asset',
        contentType: 'image/jpeg',
        approvalStatus: 'approved'
      }));

      const assetPool = await AssetPoolBuilder.buildAssetPool('tenant_1', 'brand_123', []);
      const allAssets = [...assetPool.brandDefaults, ...assetPool.campaignSpecific];

      expect(allAssets.length).toBe(2);
      expect(allAssets.filter(a => a.isDefault === true).length).toBe(1);
      expect(allAssets.filter(a => a.isDefault === false).length).toBe(1);
    });

    it('should automatically include default assets in all campaigns for a brand', async () => {
      const mockBrand = {
        id: 'brand_123',
        assets: [
          { type: 'internal', assetId: 'asset_1', isDefault: true, usageIntent: null, category: null, addedAt: '2024-01-01', addedBy: 'user_1' },
          { type: 'internal', assetId: 'asset_2', isDefault: false, usageIntent: null, category: null, addedAt: '2024-01-01', addedBy: 'user_1' }
        ]
      };

      vi.spyOn(Brand, 'findById').mockResolvedValue(mockBrand);
      vi.spyOn(Asset, 'findById').mockImplementation(async () => ({
        id: 'test-asset',
        description: 'Test asset',
        contentType: 'image/jpeg',
        approvalStatus: 'approved'
      }));

      const assetPool = await AssetPoolBuilder.buildAssetPool('tenant_1', 'brand_123', []);
      const defaultAssets = AssetPoolBuilder.getDefaultAssets(assetPool);

      expect(defaultAssets.length).toBe(1);
      expect(defaultAssets[0].isDefault).toBe(true);
      expect(defaultAssets[0].source).toBe('brand');
    });

    it('should mark default assets as required in planning context', async () => {
      const mockBrand = {
        id: 'brand_123',
        assets: [
          { type: 'internal', assetId: 'asset_1', isDefault: true, usageIntent: null, category: null, addedAt: '2024-01-01', addedBy: 'user_1' }
        ]
      };

      vi.spyOn(Brand, 'findById').mockResolvedValue(mockBrand);
      vi.spyOn(Asset, 'findById').mockImplementation(async () => ({
        id: 'test-asset',
        description: 'Test asset',
        contentType: 'image/jpeg',
        approvalStatus: 'approved'
      }));

      const assetPool = await AssetPoolBuilder.buildAssetPool('tenant_1', 'brand_123', []);
      const planningContext = AssetPoolBuilder.buildPlanningContext(assetPool);

      expect(planningContext.hasDefaultAssets).toBe(true);
      expect(planningContext.defaultAssets.length).toBe(1);
      expect(planningContext.defaultAssets[0].required).toBe(true);
      expect(planningContext.defaultAssets[0].isDefault).toBe(true);
    });

    it('should preserve default asset flag through asset pool construction', () => {
      const assetPool = {
        brandDefaults: [
          { source: 'brand', isDefault: true },
          { source: 'brand', isDefault: false }
        ],
        campaignSpecific: [
          { source: 'campaign', isDefault: false }
        ]
      };

      const defaultAssets = AssetPoolBuilder.getDefaultAssets(assetPool);
      expect(defaultAssets.length).toBe(1);
      expect(defaultAssets[0].isDefault).toBe(true);
    });

    it('should calculate default asset count correctly in stats', () => {
      const assetPool = {
        brandDefaults: [
          { source: 'brand', isDefault: true },
          { source: 'brand', isDefault: false }
        ],
        campaignSpecific: [
          { source: 'campaign', isDefault: false }
        ]
      };

      const stats = AssetPoolBuilder.calculateAssetPoolStats(assetPool);
      expect(stats.defaultAssets).toBe(1);
    });

    it('should handle brands with no default assets', async () => {
      const mockBrand = {
        id: 'brand_123',
        assets: [
          { type: 'internal', assetId: 'asset_1', isDefault: false, usageIntent: null, category: null, addedAt: '2024-01-01', addedBy: 'user_1' }
        ]
      };

      vi.spyOn(Brand, 'findById').mockResolvedValue(mockBrand);
      vi.spyOn(Asset, 'findById').mockImplementation(async () => ({
        id: 'test-asset',
        description: 'Test asset',
        contentType: 'image/jpeg',
        approvalStatus: 'approved'
      }));

      const assetPool = await AssetPoolBuilder.buildAssetPool('tenant_1', 'brand_123', []);
      const planningContext = AssetPoolBuilder.buildPlanningContext(assetPool);

      expect(planningContext.hasDefaultAssets).toBe(false);
      expect(planningContext.defaultAssets.length).toBe(0);
    });

    it('should mark default assets with requirement reason', async () => {
      const mockBrand = {
        id: 'brand_123',
        assets: [
          { type: 'internal', assetId: 'asset_1', isDefault: true, usageIntent: null, category: null, addedAt: '2024-01-01', addedBy: 'user_1' }
        ]
      };

      vi.spyOn(Brand, 'findById').mockResolvedValue(mockBrand);
      vi.spyOn(Asset, 'findById').mockImplementation(async () => ({
        id: 'test-asset',
        description: 'Test asset',
        contentType: 'image/jpeg',
        approvalStatus: 'approved'
      }));

      const assetPool = await AssetPoolBuilder.buildAssetPool('tenant_1', 'brand_123', []);
      const requiredAssets = AssetPoolBuilder.markDefaultAssetsAsRequired(assetPool);

      expect(requiredAssets.length).toBe(1);
      expect(requiredAssets[0].required).toBe(true);
      expect(requiredAssets[0].requirementReason).toBeTruthy();
      expect(typeof requiredAssets[0].requirementReason).toBe('string');
    });
  });
});
