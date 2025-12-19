import { UpdateBrandRequestSchema, validateRequestBody, Brand } from '../../models/brand.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import { createStandardizedError, BrandError, BrandErrorCodes } from '../../utils/error-handler.mjs';

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

    const updatedBrand = await Brand.update(tenantId, brandId, updates);

    if (!updatedBrand) {
      throw new BrandError('Brand not found', BrandErrorCodes.NOT_FOUND, 404);
    }

    return formatResponse(200, updatedBrand);
  } catch (error) {
    console.error('Update brand failed:', error);
    return createStandardizedError(error, operation, {
      tenantId: event.requestContext?.authorizer?.tenantId,
      brandId: event.pathParameters?.brandId
    });
  }
};
