import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { formatResponse } from '../../utils/api-response.mjs';
import { z } from 'zod';

const ddb = new DynamoDBClient();

const approvePostSchema = z.object({
  approved: z.boolean(),
  feedback: z.string().optional(),
  requestChanges: z.array(z.string()).optional()
});

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { campaignId, postId } = event.pathParameters;

    if (!tenantId) {
      return formatResponse(401, { message: 'Unauthorized' });
    }

    const requestBody = JSON.parse(event.body || '{}');
    const validatedData = approvePostSchema.parse(requestBody);

    const pk = `${tenantId}#${campaignId}`;
    const sk = `POST#${postId}`;

    const getResponse = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({ pk, sk })
    }));

    if (!getResponse.Item) {
      return formatResponse(404, { message: 'Post not found' });
    }

    const post = unmarshall(getResponse.Item);

    if (post.status !== 'needs_review') {
      return formatResponse(400, {
        message: 'Post is not in review status',
        currentStatus: post.status
      });
    }

    const now = new Date().toISOString();
    const newStatus = validatedData.approved ? 'completed' : 'failed';

    const updateData = {
      status: newStatus,
      updatedAt: now,
      version: post.version + 1,
      approval: {
        approved: validatedData.approved,
        reviewedAt: now,
        feedback: validatedData.feedback,
        requestChanges: validatedData.requestChanges
      }
    };

    if (!validatedData.approved && validatedData.requestChanges) {
      updateData.lastError = {
        code: 'APPROVAL_REJECTED',
        message: `Post rejected: ${validatedData.requestChanges.join(', ')}`,
        at: now,
        retryable: true
      };
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
        ':currentVersion': { N: post.version.toString() }
      }
    }));

    const updatedPost = {
      ...post,
      ...updateData
    };

    return formatResponse(200, {
      message: `Post ${validatedData.approved ? 'approved' : 'rejected'} successfully`,
      post: updatedPost
    });

  } catch (error) {
    if (error.name === 'ZodError') {
      return formatResponse(400, {
        message: 'Invalid request data',
        details: error.errors
      });
    }

    if (error.name === 'ConditionalCheckFailedException') {
      return formatResponse(409, {
        message: 'Post was modified by another process'
      });
    }

    console.error('Approve post error:', error);
    return formatResponse(500, { message: 'Internal server error' });
  }
};
