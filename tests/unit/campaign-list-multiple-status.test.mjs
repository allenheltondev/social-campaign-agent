import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { Campaign } from '../../models/campaign.mjs';
import { marshall } from '@aws-sdk/util-dynamodb';

const ddbMock = mockClient(DynamoDBClient);

describe('Campaign.list - Multiple Status Filtering', () => {
  const tenantId = 'tenant_123';

  const createMockCampaign = (id, status) => ({
    pk: `${tenantId}#${id}`,
    sk: 'campaign',
    GSI1PK: tenantId,
    GSI1SK: `CAMPAIGN#2024-03-0${id.slice(-1)}T10:00:00Z`,
    id,
    tenantId,
    name: `Campaign ${id}`,
    status,
    brandId: 'brand_1',
    brief: {
      description: `Test campaign ${id}`,
      objective: 'awareness',
      primaryCTA: null
    },
    participants: {
      personaIds: ['persona_1'],
      platforms: ['twitter'],
      distribution: { mode: 'balanced' }
    },
    schedule: {
      timezone: 'UTC',
      startDate: '2024-03-01T00:00:00Z',
      endDate: '2024-03-31T23:59:59Z',
      allowedDaysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'],
      blackoutDates: null,
      postingWindows: null
    },
    cadenceOverrides: null,
    messaging: null,
    assetOverrides: null,
    planSummary: null,
    lastError: null,
    completedAt: null,
    metadata: { source: 'api', externalRef: null },
    createdAt: '2024-03-01T10:00:00Z',
    updatedAt: '2024-03-01T10:00:00Z'
  });

  const mockCampaigns = [
    createMockCampaign('campaign_1', 'approved'),
    createMockCampaign('campaign_2', 'awaiting_review'),
    createMockCampaign('campaign_3', 'completed')
  ];

  beforeEach(() => {
    ddbMock.reset();
    process.env.TABLE_NAME = 'test-table';
  });

  it('should filter by single status', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [mockCampaigns[0]].map(c => marshall(c)),
      LastEvaluatedKey: undefined
    });

    const result = await Campaign.list(tenantId, { status: 'approved' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].status).toBe('approved');

    const queryCall = ddbMock.commandCalls(QueryCommand)[0];
    expect(queryCall.args[0].input.FilterExpression).toBe('#status IN (:status0)');
  });

  it('should filter by multiple statuses using IN operator', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [mockCampaigns[0], mockCampaigns[1]].map(c => marshall(c)),
      LastEvaluatedKey: undefined
    });

    const result = await Campaign.list(tenantId, {
      status: ['approved', 'awaiting_review']
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0].status).toBe('approved');
    expect(result.items[1].status).toBe('awaiting_review');

    const queryCall = ddbMock.commandCalls(QueryCommand)[0];
    expect(queryCall.args[0].input.FilterExpression).toBe('#status IN (:status0, :status1)');
    expect(queryCall.args[0].input.ExpressionAttributeValues).toHaveProperty(':status0');
    expect(queryCall.args[0].input.ExpressionAttributeValues).toHaveProperty(':status1');
  });

  it('should handle three statuses efficiently', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: mockCampaigns.map(c => marshall(c)),
      LastEvaluatedKey: undefined
    });

    const result = await Campaign.list(tenantId, {
      status: ['approved', 'awaiting_review', 'completed']
    });

    expect(result.items).toHaveLength(3);

    const queryCall = ddbMock.commandCalls(QueryCommand)[0];
    expect(queryCall.args[0].input.FilterExpression).toBe('#status IN (:status0, :status1, :status2)');
  });

  it('should work without status filter', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: mockCampaigns.map(c => marshall(c)),
      LastEvaluatedKey: undefined
    });

    const result = await Campaign.list(tenantId);

    expect(result.items).toHaveLength(3);

    const queryCall = ddbMock.commandCalls(QueryCommand)[0];
    expect(queryCall.args[0].input.FilterExpression).toBeUndefined();
  });

  it('should combine status filter with brandId filter', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [mockCampaigns[0], mockCampaigns[1]].map(c => marshall(c)),
      LastEvaluatedKey: undefined
    });

    const result = await Campaign.list(tenantId, {
      status: ['approved', 'awaiting_review'],
      brandId: 'brand_1'
    });

    expect(result.items).toHaveLength(2);
    expect(result.items.every(c => c.brandId === 'brand_1')).toBe(true);
  });

  it('should handle empty status array', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: mockCampaigns.map(c => marshall(c)),
      LastEvaluatedKey: undefined
    });

    const result = await Campaign.list(tenantId, { status: [] });

    expect(result.items).toHaveLength(3);

    const queryCall = ddbMock.commandCalls(QueryCommand)[0];
    expect(queryCall.args[0].input.FilterExpression).toBeUndefined();
  });

  it('should query campaigns with approved and awaiting_review statuses for schedule blending', async () => {
    const approvedCampaign = createMockCampaign('campaign_approved', 'approved');
    const awaitingReviewCampaign = createMockCampaign('campaign_awaiting', 'awaiting_review');
    const rejectedCampaign = createMockCampaign('campaign_rejected', 'rejected');

    ddbMock.on(QueryCommand).resolves({
      Items: [approvedCampaign, awaitingReviewCampaign].map(c => marshall(c)),
      LastEvaluatedKey: undefined
    });

    const result = await Campaign.list(tenantId, {
      status: ['approved', 'awaiting_review']
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0].status).toBe('approved');
    expect(result.items[1].status).toBe('awaiting_review');
    expect(result.items.every(c => ['approved', 'awaiting_review'].includes(c.status))).toBe(true);

    const queryCall = ddbMock.commandCalls(QueryCommand)[0];
    expect(queryCall.args[0].input.FilterExpression).toBe('#status IN (:status0, :status1)');
    expect(queryCall.args[0].input.ExpressionAttributeNames).toEqual({ '#status': 'status' });

    const expressionValues = queryCall.args[0].input.ExpressionAttributeValues;
    expect(expressionValues).toHaveProperty(':status0');
    expect(expressionValues).toHaveProperty(':status1');
  });
});
