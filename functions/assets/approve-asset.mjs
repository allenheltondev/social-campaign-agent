import { Asset } from '../../models/asset.mjs';
import { z } from 'zod';

const ApprovalRequestSchema = z.object({
  status: z.enum(['approved', 'rejected', 'pending']),
  feedback: z.string().max(1000).optional().nullable()
});

export const handler = async (event) => {
  try {
    const tenantId = event.requestContext?.authorizer?.lambda?.tenantId;
    const userId = event.requestContext?.authorizer?.lambda?.userId;
    const assetId = event.pathParameters?.assetId;

    if (!tenantId || !userId) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Unauthorized' })
      };
    }

    if (!assetId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Asset ID is required' })
      };
    }

    const asset = await Asset.findById(tenantId, assetId);
    if (!asset) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Asset not found' })
      };
    }

    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Invalid JSON in request body' })
      };
    }

    const validatedData = ApprovalRequestSchema.parse(requestBody);

    await Asset.updateApprovalStatus(
      tenantId,
      assetId,
      validatedData.status,
      userId,
      validatedData.feedback || null
    );

    const updatedAsset = await Asset.findById(tenantId, assetId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        id: updatedAsset.id,
        approvalStatus: updatedAsset.approvalStatus,
        approvalHistory: updatedAsset.approvalHistory
      })
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationErrors = (error.errors || []).map(e => ({
        field: (e.path || []).join('.'),
        message: e.message || 'Validation failed'
      }));
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          message: 'Validation error',
          errors: validationErrors
        })
      };
    }

    console.error('Asset approval error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Failed to update asset approval status' })
    };
  }
};
