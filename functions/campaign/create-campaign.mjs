import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { CreateCampaignRequestSchema, validateRequestBody, generateCampaignId } from '../../models/campaign.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import { campaignLogger } from '../../utils/logger.mjs';
import { AssetPoolBuilder } from '../../utils/asset-pool-builder.mjs';

const lambda = new LambdaClient();

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;

    if (!tenantId) {
      return formatResponse(401, { message: 'Unauthorized' });
    }

    const requestData = validateRequestBody(CreateCampaignRequestSchema, event.body);

    const assetPool = await AssetPoolBuilder.buildAssetPool(
      tenantId,
      requestData.brandId || null,
      requestData.assets || []
    );

    const assetPoolStats = AssetPoolBuilder.calculateAssetPoolStats(assetPool);

    if (requestData.previewAssets) {
      return formatResponse(200, {
        assetPool: {
          brandDefaults: assetPool.brandDefaults.map(asset => ({
            type: asset.type,
            assetId: asset.assetId,
            url: asset.url,
            description: asset.description,
            contentType: asset.contentType,
            usageIntent: asset.usageIntent,
            isDefault: asset.isDefault,
            category: asset.category,
            source: asset.source
          })),
          campaignSpecific: assetPool.campaignSpecific.map(asset => ({
            type: asset.type,
            assetId: asset.assetId,
            url: asset.url,
            description: asset.description,
            contentType: asset.contentType,
            usageIntent: asset.usageIntent,
            isDefault: asset.isDefault,
            category: asset.category,
            source: asset.source
          }))
        },
        assetPoolStats,
        message: 'Asset pool preview generated. Submit without previewAssets to create campaign.'
      });
    }

    const campaignId = generateCampaignId();

    const campaign = {
      id: campaignId,
      name: requestData.name,
      brief: requestData.brief,
      participants: {
        ...requestData.participants,
        distribution: requestData.participants.distribution || { mode: 'balanced' }
      },
      schedule: requestData.schedule
    };

    if (requestData.brandId) {
      campaign.brandId = requestData.brandId;
    }

    if (requestData.cadenceOverrides) {
      campaign.cadenceOverrides = requestData.cadenceOverrides;
    }

    if (requestData.messaging) {
      campaign.messaging = requestData.messaging;
    }

    if (requestData.assetOverrides) {
      campaign.assetOverrides = requestData.assetOverrides;
    }

    if (requestData.assets) {
      campaign.assets = requestData.assets;
    }

    if (requestData.metadata) {
      campaign.metadata = requestData.metadata;
    } else {
      campaign.metadata = { source: 'api' };
    }

    campaign.assetPool = assetPool;
    campaign.assetPoolStats = assetPoolStats;

    await lambda.send(new InvokeCommand({
      FunctionName: `${process.env.BUILD_CAMPAIGN_FUNCTION_NAME}:$LATEST`,
      InvocationType: 'Event',
      Payload: JSON.stringify({
        tenantId,
        campaign
      })
    }));

    return formatResponse(202, {
      id: campaignId,
      status: 'building',
      message: 'Campaign creation initiated'
    });
  } catch (error) {
    campaignLogger.error('Create campaign operation failed', {
      operation: 'create-campaign',
      tenantId: event.requestContext?.authorizer?.tenantId,
      errorName: error.name,
      errorMessage: error.message
    });

    if (error.message.includes('Validation error')) {
      return formatResponse(400, { message: error.message });
    }

    return formatResponse(500, { message: 'Internal server error' });
  }
};
