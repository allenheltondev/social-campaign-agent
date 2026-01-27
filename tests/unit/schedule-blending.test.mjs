import { describe, it, expect } from 'vitest';
import { buildConstraints } from '../../functions/agents/schedule-blender.mjs';

describe('buildConstraints', () => {
  it('should extract cadence overrides from campaign', () => {
    const campaign = {
      cadenceOverrides: {
        maxPostsPerDay: 5,
        maxPostsPerWeek: 20
      }
    };
    const posts = [
      { scheduledAt: '2024-03-15T10:00:00Z' },
      { scheduledAt: '2024-03-20T14:00:00Z' }
    ];

    const result = buildConstraints(campaign, posts);

    expect(result.maxPostsPerDay).toBe(5);
    expect(result.maxPostsPerWeek).toBe(20);
  });

  it('should use default cadence values when overrides not provided', () => {
    const campaign = {};
    const posts = [
      { scheduledAt: '2024-03-15T10:00:00Z' }
    ];

    const result = buildConstraints(campaign, posts);

    expect(result.maxPostsPerDay).toBe(2);
    expect(result.maxPostsPerWeek).toBe(7);
  });

  it('should calculate date range from post timestamps', () => {
    const campaign = {};
    const posts = [
      { scheduledAt: '2024-03-15T10:00:00Z' },
      { scheduledAt: '2024-03-10T08:00:00Z' },
      { scheduledAt: '2024-03-25T16:00:00Z' }
    ];

    const result = buildConstraints(campaign, posts);

    expect(result.dateRange.start).toBe('2024-03-10T08:00:00.000Z');
    expect(result.dateRange.end).toBe('2024-03-25T16:00:00.000Z');
  });

  it('should handle single post date range', () => {
    const campaign = {};
    const posts = [
      { scheduledAt: '2024-03-15T10:00:00Z' }
    ];

    const result = buildConstraints(campaign, posts);

    expect(result.dateRange.start).toBe('2024-03-15T10:00:00.000Z');
    expect(result.dateRange.end).toBe('2024-03-15T10:00:00.000Z');
  });

  it('should extract blackout dates from campaign schedule', () => {
    const campaign = {
      schedule: {
        blackoutDates: ['2024-03-20T00:00:00Z', '2024-03-25T00:00:00Z']
      }
    };
    const posts = [
      { scheduledAt: '2024-03-15T10:00:00Z' }
    ];

    const result = buildConstraints(campaign, posts);

    expect(result.blackoutDates).toEqual(['2024-03-20T00:00:00Z', '2024-03-25T00:00:00Z']);
  });

  it('should return empty array when no blackout dates', () => {
    const campaign = {};
    const posts = [
      { scheduledAt: '2024-03-15T10:00:00Z' }
    ];

    const result = buildConstraints(campaign, posts);

    expect(result.blackoutDates).toEqual([]);
  });

  it('should handle campaign with schedule but no blackout dates', () => {
    const campaign = {
      schedule: {
        startDate: '2024-03-01T00:00:00Z'
      }
    };
    const posts = [
      { scheduledAt: '2024-03-15T10:00:00Z' }
    ];

    const result = buildConstraints(campaign, posts);

    expect(result.blackoutDates).toEqual([]);
  });

  it('should combine all constraint properties correctly', () => {
    const campaign = {
      cadenceOverrides: {
        maxPostsPerDay: 3,
        maxPostsPerWeek: 15
      },
      schedule: {
        blackoutDates: ['2024-03-18T00:00:00Z']
      }
    };
    const posts = [
      { scheduledAt: '2024-03-10T10:00:00Z' },
      { scheduledAt: '2024-03-20T14:00:00Z' }
    ];

    const result = buildConstraints(campaign, posts);

    expect(result).toEqual({
      maxPostsPerDay: 3,
      maxPostsPerWeek: 15,
      dateRange: {
        start: '2024-03-10T10:00:00.000Z',
        end: '2024-03-20T14:00:00.000Z'
      },
      blackoutDates: ['2024-03-18T00:00:00Z']
    });
  });

  it('should handle posts with various timestamp formats', () => {
    const campaign = {};
    const posts = [
      { scheduledAt: '2024-03-15T10:00:00.000Z' },
      { scheduledAt: '2024-03-16T14:30:45.123Z' },
      { scheduledAt: '2024-03-17T08:15:00Z' }
    ];

    const result = buildConstraints(campaign, posts);

    expect(result.dateRange.start).toBe('2024-03-15T10:00:00.000Z');
    expect(result.dateRange.end).toBe('2024-03-17T08:15:00.000Z');
  });
});
