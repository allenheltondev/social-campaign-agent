import { Brand } from '../../models/brand.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import { createStandardizedError, BrandError, BrandErrorCodes } from '../../utils/error-handler.mjs';

export const handler = async (event) => {
  const operation = 'list-brands';

  try {
    const { tenantId } = event.requestContext.authorizer;
    const { search, nextToken, status } = event.queryStringParameters || {};

    if (!tenantId) {
      throw new BrandError('Tenant ID is required', BrandErrorCodes.VALIDATION_ERROR, 400);
    }

    const brandListResponse = await Brand.list(tenantId, {
      search,
      limit: parseInt(event.queryStringParameters?.limit || '20'),
      nextToken,
      status
    });

    const response = {
      brands: brandListResponse.items,
      ...brandListResponse.pagination
    };

    return formatResponse(200, response);

  } catch (error) {
    return createStandardizedError(error, operation, {
      tenantId: event.requestContext?.authorizer?.tenantId
    });
  }
};
