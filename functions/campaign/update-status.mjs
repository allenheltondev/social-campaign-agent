import { DynamoDBClient, GetItemCommand, UpdateItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import {
  getNextStatusFromPosts,
  publishStatusTransition,
  createErrorTracking,
  CAMPAIGN_STATUSES
} from '../../utils/campaign-status.mjs';
import { formatResponse } from '../../utils/api-response.mjs';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    const detail = event.detail || JSON.parse(event.Records?.[0]?.body || '{}').detail;
    const { campaignId, tenantId, newStatus, reason, error } = detail;

    if (!campaignId || !tenantId) {
      console.error('Missing required parameters:', { campaignId, tenantId });
      return formatResponse(400, { message: 'Missing required parameters' });
    }

    const pk = `${tenantId}#${campaignId}`;
    const sk = 'campaign';

    const getResponse = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({ pk, sk })
    }));

    if (!getResponse.Item) {
      console.error('Campaign not found:', { campaignId, tenantId });
      return formatResponse(404, { message: 'Campaign not found' });
    }

    const campaign = unmarshall(getResponse.Item);
    const currentStatus = campaign.status;

    let targetStatus = newStatus;

    if (!targetStatus && currentStatus === CAMPAIGN_STATUSES.GENERATING) {
      const posts = await getCampaignPosts(tenantId, campaignId);
      targetStatus = getNextStatusFromPosts(posts, currentStatus);
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
      updatedAt: now,
      version: campaign.version + 1
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
      ExpressionAttributeValues: marshall(expressionAttributeValues),
      ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk) AND version = :currentVersion',
      ExpressionAttributeValues: {
        ...marshall(expressionAttributeValues),
        ':currentVersion': { N: campaign.version.toString() }
      }
    }));

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
      updatedAt: now,
      version: campaign.version + 1
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
    console.error('Error fetching campaign posts:', error);
    return [];
  }
}
