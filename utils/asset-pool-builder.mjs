import { Brand } from '../models/brand.mjs';
import { Asset } from '../models/asset.mjs';

export class AssetPoolBuilder {
  static async buildAssetPool(tenantId, brandId, campaignSpecificAssets = []) {
    const brandAssets = brandId ? await this._getBrandAssets(tenantId, brandId) : [];
    const campaignAssets = await this._processCampaignAssets(tenantId, campaignSpecificAssets);

    const allAssets = [...brandAssets, ...campaignAssets];
    const approvedAssets = this._filterApprovedAssets(allAssets);

    return {
      brandDefaults: approvedAssets.filter(a => a.source === 'brand'),
      campaignSpecific: approvedAssets.filter(a => a.source === 'campaign')
    };
  }

  static async _getBrandAssets(tenantId, brandId) {
    const brand = await Brand.findById(tenantId, brandId);

    if (!brand || !brand.assets || brand.assets.length === 0) {
      return [];
    }

    const brandAssets = [];

    for (const assetAssociation of brand.assets) {
      if (assetAssociation.type === 'internal') {
        const asset = await Asset.findById(tenantId, assetAssociation.assetId);

        if (asset) {
          brandAssets.push({
            type: 'internal',
            assetId: asset.id,
            url: null,
            description: asset.description,
            contentType: asset.contentType,
            usageIntent: assetAssociation.usageIntent,
            isDefault: assetAssociation.isDefault || false,
            category: assetAssociation.category,
            source: 'brand',
            approvalStatus: asset.approvalStatus
          });
        }
      } else if (assetAssociation.type === 'external') {
        brandAssets.push({
          type: 'external',
          assetId: null,
          url: assetAssociation.url,
          description: assetAssociation.description,
          contentType: assetAssociation.contentType,
          usageIntent: assetAssociation.usageIntent,
          isDefault: assetAssociation.isDefault || false,
          category: assetAssociation.category,
          source: 'brand',
          approvalStatus: 'approved'
        });
      }
    }

    return brandAssets;
  }

  static async _processCampaignAssets(tenantId, campaignSpecificAssets) {
    if (!campaignSpecificAssets || campaignSpecificAssets.length === 0) {
      return [];
    }

    const campaignAssets = [];

    for (const assetRef of campaignSpecificAssets) {
      if (assetRef.type === 'internal') {
        const asset = await Asset.findById(tenantId, assetRef.assetId);

        if (asset) {
          campaignAssets.push({
            type: 'internal',
            assetId: asset.id,
            url: null,
            description: asset.description,
            contentType: asset.contentType,
            usageIntent: null,
            isDefault: false,
            category: null,
            source: 'campaign',
            approvalStatus: asset.approvalStatus
          });
        }
      } else if (assetRef.type === 'external') {
        campaignAssets.push({
          type: 'external',
          assetId: null,
          url: assetRef.url,
          description: assetRef.description,
          contentType: assetRef.contentType,
          usageIntent: null,
          isDefault: false,
          category: null,
          source: 'campaign',
          approvalStatus: 'approved'
        });
      }
    }

    return campaignAssets;
  }

  static _filterApprovedAssets(assets) {
    return assets.filter(asset => asset.approvalStatus === 'approved');
  }

  static async validateAssetPool(tenantId, brandId, campaignSpecificAssets = []) {
    const errors = [];

    if (brandId) {
      const brand = await Brand.findById(tenantId, brandId);
      if (!brand) {
        errors.push({
          field: 'brandId',
          message: `Brand ${brandId} not found`
        });
        return {
          valid: false,
          errors
        };
      }

      if (brand.assets && brand.assets.length > 0) {
        for (let i = 0; i < brand.assets.length; i++) {
          const assetRef = brand.assets[i];

          if (assetRef.type === 'internal') {
            const asset = await Asset.findById(tenantId, assetRef.assetId);
            if (!asset) {
              errors.push({
                field: `brandAssets[${i}].assetId`,
                message: `Brand asset ${assetRef.assetId} not found`
              });
            }
          } else if (assetRef.type === 'external') {
            if (!assetRef.url || !assetRef.url.startsWith('https://')) {
              errors.push({
                field: `brandAssets[${i}].url`,
                message: 'External asset URLs must use HTTPS protocol'
              });
            }

            if (!assetRef.description || assetRef.description.length < 10) {
              errors.push({
                field: `brandAssets[${i}].description`,
                message: 'External asset description must be at least 10 characters'
              });
            }

            if (!assetRef.contentType) {
              errors.push({
                field: `brandAssets[${i}].contentType`,
                message: 'External asset contentType is required'
              });
            }
          }
        }
      }
    }

    for (let i = 0; i < campaignSpecificAssets.length; i++) {
      const assetRef = campaignSpecificAssets[i];

      if (assetRef.type === 'internal') {
        const asset = await Asset.findById(tenantId, assetRef.assetId);
        if (!asset) {
          errors.push({
            field: `campaignAssets[${i}].assetId`,
            message: `Asset ${assetRef.assetId} not found`
          });
        }
      } else if (assetRef.type === 'external') {
        if (!assetRef.url || !assetRef.url.startsWith('https://')) {
          errors.push({
            field: `campaignAssets[${i}].url`,
            message: 'External asset URLs must use HTTPS protocol'
          });
        }

        if (!assetRef.description || assetRef.description.length < 10) {
          errors.push({
            field: `campaignAssets[${i}].description`,
            message: 'External asset description must be at least 10 characters'
          });
        }

        if (!assetRef.contentType) {
          errors.push({
            field: `campaignAssets[${i}].contentType`,
            message: 'External asset contentType is required'
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static getDefaultAssets(assetPool) {
    const allAssets = [...assetPool.brandDefaults, ...assetPool.campaignSpecific];
    return allAssets.filter(asset => asset.isDefault === true);
  }

  static markDefaultAssetsAsRequired(assetPool) {
    const defaultAssets = this.getDefaultAssets(assetPool);

    return defaultAssets.map(asset => ({
      ...asset,
      required: true,
      requirementReason: 'Brand default asset must be included in campaign'
    }));
  }

  static buildPlanningContext(assetPool) {
    const allAssets = [...assetPool.brandDefaults, ...assetPool.campaignSpecific];
    const defaultAssets = this.getDefaultAssets(assetPool);

    return {
      availableAssets: allAssets,
      defaultAssets: defaultAssets.map(asset => ({
        ...asset,
        required: true
      })),
      totalAssets: allAssets.length,
      hasDefaultAssets: defaultAssets.length > 0
    };
  }

  static calculateAssetPoolStats(assetPool) {
    const brandAssets = assetPool.brandDefaults || [];
    const campaignAssets = assetPool.campaignSpecific || [];
    const allAssets = [...brandAssets, ...campaignAssets];

    return {
      totalAssets: allAssets.length,
      brandAssets: brandAssets.length,
      campaignAssets: campaignAssets.length,
      defaultAssets: allAssets.filter(a => a.isDefault === true).length
    };
  }
}
