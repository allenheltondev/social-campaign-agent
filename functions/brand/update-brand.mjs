import { UpdateBrandRequestSchema, validateRequestBody, Brand } from '../../models/brand.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import { createStandardizedError, BrandError, BrandErrorCodes } from '../../utils/error-handler.mjs';
import { brandLogger } from '../../utils/logger.mjs';

export const handler = async (event) => {
  const operation = 'update-brand';

  try {
    const { tenantId } = event.requestContext.authorizer;
    const { brandId } = event.pathParameters;

    if (!tenantId) {
      throw new BrandError('Unauthorized', BrandErrorCodes.UNAUTHORIZED, 401);
    }

    if (!brandId) {
      throw new BrandError('Missing brandId parameter', BrandErrorCodes.VALIDATION_ERROR, 400);
    }

    const updates = validateRequestBody(UpdateBrandRequestSchema, event.body);

    if (Object.keys(updates).length === 0) {
      throw new BrandError('No valid fields to update', BrandErrorCodes.VALIDATION_ERROR, 400);
    }

    if (updates.assets !== undefined) {
      if (updates.assets && updates.assets.length > 0) {
        const now = new Date().toISOString();
        const userId = event.requestContext.authorizer.userId || tenantId;

        updates.assets = updates.assets.map(asset => ({
          ...asset,
          addedAt: asset.addedAt || now,
          addedBy: asset.addedBy || userId
        }));

        const validation = await Brand.validateAssetAssociations(tenantId, updates.assets);
        if (!validation.valid) {
          const errorMessage = validation.errors.map(e => `${e.field}: ${e.message}`).join(', ');
          throw new BrandError(`Asset validation failed: ${errorMessage}`, BrandErrorCodes.VALIDATION_ERROR, 400);
        }
      }
    }

    const updatedBrand = await Brand.update(tenantId, brandId, updates);

    if (!updatedBrand) {
      throw new BrandError('Brand not found', BrandErrorCodes.NOT_FOUND, 404);
    }

    return formatResponse(200, updatedBrand);
  } catch (error) {
    brandLogger.error('Update brand failed', {
      operation: 'update-brand',
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
