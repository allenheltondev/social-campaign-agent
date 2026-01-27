import { Brand } from '../../models/brand.mjs';
import { Asset } from '../../models/asset.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import { createStandardizedError, BrandError, BrandErrorCodes } from '../../utils/error-handler.mjs';
import { brandLogger } from '../../utils/logger.mjs';

export const handler = async (event) => {
  const operation = 'get-brand';

  try {
    const { tenantId } = event.requestContext.authorizer;
    const { brandId } = event.pathParameters;
    const { category } = event.queryStringParameters || {};

    if (!tenantId) {
      throw new BrandError('Unauthorized', BrandErrorCodes.UNAUTHORIZED, 401);
    }

    if (!brandId) {
      throw new BrandError('Missing brandId parameter', BrandErrorCodes.VALIDATION_ERROR, 400);
    }

    const brand = await Brand.findById(tenantId, brandId);

    if (!brand) {
      throw new BrandError('Brand not found', BrandErrorCodes.NOT_FOUND, 404);
    }

    if (brand.assets && brand.assets.length > 0) {
      const enrichedAssets = await Promise.all(
        brand.assets.map(async (asset) => {
          if (asset.type === 'internal') {
            try {
              const assetMetadata = await Asset.findById(tenantId, asset.assetId);
              if (assetMetadata) {
                return {
                  ...asset,
                  metadata: {
                    contentType: assetMetadata.contentType,
                    description: assetMetadata.description,
                    fileSize: assetMetadata.fileSize,
                    uploadStatus: assetMetadata.uploadStatus
                  }
                };
              }
            } catch (error) {
              brandLogger.error('Failed to fetch asset metadata', {
                operation: 'get-brand',
                tenantId,
                brandId,
                assetId: asset.assetId,
                errorMessage: error.message
              });
            }
          }
          return asset;
        })
      );
      brand.assets = enrichedAssets;

      if (category) {
        const categories = category.split(',').map(c => c.trim()).filter(c => c.length > 0);
        if (categories.length > 0) {
          brand.assets = brand.assets.filter(asset => {
            if (!asset.categories || asset.categories.length === 0) {
              return false;
            }
            return categories.some(cat => asset.categories.includes(cat));
          });
        }
      }
    }

    return formatResponse(200, brand);
  } catch (error) {
    brandLogger.error('Get brand operation failed', {
      operation: 'getBrand',
      tenantId: event.requestContext?.authorizer?.tenantId,
      brandId: event.pathParameters?.brandId,
      errorName: error.name,
      errorMessage: error.message
    });
    return createStandardizedError(error, operation, {
      tenantId: event.requestContext?.authorizer?.tenantId,
      brandId: event.pathParameters?.brandId
    });
  }
};
