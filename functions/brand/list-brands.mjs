import { Brand } from '../../models/brand.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import { createStandardizedError, BrandError, BrandErrorCodes } from '../../utils/error-handler.mjs';

export const handler = async (event) => {
  const operation = 'list-brands';

  try {
    const { tenantId } = event.requestContext.authorizer;
    const { search, limit = 20, nextToken, status } = event.queryStringParameters || {};

    if (!tenantId) {
      throw new BrandError('Tenant ID is required', BrandErrorCodes.VALIDATION_ERROR, 400);
    }

    const result = await Brand.list(tenantId, {
      search,
      limit: parseInt(limit),
      nextToken,
      status
    });

    const response = {
      brands: result.items,
      ...result.pagination
    };

    return formatResponse(200, response);

  } catch (error) {
    return createStandardizedError(error, operation, {
      tenantId: event.requestContext?.authorizer?.tenantId
    });
  }
};
