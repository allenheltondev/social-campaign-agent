import { Campaign } from '../../models/campaign.mjs';
import { SocialPost } from '../../models/social-post.mjs';
import {
  getNextStatusFromPosts,
  publishStatusTransition,
  createErrorTracking,
  CAMPAIGN_STATUSES
} from '../../utils/campaign-status.mjs';
import { formatResponse } from '../../utils/api-response.mjs';

export const handler = async (event) => {
  try {
    const detail = event.detail || JSON.parse(event.Records?.[0]?.body || '{}').detail;
    const { campaignId, tenantId, newStatus, reason, error } = detail;

    if (!campaignId || !tenantId) {
      console.error('Missing required parameters:', { campaignId, tenantId });
      return formatResponse(400, { message: 'Missing required parameters' });
    }

    const campaign = await Campaign.findById(tenantId, campaignId);

    if (!campaign) {
      console.error('Campaign not found:', { campaignId, tenantId });
      return formatResponse(404, { message: 'Campaign not found' });
    }
    const currentStatus = campaign.status;

    let targetStatus = newStatus;

    if (!targetStatus && currentStatus === CAMPAIGN_STATUSES.GENERATING) {
      const postsResult = await SocialPost.findByCampaign(tenantId, campaignId);
      targetStatus = getNextStatusFromPosts(postsResult.items, currentStatus);
    }

    if (!targetStatus || targetStatus === currentStatus) {
      return formatResponse(200, {
        message: 'No status change required',
        currentStatus,
        targetStatus
      });
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
      return formatResponse(404, { message: 'Campaign not found' });
    }

    await publishStatusTransition(
      campaignId,
      tenantId,
      currentStatus,
      targetStatus,
      reason || 'Workflow status update',
      error
    );

    return formatResponse(200, {
      campaignId,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      updatedAt: now
    });

  } catch (err) {
    console.error('Update campaign status error:', err);

    if (err.name === 'ConditionalCheckFailedException') {
      return formatResponse(409, {
        message: 'Campaign was modified by another process. Please retry.'
      });
    }

    return formatResponse(500, { message: 'Internal server error' });
  }
};


