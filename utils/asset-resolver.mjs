import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Asset } from '../models/asset.mjs';
import { utilLogger } from './logger.mjs';

const s3Client = new S3Client();

export class AssetResolver {
  static async resolveAssetAccess(tenantId, asset) {
    try {
      if (asset.type === 'internal') {
        const internalAsset = await Asset.findById(tenantId, asset.assetId);

        if (!internalAsset) {
          throw new Error(`Internal asset ${asset.assetId} not found`);
        }

        if (internalAsset.uploadStatus !== 'completed') {
          throw new Error(`Internal asset ${asset.assetId} upload not completed`);
        }

        const accessUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.ASSETS_BUCKET,
            Key: internalAsset.objectKey
          }),
          { expiresIn: 900 }
        );

        return {
          type: 'internal',
          assetId: asset.assetId,
          accessUrl,
          description: internalAsset.description,
          contentType: internalAsset.contentType,
          fileSize: internalAsset.fileSize,
          available: true
        };
      } else if (asset.type === 'external') {
        return {
          type: 'external',
          accessUrl: asset.url,
          description: asset.description,
          contentType: asset.contentType,
          available: true
        };
      } else {
        throw new Error(`Unsupported asset type: ${asset.type}`);
      }
    } catch (error) {
      utilLogger.error('Asset resolution failed', {
        operation: 'resolveAssetAccess',
        tenantId,
        assetType: asset.type,
        assetId: asset.assetId || 'external',
        errorName: error.name,
        errorMessage: error.message
      });

      return {
        type: asset.type,
        assetId: asset.assetId || null,
        accessUrl: null,
        description: asset.description || null,
        contentType: asset.contentType || null,
        available: false,
        error: error.message
      };
    }
  }

  static async resolveMultipleAssets(tenantId, assets) {
    if (!assets || assets.length === 0) {
      return [];
    }

    const resolvedAssets = await Promise.all(
      assets.map(asset => this.resolveAssetAccess(tenantId, asset))
    );

    return resolvedAssets;
  }

  static async validateAssetAvailability(tenantId, assets) {
    if (!assets || assets.length === 0) {
      return { available: true, unavailableAssets: [] };
    }

    const resolvedAssets = await this.resolveMultipleAssets(tenantId, assets);
    const unavailableAssets = resolvedAssets.filter(asset => !asset.available);

    return {
      available: unavailableAssets.length === 0,
      unavailableAssets: unavailableAssets.map(asset => ({
        type: asset.type,
        assetId: asset.assetId,
        error: asset.error
      }))
    };
  }

  static async getAssetMetadata(tenantId, asset) {
    try {
      if (asset.type === 'internal') {
        const internalAsset = await Asset.findById(tenantId, asset.assetId);

        if (!internalAsset) {
          return null;
        }

        return {
          type: 'internal',
          assetId: asset.assetId,
          description: internalAsset.description,
          contentType: internalAsset.contentType,
          fileSize: internalAsset.fileSize,
          uploadStatus: internalAsset.uploadStatus,
          usageStats: internalAsset.usageStats,
          createdAt: internalAsset.createdAt
        };
      } else if (asset.type === 'external') {
        return {
          type: 'external',
          url: asset.url,
          description: asset.description,
          contentType: asset.contentType,
          addedAt: asset.addedAt
        };
      }

      return null;
    } catch (error) {
      utilLogger.error('Asset metadata retrieval failed', {
        operation: 'getAssetMetadata',
        tenantId,
        assetType: asset.type,
        assetId: asset.assetId || 'external',
        errorName: error.name,
        errorMessage: error.message
      });
      return null;
    }
  }

  static async trackAssetUtilization(tenantId, asset, campaignId = null, postId = null) {
    try {
      if (asset.type === 'internal') {
        await Asset.updateUsageStats(tenantId, asset.assetId, campaignId, postId);

        return {
          success: true,
          assetId: asset.assetId,
          tracked: {
            campaignId,
            postId,
            trackedAt: new Date().toISOString()
          }
        };
      } else if (asset.type === 'external') {
        return {
          success: true,
          assetId: null,
          tracked: {
            campaignId,
            postId,
            trackedAt: new Date().toISOString(),
            note: 'External asset utilization tracked in campaign context only'
          }
        };
      }

      return { success: false, error: 'Unsupported asset type' };
    } catch (error) {
      utilLogger.error('Asset utilization tracking failed', {
        operation: 'trackAssetUtilization',
        tenantId,
        assetType: asset.type,
        assetId: asset.assetId || 'external',
        campaignId,
        postId,
        errorName: error.name,
        errorMessage: error.message
      });

      return {
        success: false,
        error: error.message,
        assetId: asset.assetId || null
      };
    }
  }

  static async trackMultipleAssetUtilization(tenantId, assets, campaignId = null, postId = null) {
    if (!assets || assets.length === 0) {
      return [];
    }

    const trackingResults = await Promise.all(
      assets.map(asset => this.trackAssetUtilization(tenantId, asset, campaignId, postId))
    );

    return trackingResults;
  }

  static async generateUtilizationReport(tenantId, assets) {
    if (!assets || assets.length === 0) {
      return {
        totalAssets: 0,
        internalAssets: 0,
        externalAssets: 0,
        utilizationSummary: {
          totalCampaigns: 0,
          totalPosts: 0,
          averageUsagePerAsset: 0
        }
      };
    }

    const assetMetadata = await Promise.all(
      assets.map(asset => this.getAssetMetadata(tenantId, asset))
    );

    const validMetadata = assetMetadata.filter(meta => meta !== null);
    const internalAssets = validMetadata.filter(meta => meta.type === 'internal');
    const externalAssets = validMetadata.filter(meta => meta.type === 'external');

    const totalCampaigns = internalAssets.reduce((sum, asset) =>
      sum + (asset.usageStats?.totalCampaigns || 0), 0);
    const totalPosts = internalAssets.reduce((sum, asset) =>
      sum + (asset.usageStats?.totalPosts || 0), 0);

    return {
      totalAssets: validMetadata.length,
      internalAssets: internalAssets.length,
      externalAssets: externalAssets.length,
      utilizationSummary: {
        totalCampaigns,
        totalPosts,
        averageUsagePerAsset: internalAssets.length > 0 ?
          Math.round((totalCampaigns + totalPosts) / internalAssets.length * 100) / 100 : 0
      },
      underutilizedAssets: internalAssets.filter(asset =>
        (asset.usageStats?.totalCampaigns || 0) === 0 &&
        (asset.usageStats?.totalPosts || 0) === 0
      ).map(asset => ({
        assetId: asset.assetId,
        description: asset.description,
        contentType: asset.contentType,
        createdAt: asset.createdAt
      }))
    };
  }
}
