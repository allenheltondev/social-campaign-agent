import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocialPost } from '../../models/social-post.mjs';

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
  GetItemCommand: vi.fn(),
  PutItemCommand: vi.fn(),
  QueryCommand: vi.fn(),
  UpdateItemCommand: vi.fn(),
  BatchWriteItemCommand: vi.fn()
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: vi.fn((obj) => obj),
  unmarshall: vi.fn((obj) => obj)
}));

describe('SocialPost.batchUpdateSchedules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(SocialPost, 'update').mockResolvedValue({
      id: 'post_123',
      scheduledAt: '2024-03-15T10:00:00Z'
    });
  });

  it('should update a single post schedule', async () => {
    const tenantId = 'tenant_123';
    const schedules = [
      {
        postId: 'post_1',
        campaignId: 'campaign_1',
        newScheduledAt: '2024-03-15T10:00:00Z'
      }
    ];

    const result = await SocialPost.batchUpdateSchedules(tenantId, schedules);

    expect(SocialPost.update).toHaveBeenCalledTimes(1);
    expect(SocialPost.update).toHaveBeenCalledWith(
      tenantId,
      'campaign_1',
      'post_1',
      { scheduledAt: '2024-03-15T10:00:00Z' }
    );
    expect(result).toEqual({
      success: true,
      updated: 1,
      failed: 0,
      errors: undefined
    });
  });

  it('should update multiple posts in a single batch', async () => {
    const tenantId = 'tenant_123';
    const schedules = [
      {
        postId: 'post_1',
        campaignId: 'campaign_1',
        newScheduledAt: '2024-03-15T10:00:00Z'
      },
      {
        postId: 'post_2',
        campaignId: 'campaign_1',
        newScheduledAt: '2024-03-16T14:00:00Z'
      },
      {
        postId: 'post_3',
        campaignId: 'campaign_2',
        newScheduledAt: '2024-03-17T09:00:00Z'
      }
    ];

    const result = await SocialPost.batchUpdateSchedules(tenantId, schedules);

    expect(SocialPost.update).toHaveBeenCalledTimes(3);
    expect(SocialPost.update).toHaveBeenCalledWith(
      tenantId,
      'campaign_1',
      'post_1',
      { scheduledAt: '2024-03-15T10:00:00Z' }
    );
    expect(SocialPost.update).toHaveBeenCalledWith(
      tenantId,
      'campaign_1',
      'post_2',
      { scheduledAt: '2024-03-16T14:00:00Z' }
    );
    expect(SocialPost.update).toHaveBeenCalledWith(
      tenantId,
      'campaign_2',
      'post_3',
      { scheduledAt: '2024-03-17T09:00:00Z' }
    );
    expect(result).toEqual({
      success: true,
      updated: 3,
      failed: 0,
      errors: undefined
    });
  });

  it('should process posts in batches of 25', async () => {
    const tenantId = 'tenant_123';
    const schedules = Array.from({ length: 30 }, (_, i) => ({
      postId: `post_${i}`,
      campaignId: 'campaign_1',
      newScheduledAt: `2024-03-${String(i + 1).padStart(2, '0')}T10:00:00Z`
    }));

    const result = await SocialPost.batchUpdateSchedules(tenantId, schedules);

    expect(SocialPost.update).toHaveBeenCalledTimes(30);
    expect(result).toEqual({
      success: true,
      updated: 30,
      failed: 0,
      errors: undefined
    });
  });

  it('should process exactly 25 posts in first batch when total is 50', async () => {
    const tenantId = 'tenant_123';
    const schedules = Array.from({ length: 50 }, (_, i) => ({
      postId: `post_${i}`,
      campaignId: 'campaign_1',
      newScheduledAt: `2024-03-15T${String(i).padStart(2, '0')}:00:00Z`
    }));

    const result = await SocialPost.batchUpdateSchedules(tenantId, schedules);

    expect(SocialPost.update).toHaveBeenCalledTimes(50);
    expect(result).toEqual({
      success: true,
      updated: 50,
      failed: 0,
      errors: undefined
    });
  });

  it('should handle empty schedules array', async () => {
    const tenantId = 'tenant_123';
    const schedules = [];

    const result = await SocialPost.batchUpdateSchedules(tenantId, schedules);

    expect(SocialPost.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      updated: 0,
      failed: 0,
      errors: undefined
    });
  });

  it('should process posts from different campaigns', async () => {
    const tenantId = 'tenant_123';
    const schedules = [
      {
        postId: 'post_1',
        campaignId: 'campaign_a',
        newScheduledAt: '2024-03-15T10:00:00Z'
      },
      {
        postId: 'post_2',
        campaignId: 'campaign_b',
        newScheduledAt: '2024-03-16T14:00:00Z'
      },
      {
        postId: 'post_3',
        campaignId: 'campaign_c',
        newScheduledAt: '2024-03-17T09:00:00Z'
      }
    ];

    const result = await SocialPost.batchUpdateSchedules(tenantId, schedules);

    expect(SocialPost.update).toHaveBeenCalledWith(
      tenantId,
      'campaign_a',
      'post_1',
      { scheduledAt: '2024-03-15T10:00:00Z' }
    );
    expect(SocialPost.update).toHaveBeenCalledWith(
      tenantId,
      'campaign_b',
      'post_2',
      { scheduledAt: '2024-03-16T14:00:00Z' }
    );
    expect(SocialPost.update).toHaveBeenCalledWith(
      tenantId,
      'campaign_c',
      'post_3',
      { scheduledAt: '2024-03-17T09:00:00Z' }
    );
    expect(result).toEqual({
      success: true,
      updated: 3,
      failed: 0,
      errors: undefined
    });
  });

  it('should handle exactly 25 posts without creating extra batch', async () => {
    const tenantId = 'tenant_123';
    const schedules = Array.from({ length: 25 }, (_, i) => ({
      postId: `post_${i}`,
      campaignId: 'campaign_1',
      newScheduledAt: `2024-03-15T${String(i).padStart(2, '0')}:00:00Z`
    }));

    const result = await SocialPost.batchUpdateSchedules(tenantId, schedules);

    expect(SocialPost.update).toHaveBeenCalledTimes(25);
    expect(result).toEqual({
      success: true,
      updated: 25,
      failed: 0,
      errors: undefined
    });
  });

  it('should handle 26 posts across two batches', async () => {
    const tenantId = 'tenant_123';
    const schedules = Array.from({ length: 26 }, (_, i) => ({
      postId: `post_${i}`,
      campaignId: 'campaign_1',
      newScheduledAt: `2024-03-15T${String(i).padStart(2, '0')}:00:00Z`
    }));

    const result = await SocialPost.batchUpdateSchedules(tenantId, schedules);

    expect(SocialPost.update).toHaveBeenCalledTimes(26);
    expect(result).toEqual({
      success: true,
      updated: 26,
      failed: 0,
      errors: undefined
    });
  });

  it('should handle partial failures and continue processing', async () => {
    const tenantId = 'tenant_123';
    const schedules = [
      {
        postId: 'post_1',
        campaignId: 'campaign_1',
        newScheduledAt: '2024-03-15T10:00:00Z'
      },
      {
        postId: 'post_2',
        campaignId: 'campaign_1',
        newScheduledAt: '2024-03-16T14:00:00Z'
      },
      {
        postId: 'post_3',
        campaignId: 'campaign_2',
        newScheduledAt: '2024-03-17T09:00:00Z'
      }
    ];

    vi.spyOn(SocialPost, 'update')
      .mockResolvedValueOnce({ id: 'post_1', scheduledAt: '2024-03-15T10:00:00Z' })
      .mockRejectedValueOnce(new Error('Update failed for post_2'))
      .mockResolvedValueOnce({ id: 'post_3', scheduledAt: '2024-03-17T09:00:00Z' });

    const result = await SocialPost.batchUpdateSchedules(tenantId, schedules);

    expect(SocialPost.update).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      success: false,
      updated: 2,
      failed: 1,
      errors: [
        {
          postId: 'post_2',
          campaignId: 'campaign_1',
          message: 'Update failed for post_2'
        }
      ]
    });
  });

  it('should handle all failures', async () => {
    const tenantId = 'tenant_123';
    const schedules = [
      {
        postId: 'post_1',
        campaignId: 'campaign_1',
        newScheduledAt: '2024-03-15T10:00:00Z'
      },
      {
        postId: 'post_2',
        campaignId: 'campaign_1',
        newScheduledAt: '2024-03-16T14:00:00Z'
      }
    ];

    vi.spyOn(SocialPost, 'update')
      .mockRejectedValueOnce(new Error('Database error'))
      .mockRejectedValueOnce(new Error('Network error'));

    const result = await SocialPost.batchUpdateSchedules(tenantId, schedules);

    expect(SocialPost.update).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      success: false,
      updated: 0,
      failed: 2,
      errors: [
        {
          postId: 'post_1',
          campaignId: 'campaign_1',
          message: 'Database error'
        },
        {
          postId: 'post_2',
          campaignId: 'campaign_1',
          message: 'Network error'
        }
      ]
    });
  });

  it('should handle failures across multiple batches', async () => {
    const tenantId = 'tenant_123';
    const schedules = Array.from({ length: 30 }, (_, i) => ({
      postId: `post_${i}`,
      campaignId: 'campaign_1',
      newScheduledAt: `2024-03-${String(i + 1).padStart(2, '0')}T10:00:00Z`
    }));

    vi.spyOn(SocialPost, 'update').mockImplementation((_, __, postId) => {
      if (postId === 'post_5' || postId === 'post_27') {
        return Promise.reject(new Error(`Failed to update ${postId}`));
      }
      return Promise.resolve({ id: postId, scheduledAt: '2024-03-15T10:00:00Z' });
    });

    const result = await SocialPost.batchUpdateSchedules(tenantId, schedules);

    expect(SocialPost.update).toHaveBeenCalledTimes(30);
    expect(result).toEqual({
      success: false,
      updated: 28,
      failed: 2,
      errors: [
        {
          postId: 'post_5',
          campaignId: 'campaign_1',
          message: 'Failed to update post_5'
        },
        {
          postId: 'post_27',
          campaignId: 'campaign_1',
          message: 'Failed to update post_27'
        }
      ]
    });
  });
});
