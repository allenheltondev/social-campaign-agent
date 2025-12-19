import { Brand } from '../../models/brand.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import { createStandardizedError, BrandError, BrandErrorCodes } from '../../utils/error-handler.mjs';

export const handler = async (event) => {
  const operation = 'get-brand';

  try {
    const { tenantId } = event.requestContext.authorizer;
    const { brandId } = event.pathParameters;

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

    return formatResponse(200, brand);
  } catch (error) {
    console.error('Get brand failed:', error);
    return createStandardizedError(error, operation, {
      tenantId: event.requestContext?.authorizer?.tenantId,
      brandId: event.pathParameters?.brandId
    });
  }
};
