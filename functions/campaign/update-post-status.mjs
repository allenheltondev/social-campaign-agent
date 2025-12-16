import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { formatResponse } from '../../utils/api-response.mjs';
import { z } from 'zod';

const ddb = new DynamoDBClient();

const updatePostStatusSchema = z.object({
  status: z.enum(['planned', 'generating', 'completed', 'failed', 'skipped', 'needs_review']),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean().optional()
  }).optional(),
  content: z.object({
    text: z.string(),
    hashtags: z.array(z.string()).optional(),
    mentions: z.array(z.string()).optional()
  }).optional()
});

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { campaignId, postId } = event.pathParameters;

    if (!tenantId) {
      return formatResponse(401, { message: 'Unauthorized' });
    }

    const requestBody = JSON.parse(event.body || '{}');
    const validatedData = updatePostStatusSchema.parse(requestBody);

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
    const now = new Date().toISOString();

    const updateData = {
      status: validatedData.status,
      updatedAt: now,
      version: post.version + 1
    };

    if (validatedData.error) {
      updateData.lastError = {
        code: validatedData.error.code,
        message: validatedData.error.message,
        at: now,
        retryable: validatedData.error.retryable || false
      };
    } else if (validatedData.status !== 'failed') {
      updateData.lastError = null;
    }

    if (validatedData.content) {
      updateData.content = {
        ...validatedData.content,
        generatedAt: now
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
      message: 'Post status updated successfully',
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

    console.error('Update post status error:', error);
    return formatResponse(500, { message: 'Internal server error' });
  }
};
