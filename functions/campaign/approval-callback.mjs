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
    const { campaignId } = event.pathParameters;
    const { tenantId } = event.requestContext.authorizer;

    const response = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${campaignId}`,
        sk: 'campaign'
      })
    }));

    if (!response.Item) {
      return formatResponse(404, { message: 'Campaign not found' });
    }

    const campaign = unmarshall(response.Item);

    if (campaign.status !== 'pending_approval') {
      return formatResponse(409, { message: 'Campaign is not pending approval' });
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
