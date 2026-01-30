import { BrandSchema, Brand } from '../../models/brand.mjs';
import { logger } from '../../utils/logger.mjs';
import { getBrandDefaults } from '../../utils/defaults.mjs';

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;

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

    const createSchema = BrandSchema.pick({
      name: true,
      ethos: true,
      coreValues: true,
      primaryAudience: true
    }).extend({
      voiceGuidelines: BrandSchema.shape.voiceGuidelines.optional(),
      visualIdentity: BrandSchema.shape.visualIdentity.optional(),
      contentStandards: BrandSchema.shape.contentStandards.optional(),
      platformGuidelines: BrandSchema.shape.platformGuidelines.optional(),
      audienceProfile: BrandSchema.shape.audienceProfile.optional(),
      pillars: BrandSchema.shape.pillars.optional(),
      claimsPolicy: BrandSchema.shape.claimsPolicy.optional(),
      ctaLibrary: BrandSchema.shape.ctaLibrary.optional(),
      approvalPolicy: BrandSchema.shape.approvalPolicy.optional(),
      assets: BrandSchema.shape.assets.optional()
    });

    const requestData = createSchema.parse(JSON.parse(event.body));

    const defaults = getBrandDefaults(requestData.primaryAudience);

    if (requestData.assets && requestData.assets.length > 0) {
      const now = new Date().toISOString();
      const userId = event.requestContext.authorizer.userId || tenantId;

      requestData.assets = requestData.assets.map(asset => ({
        ...asset,
        addedAt: asset.addedAt || now,
        addedBy: asset.addedBy || userId
      }));

      const validation = await Brand.validateAssetAssociations(tenantId, requestData.assets);
      if (!validation.valid) {
        const errorMessage = validation.errors.map(e => `${e.field}: ${e.message}`).join(', ');
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ message: `Asset validation failed: ${errorMessage}` })
        };
      }
    }

    const defaultConfig = Brand.getDefaultBrandConfiguration();

    const brand = {
      ...defaults,
      ...requestData,
      voiceGuidelines: requestData.voiceGuidelines || defaults.voiceGuidelines,
      contentStandards: requestData.contentStandards || defaults.contentStandards,
      visualIdentity: requestData.visualIdentity || defaults.visualIdentity,
      platformGuidelines: requestData.platformGuidelines || defaults.platformGuidelines,
      audienceProfile: requestData.audienceProfile || defaultConfig.audienceProfile,
      claimsPolicy: requestData.claimsPolicy || defaults.claimsPolicy,
      ctaLibrary: requestData.ctaLibrary || defaultConfig.ctaLibrary,
      approvalPolicy: requestData.approvalPolicy || defaults.approvalPolicy
    };

    const savedBrand = await Brand.save(tenantId, brand);

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(savedBrand)
    };
  } catch (error) {
    logger.error('Create brand failed', {
      operation: 'create-brand',
      tenantId: event.requestContext?.authorizer?.tenantId,
      errorName: error.name,
      errorMessage: error.message
    });

    if (error.message.includes('Validation error')) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: error.message })
      };
    }

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
