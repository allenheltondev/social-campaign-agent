import { SocialPost } from '../../models/social-post.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import { campaignLogger } from '../../utils/logger.mjs';
import { z } from 'zod';

const DecisionSchema = z.enum(['approved', 'rejected']);

const RequestBodySchema = z.object({
  decision: DecisionSchema,
  comments: z.string().nullable().optional()
});

export const handler = async (event) => {
  try {
    const { campaignId, postId } = event.pathParameters || {};
    const tenantId = event.requestContext?.authorizer?.lambda?.tenantId;

    if (!campaignId || !postId || !tenantId) {
      return formatResponse(400, { message: 'Missing required parameters' });
    }

    let requestBody;
    try {
      requestBody = RequestBodySchema.parse(JSON.parse(event.body));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return formatResponse(400, {
          message: 'Invalid request body',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      return formatResponse(400, { message: 'Invalid JSON in request body' });
    }

    const post = await SocialPost.findById(tenantId, campaignId, postId);
    if (!post) {
      return formatResponse(404, { message: 'Post not found' });
    }

    if (post.status !== 'completed' && post.status !== 'needs_review') {
      return formatResponse(409, {
        message: `Post must be in completed or needs_review status. Current status: ${post.status}`
      });
    }

    const { decision, comments } = requestBody;
    const now = new Date().toISOString();
    const newStatus = decision === 'approved' ? 'approved' : 'rejected';

    await SocialPost.update(tenantId, campaignId, postId, {
      status: newStatus,
      approval: {
        status: newStatus,
        reviewedAt: now,
        comments: comments || null
      }
    });

    return formatResponse(200, {
      postId,
      decision,
      status: newStatus,
      decidedAt: now
    });

  } catch (err) {
    campaignLogger.error('Post decision operation failed', {
      operation: 'make-post-decision',
      tenantId: event.requestContext?.authorizer?.lambda?.tenantId,
      campaignId: event.pathParameters?.campaignId,
      postId: event.pathParameters?.postId,
      errorName: err.name,
      errorMessage: err.message
    });

    return formatResponse(500, { message: 'Internal server error' });
  }
};
