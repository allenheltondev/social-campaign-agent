import { Campaign } from '../../models/campaign.mjs';
import { SocialPost } from '../../models/social-post.mjs';
import {
  getNextStatusFromPosts,
  publishStatusTransition,
  createErrorTracking,
  CAMPAIGN_STATUSES
} from '../../utils/campaign-status.mjs';
import { logger } from '../../utils/logger.mjs';

export const handler = async (event) => {
  try {
    const detail = event.detail || JSON.parse(event.Records?.[0]?.body || '{}').detail;
    const { campaignId, tenantId, newStatus, reason, error } = detail;

    if (!campaignId || !tenantId) {
      logger.error('Missing required parameters for campaign status update', {
        operation: 'update-campaign-status',
        campaignId,
        tenantId,
        errorName: 'ValidationError',
        errorMessage: 'Missing required parameters'
      });
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Missing required parameters' })
      };
    }

    const campaign = await Campaign.findById(tenantId, campaignId);

    if (!campaign) {
      logger.error('Campaign not found for status update', {
        operation: 'update-campaign-status',
        tenantId,
        campaignId,
        errorName: 'NotFoundError',
        errorMessage: 'Campaign not found'
      });
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Campaign not found' })
      };
    }
    const currentStatus = campaign.status;

    let targetStatus = newStatus;

    if (!targetStatus && currentStatus === CAMPAIGN_STATUSES.GENERATING) {
      const postsResult = await SocialPost.findByCampaign(tenantId, campaignId);
      targetStatus = getNextStatusFromPosts(postsResult.items, currentStatus);
    }

    if (!targetStatus || targetStatus === currentStatus) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          message: 'No status change required',
          currentStatus,
          targetStatus
        })
      };
    }

    const now = new Date().toISOString();
    const updateData = {
      status: targetStatus,
      updatedAt: now
    };

    if (targetStatus === CAMPAIGN_STATUSES.COMPLETED) {
      updateData.completedAt = now;
    }

    if (error) {
      updateData.lastError = createErrorTracking(
        error.code || 'WORKFLOW_ERROR',
        error.message || 'Workflow execution failed',
        error.retryable || false
      );
    } else if (targetStatus !== CAMPAIGN_STATUSES.FAILED) {
      updateData.lastError = null;
    }

    const updatedCampaign = await Campaign.update(tenantId, campaignId, updateData);

    if (!updatedCampaign) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Campaign not found' })
      };
    }

    await publishStatusTransition(
      campaignId,
      tenantId,
      currentStatus,
      targetStatus,
      reason || 'Workflow status update',
      error
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        campaignId,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        updatedAt: now
      })
    };

  } catch (err) {
    logger.error('Update campaign status operation failed', {
      operation: 'update-campaign-status',
      tenantId: event.detail?.tenantId,
      campaignId: event.detail?.campaignId,
      errorName: err.name,
      errorMessage: err.message
    });

    if (err.name === 'ConditionalCheckFailedException') {
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          message: 'Campaign was modified by another process. Please retry.'
        })
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

