import { LambdaClient, SendDurableExecutionCallbackSuccessCommand } from '@aws-sdk/client-lambda';
import { Campaign } from '../../models/campaign.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import { campaignLogger } from '../../utils/logger.mjs';
import { z } from 'zod';

const lambda = new LambdaClient();

const DecisionSchema = z.enum(['approved', 'rejected', 'needs_revision']);

const RequestBodySchema = z.object({
  decision: DecisionSchema,
  comments: z.string().nullable().optional()
});

export const handler = async (event) => {
  try {
    const { campaignId } = event.pathParameters || {};
    const tenantId = event.requestContext?.authorizer?.lambda?.tenantId;

    if (!campaignId || !tenantId) {
      return formatResponse(400, { message: 'Missing required parameters' });
    }

    let requestBody;
    try {
      requestBody = RequestBodySchema.parse(JSON.parse(event.body));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return formatResponse(400, {
          message: 'Invalid request body',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      return formatResponse(400, { message: 'Invalid JSON in request body' });
    }

    const campaign = await Campaign.findById(tenantId, campaignId);
    if (!campaign) {
      return formatResponse(404, { message: 'Campaign not found' });
    }

    if (campaign.status !== 'awaiting_review' && campaign.status !== 'needs_revision') {
      return formatResponse(409, {
        message: `Campaign must be in awaiting_review or needs_revision status. Current status: ${campaign.status}`
      });
    }

    if (!campaign.callbackId) {
      return formatResponse(409, {
        message: 'Campaign is not waiting for approval callback'
      });
    }

    const { decision } = requestBody;
    const now = new Date().toISOString();

    try {
      await lambda.send(new SendDurableExecutionCallbackSuccessCommand({
        CallbackId: campaign.callbackId,
        Result: JSON.stringify(decision)
      }));
    } catch (err) {
      campaignLogger.error('Failed to resume durable execution', {
        operation: 'send-callback-success',
        campaignId,
        tenantId,
        errorName: err.name,
        errorMessage: err.message
      });

      return formatResponse(500, {
        message: 'Failed to resume workflow'
      });
    }

    return formatResponse(decision === 'needs_revision' ? 202 : 200, {
      campaignId,
      decision,
      decidedAt: now
    });

  } catch (err) {
    campaignLogger.error('Campaign decision operation failed', {
      operation: 'make-campaign-decision',
      tenantId: event.requestContext?.authorizer?.lambda?.tenantId,
      campaignId: event.pathParameters?.campaignId,
      errorName: err.name,
      errorMessage: err.message
    });

    return formatResponse(500, { message: 'Internal server error' });
  }
};
