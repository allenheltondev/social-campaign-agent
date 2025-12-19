import { SocialPost } from '../../models/social-post.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import { z } from 'zod';

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

    const post = await SocialPost.findById(tenantId, campaignId, postId);

    if (!post) {
      return formatResponse(404, { message: 'Post not found' });
    }

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

    const updatedPost = await SocialPost.update(tenantId, campaignId, postId, updateData);

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

    console.error('Approve post error:', error);
    return formatResponse(500, { message: 'Internal server error' });
  }
};
