import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { CampaignSchema, generateCampaignId } from '../../models/campaign.mjs';
import { logger } from '../../utils/logger.mjs';
import { AssetPoolBuilder } from '../../utils/asset-pool-builder.mjs';
import { z } from 'zod';

const lambda = new LambdaClient();

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

    const requestSchema = z.object({
      name: z.string().min(1),
      brief: z.object({
        description: z.string().min(10).max(2000),
        objective: z.enum(['awareness', 'education', 'conversion', 'event', 'launch']),
        primaryCTA: z.object({
          type: z.string().min(1),
          text: z.string().min(1),
          url: z.string().url().nullable()
        }).nullable()
      }),
      participants: z.object({
        personaIds: z.array(z.string()).min(1),
        platforms: z.array(z.enum(['twitter', 'linkedin', 'instagram', 'facebook'])).min(1),
        distribution: z.object({
          mode: z.enum(['balanced', 'weighted', 'custom']).default('balanced'),
          personaWeights: z.record(z.number().min(0).max(1)).nullable().optional(),
          platformWeights: z.record(z.number().min(0).max(1)).nullable().optional()
        }).nullable().optional()
      }),
      schedule: CampaignSchema.shape.schedule,
      brandId: z.string().optional(),
      cadenceOverrides: z.record(z.string(), z.object({
        postsPerWeek: z.number().int().min(1).max(7)
      })).nullable().optional(),
      messaging: z.object({
        themes: z.array(z.string()).optional(),
        ctas: z.array(z.string()).optional(),
        tone: z.string().optional()
      }).nullable().optional(),
      assetOverrides: z.record(z.string(), z.object({
        required: z.boolean().optional(),
        categories: z.array(z.string()).optional()
      })).nullable().optional(),
      assets: z.array(z.union([
        z.object({
          type: z.literal('internal'),
          assetId: z.string(),
          addedAt: z.string().optional()
        }),
        z.object({
          type: z.literal('external'),
          url: z.string().url(),
          description: z.string(),
          contentType: z.string()
        })
      ])).optional(),
      metadata: z.record(z.string(), z.any()).nullable().optional(),
      blendSchedule: z.boolean().optional(),
      previewAssets: z.boolean().optional()
    });

    const body = JSON.parse(event.body);
    const requestData = requestSchema.parse(body);

    const assetPool = await AssetPoolBuilder.buildAssetPool(
      tenantId,
      requestData.brandId || null,
      requestData.assets || []
    );

    const assetPoolStats = AssetPoolBuilder.calculateAssetPoolStats(assetPool);

    if (requestData.previewAssets) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
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
        })
      };
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

    if (requestData.blendSchedule !== undefined) {
      campaign.blendSchedule = requestData.blendSchedule;
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

    return {
      statusCode: 202,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        id: campaignId,
        status: 'building',
        message: 'Campaign creation initiated'
      })
    };
  } catch (error) {
    logger.error('Create campaign operation failed', {
      operation: 'create-campaign',
      tenantId: event.requestContext?.authorizer?.tenantId,
      errorName: error.name,
      errorMessage: error.message
    });

    if (error.name === 'ZodError') {
      const errorMessages = error.issues ? error.issues.map(e => e.message).join(', ') : error.message;
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: `Validation error: ${errorMessages}` })
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
