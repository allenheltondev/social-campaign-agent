import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Campaign } from '../../models/campaign.mjs';

const simpleCampaignGenerator = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  tenantId: fc.string({ minLength: 1, maxLength: 50 }),
  brandId: fc.oneof(fc.string({ minLength: 1, maxLength: 50 }), fc.constant(null)),
  pk: fc.string({ minLength: 1, maxLength: 100 }),
  sk: fc.constant('campaign'),
  GSI1PK: fc.string({ minLength: 1, maxLength: 50 }),
  GSI1SK: fc.string({ minLength: 1, maxLength: 100 }),
  GSI2PK: fc.string({ minLength: 1, maxLength: 50 }),
  GSI2SK: fc.string({ minLength: 1, maxLength: 100 }),
  name: fc.string({ minLength: 1, maxLength: 200 }),
  status: fc.constantFrom('planning', 'generating', 'completed', 'failed', 'cancelled', 'awaiting_review'),
  createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
  updatedAt: fc.constant('2024-01-01T00:00:00.000Z'),
  completedAt: fc.constant(null),
  brief: fc.constant({
    description: 'Test campaign description for testing purposes',
    objective: 'awareness',
    primaryCTA: null
  }),
  participants: fc.constant({
    personaIds: ['persona1'],
    platforms: ['twitter'],
    distribution: { mode: 'balanced' }
  }),
  schedule: fc.constant({
    timezone: 'UTC',
    startDate: '2024-01-01T00:00:00.000Z',
    endDate: '2024-06-02T00:00:00.000Z',
    allowedDaysOfWeek: ['mon'],
    blackoutDates: null,
    postingWindows: null
  }),
  cadenceOverrides: fc.constant(null),
  messaging: fc.constant(null),
  assetOverrides: fc.constant(null),
  planSummary: fc.constant(null),
  lastError: fc.constant(null),
  metadata: fc.constant({
    source: 'api',
    externalRef: null
  })
});

describe('Campaign DTO Properties', () => {
  describe('Property 2: DTO tenant isolation', () => {
    it('**Feature: data-access-layer-standardization, Property 2: DTO tenant isolation** - **Validates: Requirements 1.2, 2.3**', () => {
      fc.assert(
        fc.property(
          simpleCampaignGenerator,
          (rawCampaign) => {
            try {
              const dto = Campaign._transformFromDynamoDB(rawCampaign);

              expect(dto).not.toHaveProperty('tenantId');
              expect(dto).not.toHaveProperty('pk');
              expect(dto).not.toHaveProperty('sk');
              expect(dto).not.toHaveProperty('GSI1PK');
              expect(dto).not.toHaveProperty('GSI1SK');
              expect(dto).not.toHaveProperty('GSI2PK');
              expect(dto).not.toHaveProperty('GSI2SK');
            } catch (error) {
              console.error('Transformation failed:', error);
              throw error;
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: DTO database key exclusion', () => {
    it('**Feature: data-access-layer-standardization, Property 3: DTO database key exclusion** - **Validates: Requirements 1.3**', () => {
      fc.assert(
        fc.property(
          simpleCampaignGenerator,
          (rawCampaign) => {
            try {
              const dto = Campaign._transformFromDynamoDB(rawCampaign);

              const databaseKeys = ['pk', 'sk', 'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK'];
              databaseKeys.forEach(key => {
                expect(dto).not.toHaveProperty(key);
              });
            } catch (error) {
              console.error('Transformation failed:', error);
              throw error;
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: DTO identifier consistency', () => {
    it('**Feature: data-access-layer-standardization, Property 4: DTO identifier consistency** - **Validates: Requirements 1.4**', () => {
      fc.assert(
        fc.property(
          simpleCampaignGenerator,
          (rawCampaign) => {
            try {
              const dto = Campaign._transformFromDynamoDB(rawCampaign);

              expect(dto).toHaveProperty('id');
              expect(typeof dto.id).toBe('string');
              expect(dto.id.length).toBeGreaterThan(0);
            } catch (error) {
              console.error('Transformation failed:', error);
              throw error;
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
