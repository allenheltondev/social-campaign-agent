import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { CampaignSchema } from '../../models/campaign.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import {
  isValidStatusTransition,
  validateStatusTransition,
  publishStatusTransition,
  createErrorTracking,
  getUpdatePermissions as getStatusUpdatePermissions
} from '../../utils/campaign-status.mjs';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { campaignId } = event.pathParameters;
    const updateData = JSON.parse(event.body);

    if (!tenantId || !campaignId) {
      return formatResponse(400, { message: 'Missing required parameters' });
    }

    const pk = `${tenantId}#${campaignId}`;
    const sk = 'campaign';

    const getResponse = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({ pk, sk })
    }));

    if (!getResponse.Item) {
      return formatResponse(404, { message: 'Campaign not found' });
    }

    const existingCampaign = unmarshall(getResponse.Item);

    const updatePermissions = getStatusUpdatePermissions(existingCampaign.status);
    const filteredUpdateData = filterUpdateData(updateData, updatePermissions);

    if (Object.keys(filteredUpdateData).length === 0) {
      return formatResponse(409, {
        message: `Cannot update campaign in ${existingCampaign.status} status`,
        currentStatus: existingCampaign.status
      });
    }

    if (filteredUpdateData.status && filteredUpdateData.status !== existingCampaign.status) {
      try {
        validateStatusTransition(existingCampaign.status, filteredUpdateData.status, existingCampaign);
      } catch (statusError) {
        return formatResponse(400, {
          message: statusError.message,
          currentStatus: existingCampaign.status,
          requestedStatus: filteredUpdateData.status
        });
      }
    }

    const validatedData = CampaignSchema.partial().parse(filteredUpdateData);

    const updatedCampaign = {
      ...existingCampaign,
      ...validatedData,
      updatedAt: new Date().toISOString(),
      version: existingCampaign.version + 1
    };

    if (validatedData.status === 'completed') {
      updatedCampaign.completedAt = new Date().toISOString();
    }

    if (shouldUpdatePlanVersion(filteredUpdateData, existingCampaign.status)) {
      updatedCampaign.planVersion = generatePlanVersion(updatedCampaign);
    }

    const updateExpression = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    Object.keys(updatedCampaign).forEach((key, index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpression.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updatedCampaign[key];
    });

    await ddb.send(new UpdateItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({ pk, sk }),
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: marshall(expressionAttributeValues),
      ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)'
    }));

    if (validatedData.status && validatedData.status !== existingCampaign.status) {
      await publishStatusTransition(
        campaignId,
        tenantId,
        existingCampaign.status,
        validatedData.status,
        'Manual status update'
      );
    }

    return formatResponse(200, updatedCampaign);

  } catch (err) {
    console.error('Update campaign error:', err);

    if (err.name === 'ZodError') {
      return formatResponse(400, {
        message: 'Invalid campaign data',
        details: err.errors
      });
    }

    if (err.name === 'ConditionalCheckFailedException') {
      return formatResponse(404, { message: 'Campaign not found' });
    }

    return formatResponse(500, { message: 'Something went wrong' });
  }
};



function filterUpdateData(updateData, permissions) {
  const filtered = {};

  for (const [key, value] of Object.entries(updateData)) {
    if (permissions[key]) {
      filtered[key] = value;
    } else if (key.includes('.')) {
      const [parentKey, childKey] = key.split('.');
      if (permissions[`${parentKey}.${childKey}`]) {
        if (!filtered[parentKey]) {
          filtered[parentKey] = {};
        }
        filtered[parentKey][childKey] = value;
      }
    }
  }

  return filtered;
}

function shouldUpdatePlanVersion(updateData, status) {
  if (status !== 'planning') return false;

  const planAffectingFields = [
    'brief', 'participants', 'schedule', 'cadenceOverrides', 'messaging', 'assetOverrides'
  ];

  return planAffectingFields.some(field => updateData.hasOwnProperty(field));
}

function generatePlanVersion(campaign) {
  const planData = {
    brief: campaign.brief,
    participants: campaign.participants,
    schedule: campaign.schedule,
    cadenceOverrides: campaign.cadenceOverrides,
    messaging: campaign.messaging,
    assetOverrides: campaign.assetOverrides
  };

  return Buffer.from(JSON.stringify(planData)).toString('base64').slice(0, 16);
}
