import { SocialPost } from '../../models/social-post.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import { campaignLogger } from '../../utils/logger.mjs';
import { z } from 'zod';

const DecisionSchema = z.enum(['approved', 'rejected']);

const PostDecisionSchema = z.object({
  postId: z.string(),
  decision: DecisionSchema,
  comments: z.string().nullable().optional()
});

const RequestBodySchema = z.object({
  decisions: z.array(PostDecisionSchema).min(1).max(25)
});

export const handler = async (event) => {
  try {
    const { campaignId } = event.pathParameters || {};
    const tenantId = event.requestContext?.authorizer?.lambda?.tenantId;

    if (!campaignId || !tenantId) {
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

    const { decisions } = requestBody;
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    const now = new Date().toISOString();

    for (const decisionItem of decisions) {
      try {
        const { postId, decision, comments } = decisionItem;

        const post = await SocialPost.findById(tenantId, campaignId, postId);
        if (!post) {
          results.push({
            postId,
            decision,
            status: 'failed',
            message: 'Post not found'
          });
          failureCount++;
          continue;
        }

        if (post.status !== 'completed' && post.status !== 'needs_review') {
          results.push({
            postId,
            decision,
            status: 'failed',
            message: `Post must be in completed or needs_review status. Current status: ${post.status}`
          });
          failureCount++;
          continue;
        }

        const newStatus = decision === 'approved' ? 'approved' : 'rejected';

        await SocialPost.update(tenantId, campaignId, postId, {
          status: newStatus,
          approval: {
            status: newStatus,
            reviewedAt: now,
            comments: comments || null
          }
        });

        results.push({
          postId,
          decision,
          status: 'success'
        });
        successCount++;

      } catch (err) {
        campaignLogger.error('Bulk decision processing failed for post', {
          operation: 'bulk-post-decisions',
          tenantId,
          campaignId,
          postId: decisionItem.postId,
          errorName: err.name,
          errorMessage: err.message
        });

        results.push({
          postId: decisionItem.postId,
          decision: decisionItem.decision,
          status: 'failed',
          message: 'Internal error processing decision'
        });
        failureCount++;
      }
    }

    return formatResponse(200, {
      successCount,
      failureCount,
      results
    });

  } catch (err) {
    campaignLogger.error('Bulk post decisions operation failed', {
      operation: 'bulk-post-decisions',
      tenantId: event.requestContext?.authorizer?.lambda?.tenantId,
      campaignId: event.pathParameters?.campaignId,
      errorName: err.name,
      errorMessage: err.message
    });

    return formatResponse(500, { message: 'Internal server error' });
  }
};
