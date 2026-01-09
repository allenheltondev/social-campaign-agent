import { DynamoDBClient, GetItemCommand, UpdateItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import {
  getNextStatusFromPosts,
  publishStatusTransition,
  createErrorTracking,
  CAMPAIGN_STATUSES
} from '../../../utils/campaign-status.mjs';
import { campaignLogger } from '../../../utils/logger.mjs';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    const {detail} = event;
    const { campaignId, tenantId, workflowType, success, error, postResults } = detail;

    if (!campaignId || !tenantId) {
      campaignLogger.error('Missing required parameters in event detail', {
        operation: 'workflow-completion',
        campaignId,
        tenantId,
        errorName: 'ValidationError',
        errorMessage: 'Missing required parameters'
      });
      return { statusCode: 400, body: JSON.stringify({ message: 'Missing required parameters' }) };
    }

    const pk = `${tenantId}#${campaignId}`;
    const sk = 'campaign';

    const getResponse = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({ pk, sk })
    }));

    if (!getResponse.Item) {
      campaignLogger.error('Campaign not found for workflow completion', {
        operation: 'workflow-completion',
        campaignId,
        tenantId,
        errorName: 'NotFoundError',
        errorMessage: 'Campaign not found'
      });
      return { statusCode: 404, body: JSON.stringify({ message: 'Campaign not found' }) };
    }

    const campaign = unmarshall(getResponse.Item);
    const currentStatus = campaign.status;

    if (currentStatus !== CAMPAIGN_STATUSES.GENERATING) {
      return { statusCode: 200, body: JSON.stringify({ message: 'Campaign not in generating status' }) };
    }

    let targetStatus;
    let errorTracking = null;

    if (workflowType === 'content-generation') {
      if (success) {
        const posts = await getCampaignPosts(tenantId, campaignId);
        targetStatus = getNextStatusFromPosts(posts, currentStatus);
      } else {
        targetStatus = CAMPAIGN_STATUSES.FAILED;
        errorTracking = createErrorTracking(
          error?.code || 'CONTENT_GENERATION_FAILED',
          error?.message || 'Content generation workflow failed',
          error?.retryable || false
        );
      }
    } else if (workflowType === 'campaign-planning') {
      if (success) {
        targetStatus = CAMPAIGN_STATUSES.GENERATING;
      } else {
        targetStatus = CAMPAIGN_STATUSES.FAILED;
        errorTracking = createErrorTracking(
          error?.code || 'CAMPAIGN_PLANNING_FAILED',
          error?.message || 'Campaign planning workflow failed',
          error?.retryable || false
        );
      }
    }

    if (!targetStatus || targetStatus === currentStatus) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No status change required' }) };
    }

    const now = new Date().toISOString();
    const updateData = {
      status: targetStatus,
      updatedAt: now
    };

    if (targetStatus === CAMPAIGN_STATUSES.COMPLETED) {
      updateData.completedAt = now;
    }

    if (errorTracking) {
      updateData.lastError = errorTracking;
    } else if (targetStatus !== CAMPAIGN_STATUSES.FAILED) {
      updateData.lastError = null;
    }

    if (postResults && Array.isArray(postResults)) {
      const summary = calculatePlanSummary(postResults);
      if (summary) {
        updateData.planSummary = summary;
      }
    }

    const updateExpression = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    Object.keys(updateData).forEach((key, index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpression.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updateData[key];
    });

    await ddb.send(new UpdateItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({ pk, sk }),
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: {
        ...marshall(expressionAttributeValues),
        ':currentVersion': { N: campaign.version.toString() }
      },
      ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk) AND version = :currentVersion'
    }));

    await publishStatusTransition(
      campaignId,
      tenantId,
      currentStatus,
      targetStatus,
      `Workflow completion: ${workflowType}`,
      error
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        campaignId,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        updatedAt: now
      })
    };

  } catch (err) {
    campaignLogger.error('Workflow completion handler failed', {
      operation: 'workflow-completion',
      campaignId: event.detail?.campaignId,
      tenantId: event.detail?.tenantId,
      errorName: err.name,
      errorMessage: err.message
    });

    if (err.name === 'ConditionalCheckFailedException') {
      return {
        statusCode: 409,
        body: JSON.stringify({ message: 'Campaign was modified by another process' })
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};

async function getCampaignPosts(tenantId, campaignId) {
  try {
    const response = await ddb.send(new QueryCommand({
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
      ExpressionAttributeValues: marshall({
        ':pk': `${tenantId}#${campaignId}`,
        ':skPrefix': 'POST#'
      })
    }));

    return response.Items ? response.Items.map(item => unmarshall(item)) : [];
  } catch (error) {
    campaignLogger.error('Error fetching campaign posts', {
      operation: 'get-campaign-posts',
      tenantId,
      campaignId,
      errorName: error.name,
      errorMessage: error.message
    });
    return [];
  }
}

function calculatePlanSummary(postResults) {
  if (!postResults || !Array.isArray(postResults)) {
    return null;
  }

  const totalPosts = postResults.length;
  const postsPerPlatform = {};
  const postsPerPersona = {};

  postResults.forEach(post => {
    if (post.platform) {
      postsPerPlatform[post.platform] = (postsPerPlatform[post.platform] || 0) + 1;
    }
    if (post.personaId) {
      postsPerPersona[post.personaId] = (postsPerPersona[post.personaId] || 0) + 1;
    }
  });

  return {
    totalPosts,
    postsPerPlatform,
    postsPerPersona
  };
}
