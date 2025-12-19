import { CreateBrandRequestSchema, validateRequestBody } from '../../models/brand.mjs';
import { Brand } from '../../models/brand.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import { createStandardizedError, BrandError, BrandErrorCodes } from '../../utils/error-handler.mjs';

export const handler = async (event) => {
  const operation = 'create-brand';

  try {
    const { tenantId } = event.requestContext.authorizer;

    if (!tenantId) {
      throw new BrandError('Unauthorized', BrandErrorCodes.UNAUTHORIZED, 401);
    }

    const requestData = validateRequestBody(CreateBrandRequestSchema, event.body);

    const defaultConfig = Brand.getDefaultBrandConfiguration();

    const brand = {
      ...requestData,
      platformGuidelines: requestData.platformGuidelines || defaultConfig.platformGuidelines,
      audienceProfile: requestData.audienceProfile || defaultConfig.audienceProfile,
      claimsPolicy: requestData.claimsPolicy || defaultConfig.claimsPolicy,
      ctaLibrary: requestData.ctaLibrary || defaultConfig.ctaLibrary,
      approvalPolicy: requestData.approvalPolicy || defaultConfig.approvalPolicy
    };

    const savedBrand = await Brand.save(tenantId, brand);

    return formatResponse(201, savedBrand);
  } catch (error) {
    console.error('Create brand failed:', error);
    return createStandardizedError(error, operation, {
      tenantId: event.requestContext?.authorizer?.tenantId
    });
  }
};
