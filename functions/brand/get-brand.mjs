import { Brand } from '../../models/brand.mjs';
import { Asset } from '../../models/asset.mjs';
import { logger } from '../../utils/logger.mjs';

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { brandId } = event.pathParameters;
    const { category } = event.queryStringParameters || {};

    if (!tenantId) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Unauthorized' })
      };
    }

    if (!brandId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Missing brandId parameter' })
      };
    }

    const brand = await Brand.findById(tenantId, brandId);

    if (!brand) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Brand not found' })
      };
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
              logger.error('Failed to fetch asset metadata', {
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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(brand)
    };
  } catch (error) {
    logger.error('Get brand operation failed', {
      operation: 'getBrand',
      tenantId: event.requestContext?.authorizer?.tenantId,
      brandId: event.pathParameters?.brandId,
      errorName: error.name,
      errorMessage: error.message
    });
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};
