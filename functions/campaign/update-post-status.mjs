import { SocialPost } from '../../models/social-post.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import { z } from 'zod';

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

    const post = await SocialPost.findById(tenantId, campaignId, postId);

    if (!post) {
      return formatResponse(404, { message: 'Post not found' });
    }
    const now = new Date().toISOString();

    const updateData = {
      status: validatedData.status,
      updatedAt: now
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

    const updatedPost = await SocialPost.update(tenantId, campaignId, postId, updateData);

    if (!updatedPost) {
      return formatResponse(404, { message: 'Post not found' });
    }

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
