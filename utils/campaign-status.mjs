import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

const eventBridge = new EventBridgeClient();

export const CAMPAIGN_STATUSES = {
  PLANNING: 'planning',
  GENERATING: 'generating',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  AWAITING_REVIEW: 'awaiting_review'
};

export const STATUS_TRANSITIONS = {
  [CAMPAIGN_STATUSES.PLANNING]: [CAMPAIGN_STATUSES.GENERATING, CAMPAIGN_STATUSES.CANCELLED],
  [CAMPAIGN_STATUSES.GENERATING]: [CAMPAIGN_STATUSES.COMPLETED, CAMPAIGN_STATUSES.AWAITING_REVIEW, CAMPAIGN_STATUSES.FAILED, CAMPAIGN_STATUSES.CANCELLED],
  [CAMPAIGN_STATUSES.AWAITING_REVIEW]: [CAMPAIGN_STATUSES.COMPLETED, CAMPAIGN_STATUSES.CANCELLED],
  [CAMPAIGN_STATUSES.COMPLETED]: [],
  [CAMPAIGN_STATUSES.FAILED]: [],
  [CAMPAIGN_STATUSES.CANCELLED]: []
};

export function isValidStatusTransition(currentStatus, newStatus) {
  if (currentStatus === newStatus) return true;
  return STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
}

export function getNextStatusFromPosts(posts, currentStatus) {
  if (currentStatus !== CAMPAIGN_STATUSES.GENERATING) {
    return currentStatus;
  }

  const totalPosts = posts.length;
  if (totalPosts === 0) return currentStatus;

  const completedPosts = posts.filter(p => p.status === 'completed').length;
  const failedPosts = posts.filter(p => p.status === 'failed').length;
  const skippedPosts = posts.filter(p => p.status === 'skipped').length;
  const needsReviewPosts = posts.filter(p => p.status === 'needs_review').length;

  const finishedPosts = completedPosts + failedPosts + skippedPosts + needsReviewPosts;

  if (finishedPosts >= totalPosts) {
    return needsReviewPosts > 0 ? CAMPAIGN_STATUSES.AWAITING_REVIEW : CAMPAIGN_STATUSES.COMPLETED;
  }

  return currentStatus;
}

export function createStatusTransitionEvent(campaignId, tenantId, fromStatus, toStatus, reason = null, error = null) {
  return {
    Source: 'campaign-api',
    DetailType: 'Campaign Status Changed',
    Detail: JSON.stringify({
      campaignId,
      tenantId,
      fromStatus,
      toStatus,
      reason,
      error,
      timestamp: new Date().toISOString()
    }),
    EventBusName: process.env.EVENT_BUS_NAME || 'default'
  };
}

export async function publishStatusTransition(campaignId, tenantId, fromStatus, toStatus, reason = null, error = null) {
  try {
    const event = createStatusTransitionEvent(campaignId, tenantId, fromStatus, toStatus, reason, error);

    await eventBridge.send(new PutEventsCommand({
      Entries: [event]
    }));

    return { success: true };
  } catch (err) {
    console.error('Failed to publish status transition event:', err);
    return { success: false, error: err.message };
  }
}

export function createErrorTracking(code, message, retryable = false) {
  return {
    code,
    message,
    at: new Date().toISOString(),
    retryable
  };
}

export function shouldRetryOnError(error) {
  const retryableErrors = [
    'ThrottlingException',
    'ServiceUnavailableException',
    'InternalServerError',
    'TimeoutException'
  ];

  return retryableErrors.some(retryableError =>
    error.name === retryableError || error.code === retryableError
  );
}

export function getUpdatePermissions(status) {
  switch (status) {
    case CAMPAIGN_STATUSES.PLANNING:
      return {
        name: true,
        brief: true,
        participants: true,
        schedule: true,
        cadenceOverrides: true,
        messaging: true,
        assetOverrides: true,
        metadata: true,
        status: true
      };
    case CAMPAIGN_STATUSES.GENERATING:
      return {
        name: true,
        'brief.description': true,
        metadata: true,
        status: true
      };
    case CAMPAIGN_STATUSES.COMPLETED:
    case CAMPAIGN_STATUSES.FAILED:
    case CAMPAIGN_STATUSES.CANCELLED:
    case CAMPAIGN_STATUSES.AWAITING_REVIEW:
      return {
        name: true,
        metadata: true,
        status: true
      };
    default:
      return {};
  }
}

export function validateStatusTransition(currentStatus, newStatus, campaign) {
  if (!isValidStatusTransition(currentStatus, newStatus)) {
    throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
  }

  if (newStatus === CAMPAIGN_STATUSES.GENERATING && !campaign.planSummary) {
    throw new Error('Cannot transition to generating status without a plan summary');
  }

  if (newStatus === CAMPAIGN_STATUSES.COMPLETED && currentStatus === CAMPAIGN_STATUSES.GENERATING) {
    throw new Error('Cannot directly transition from generating to completed - must go through workflow completion');
  }

  return true;
}
