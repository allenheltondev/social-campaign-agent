import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { LambdaClient, SendDurableExecutionCallbackSuccessCommand } from '@aws-sdk/client-lambda';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { z } from 'zod';
import { formatResponse } from '../../utils/api-response.mjs';

const ddb = new DynamoDBClient();
const lambda = new LambdaClient();

const approvalSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'needs_revision']),
  comments: z.string().optional()
});

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return formatResponse(200, { message: 'OK' });
    }

    if (event.httpMethod !== 'POST') {
      return formatResponse(405, { message: 'Method not allowed' });
    }

    if (!event.pathParameters?.campaignId) {
      return formatResponse(400, { message: 'Campaign ID is required' });
    }

    if (!event.queryStringParameters?.callbackId) {
      return formatResponse(400, { message: 'Invalid callback ID' });
    }

    const { campaignId } = event.pathParameters;
    const { callbackId } = event.queryStringParameters;
    const tenantId = event.requestContext?.authorizer?.tenantId || 'test-tenant';

    const response = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${campaignId}`,
        sk: 'campaign'
      })
    }));

    if (!response.Item) {
      return formatResponse(404, { message: 'Campaign not found or approval expired' });
    }

    const campaign = unmarshall(response.Item);

    if (campaign.callbackId !== callbackId) {
      return formatResponse(404, { message: 'Campaign not found or approval expired' });
    }

    if (campaign.status !== 'pending_approval') {
      return formatResponse(404, { message: 'Campaign not found or approval expired' });
    }

    const approvalData = approvalSchema.parse(JSON.parse(event.body));

    await lambda.send(new SendDurableExecutionCallbackSuccessCommand({
      CallbackId: campaign.callbackId,
      Result: JSON.stringify(approvalData)
    }));

    return formatResponse(200, {
      message: 'Approval submitted successfully',
      decision: approvalData.decision
    });

  } catch (error) {
    console.error('Approval callback failed', error);

    if (error.name === 'ZodError') {
      return formatResponse(400, { message: 'Invalid request data' });
    }

    return formatResponse(500, { message: 'Failed to process approval' });
  }
};
