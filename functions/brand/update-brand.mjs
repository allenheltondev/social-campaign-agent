import { BrandSchema, Brand } from '../../models/brand.mjs';
import { logger } from '../../utils/logger.mjs';

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { brandId } = event.pathParameters;

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

    const updateSchema = BrandSchema.pick({
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
    }).partial();

    const updates = updateSchema.parse(JSON.parse(event.body));

    if (Object.keys(updates).length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'No valid fields to update' })
      };
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
    }

    const updatedBrand = await Brand.update(tenantId, brandId, updates);

    if (!updatedBrand) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Brand not found' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(updatedBrand)
    };
  } catch (error) {
    logger.error('Update brand failed', {
      operation: 'update-brand',
      tenantId: event.requestContext?.authorizer?.tenantId,
      brandId: event.pathParameters?.brandId,
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
