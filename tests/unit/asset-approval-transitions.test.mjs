import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handler } from '../../functions/assets/approve-asset.mjs';
import { Asset } from '../../models/asset.mjs';

vi.mock('../../models/asset.mjs');

describe('Asset Approval Status Transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should transition from pending to approved', async () => {
    const mockAsset = {
      id: 'asset_123',
      approvalStatus: 'pending',
      approvalHistory: []
    };

    Asset.findById.mockResolvedValueOnce(mockAsset);
    Asset.updateApprovalStatus.mockResolvedValueOnce({ success: true });
    Asset.findById.mockResolvedValueOnce({
      ...mockAsset,
      approvalStatus: 'approved',
      approvalHistory: [{
        status: 'approved',
        reviewedBy: 'user_123',
        reviewedAt: '2024-01-15T10:00:00Z',
        feedback: null
      }]
    });

    const event = {
      requestContext: {
        authorizer: {
          lambda: {
            tenantId: 'tenant_123',
            userId: 'user_123'
          }
        }
      },
      pathParameters: {
        assetId: 'asset_123'
      },
      body: JSON.stringify({
        status: 'approved'
      })
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.approvalStatus).toBe('approved');
    expect(body.approvalHistory).toHaveLength(1);
    expect(body.approvalHistory[0].status).toBe('approved');
  });

  it('should transition from pending to rejected with feedback', async () => {
    const mockAsset = {
      id: 'asset_123',
      approvalStatus: 'pending',
      approvalHistory: []
    };

    Asset.findById.mockResolvedValueOnce(mockAsset);
    Asset.updateApprovalStatus.mockResolvedValueOnce({ success: true });
    Asset.findById.mockResolvedValueOnce({
      ...mockAsset,
      approvalStatus: 'rejected',
      approvalHistory: [{
        status: 'rejected',
        reviewedBy: 'user_123',
        reviewedAt: '2024-01-15T10:00:00Z',
        feedback: 'Image quality is too low'
      }]
    });

    const event = {
      requestContext: {
        authorizer: {
          lambda: {
            tenantId: 'tenant_123',
            userId: 'user_123'
          }
        }
      },
      pathParameters: {
        assetId: 'asset_123'
      },
      body: JSON.stringify({
        status: 'rejected',
        feedback: 'Image quality is too low'
      })
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.approvalStatus).toBe('rejected');
    expect(body.approvalHistory).toHaveLength(1);
    expect(body.approvalHistory[0].status).toBe('rejected');
    expect(body.approvalHistory[0].feedback).toBe('Image quality is too low');
  });

  it('should record approval history with reviewer and timestamp', async () => {
    const mockAsset = {
      id: 'asset_123',
      approvalStatus: 'pending',
      approvalHistory: []
    };

    Asset.findById.mockResolvedValueOnce(mockAsset);
    Asset.updateApprovalStatus.mockResolvedValueOnce({ success: true });
    Asset.findById.mockResolvedValueOnce({
      ...mockAsset,
      approvalStatus: 'approved',
      approvalHistory: [{
        status: 'approved',
        reviewedBy: 'user_456',
        reviewedAt: '2024-01-15T10:00:00Z',
        feedback: 'Looks great!'
      }]
    });

    const event = {
      requestContext: {
        authorizer: {
          lambda: {
            tenantId: 'tenant_123',
            userId: 'user_456'
          }
        }
      },
      pathParameters: {
        assetId: 'asset_123'
      },
      body: JSON.stringify({
        status: 'approved',
        feedback: 'Looks great!'
      })
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.approvalHistory[0].reviewedBy).toBe('user_456');
    expect(body.approvalHistory[0].reviewedAt).toBeDefined();
    expect(body.approvalHistory[0].feedback).toBe('Looks great!');
  });

  it('should return 404 when asset does not exist', async () => {
    Asset.findById.mockResolvedValueOnce(null);

    const event = {
      requestContext: {
        authorizer: {
          lambda: {
            tenantId: 'tenant_123',
            userId: 'user_123'
          }
        }
      },
      pathParameters: {
        assetId: 'nonexistent_asset'
      },
      body: JSON.stringify({
        status: 'approved'
      })
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('Asset not found');
  });

  it('should return 400 for invalid status value', async () => {
    const mockAsset = {
      id: 'asset_123',
      approvalStatus: 'pending',
      approvalHistory: []
    };

    Asset.findById.mockResolvedValueOnce(mockAsset);

    const event = {
      requestContext: {
        authorizer: {
          lambda: {
            tenantId: 'tenant_123',
            userId: 'user_123'
          }
        }
      },
      pathParameters: {
        assetId: 'asset_123'
      },
      body: JSON.stringify({
        status: 'invalid_status'
      })
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('Validation error');
  });

  it('should return 401 when tenant ID is missing', async () => {
    const event = {
      requestContext: {
        authorizer: {
          lambda: {}
        }
      },
      pathParameters: {
        assetId: 'asset_123'
      },
      body: JSON.stringify({
        status: 'approved'
      })
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('Unauthorized');
  });
});
