import { describe, it, expect } from 'vitest';
import {
  CAMPAIGN_STATUSES,
  STATUS_TRANSITIONS,
  isValidStatusTransition,
  getNextStatusFromPosts,
  createStatusTransitionEvent,
  createErrorTracking,
  shouldRetryOnError,
  getUpdatePermissions,
  validateStatusTransition
} from '../../utils/campaign-status.mjs';

describe('Campaign Status Management', () => {
  describe('Status Transitions', () => {
    it('should validate correct status transitions', () => {
      expect(isValidStatusTransition('planning', 'generating')).toBe(true);
      expect(isValidStatusTransition('generating', 'completed')).toBe(true);
      expect(isValidStatusTransition('generating', 'failed')).toBe(true);
      expect(isValidStatusTransition('generating', 'awaiting_review')).toBe(true);
      expect(isValidStatusTransition('awaiting_review', 'completed')).toBe(true);
    });

    it('should reject invalid status transitions', () => {
      expect(isValidStatusTransition('completed', 'generating')).toBe(false);
      expect(isValidStatusTransition('failed', 'planning')).toBe(false);
      expect(isValidStatusTransition('cancelled', 'generating')).toBe(false);
      expect(isValidStatusTransition('planning', 'completed')).toBe(false);
    });

    it('should allow same status transitions', () => {
      expect(isValidStatusTransition('planning', 'planning')).toBe(true);
      expect(isValidStatusTransition('generating', 'generating')).toBe(true);
      expect(isValidStatusTransition('completed', 'completed')).toBe(true);
    });
  });

  describe('Post-based Status Calculation', () => {
    it('should return completed when all posts are finished', () => {
      const posts = [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'failed' }
      ];
      expect(getNextStatusFromPosts(posts, 'generating')).toBe('completed');
    });

    it('should return awaiting_review when posts need review', () => {
      const posts = [
        { status: 'completed' },
        { status: 'needs_review' },
        { status: 'completed' }
      ];
      expect(getNextStatusFromPosts(posts, 'generating')).toBe('awaiting_review');
    });

    it('should return generating when posts are still in progress', () => {
      const posts = [
        { status: 'completed' },
        { status: 'generating' },
        { status: 'planned' }
      ];
      expect(getNextStatusFromPosts(posts, 'generating')).toBe('generating');
    });

    it('should not change status if not in generating', () => {
      const posts = [{ status: 'completed' }];
      expect(getNextStatusFromPosts(posts, 'planning')).toBe('planning');
      expect(getNextStatusFromPosts(posts, 'completed')).toBe('completed');
    });
  });

  describe('Event Creation', () => {
    it('should create proper status transition events', () => {
      const event = createStatusTransitionEvent(
        'campaign_123',
        'tenant_456',
        'planning',
        'generating',
        'Manual transition'
      );

      expect(event.Source).toBe('campaign-api');
      expect(event.DetailType).toBe('Campaign Status Changed');

      const detail = JSON.parse(event.Detail);
      expect(detail.campaignId).toBe('campaign_123');
      expect(detail.tenantId).toBe('tenant_456');
      expect(detail.fromStatus).toBe('planning');
      expect(detail.toStatus).toBe('generating');
      expect(detail.reason).toBe('Manual transition');
    });
  });

  describe('Error Tracking', () => {
    it('should create proper error tracking objects', () => {
      const error = createErrorTracking('TEST_ERROR', 'Test error message', true);

      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test error message');
      expect(error.retryable).toBe(true);
      expect(error.at).toBeDefined();
    });

    it('should identify retryable errors', () => {
      expect(shouldRetryOnError({ name: 'ThrottlingException' })).toBe(true);
      expect(shouldRetryOnError({ code: 'ServiceUnavailableException' })).toBe(true);
      expect(shouldRetryOnError({ name: 'ValidationException' })).toBe(false);
    });
  });

  describe('Update Permissions', () => {
    it('should allow all updates in planning status', () => {
      const permissions = getUpdatePermissions('planning');
      expect(permissions.name).toBe(true);
      expect(permissions.brief).toBe(true);
      expect(permissions.participants).toBe(true);
      expect(permissions.status).toBe(true);
    });

    it('should restrict updates in generating status', () => {
      const permissions = getUpdatePermissions('generating');
      expect(permissions.name).toBe(true);
      expect(permissions['brief.description']).toBe(true);
      expect(permissions.participants).toBeFalsy();
      expect(permissions.schedule).toBeFalsy();
    });

    it('should heavily restrict updates in completed status', () => {
      const permissions = getUpdatePermissions('completed');
      expect(permissions.name).toBe(true);
      expect(permissions.metadata).toBe(true);
      expect(permissions.brief).toBeFalsy();
      expect(permissions.participants).toBeFalsy();
    });
  });

  describe('Status Validation', () => {
    it('should validate status transitions with campaign context', () => {
      const campaign = {
        planSummary: { totalPosts: 5 }
      };

      expect(() => validateStatusTransition('planning', 'generating', campaign)).not.toThrow();
      expect(() => validateStatusTransition('generating', 'completed', campaign)).toThrow();
      expect(() => validateStatusTransition('completed', 'planning', campaign)).toThrow();
    });

    it('should require plan summary for generating status', () => {
      const campaignWithoutPlan = {};

      expect(() => validateStatusTransition('planning', 'generating', campaignWithoutPlan))
        .toThrow('Cannot transition to generating status without a plan summary');
    });
  });
});
