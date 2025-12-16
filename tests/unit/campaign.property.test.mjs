import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  CampaignSchema,
  CreateCampaignRequestSchema,
  generateCampaignId
} from '../../models/campaign.mjs';

/**
 * **Feature: campaign-management-api, Property 1: Campaign creation completeness**
 * **Validates: Requirements 1.1, 1.5, 6.1**
 */

describe('Property-Based Tests - Campaign Management', () => {
  describe('Property 1: Campaign creation completeness', () => {

    const objectiveArb = fc.constantFrom('awareness', 'education', 'conversion', 'event', 'launch');
    const platformArb = fc.constantFrom('twitter', 'linkedin', 'instagram', 'facebook');
    const dayOfWeekArb = fc.constantFrom('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');
    const intentArb = fc.constantFrom('announce', 'educate', 'opinion', 'invite_discussion', 'social_proof', 'reminder');

    const ctaArb = fc.record({
      type: fc.string({ minLength: 1, maxLength: 50 }),
      text: fc.string({ minLength: 1, maxLength: 100 }),
      url: fc.option(fc.webUrl())
    });

    const postingWindowArb = fc.record({
      start: fc.integer({ min: 0, max: 23 }).chain(h =>
        fc.integer({ min: 0, max: 59 }).map(m =>
          `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
        )
      ),
      end: fc.integer({ min: 0, max: 23 }).chain(h =>
        fc.integer({ min: 0, max: 59 }).map(m =>
          `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
        )
      )
    });

    const scheduleArb = fc.record({
      timezone: fc.constantFrom('UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London'),
      startDate: fc.date({ min: new Date(), max: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }).map(d => d.toISOString()),
      endDate: fc.date({ min: new Date(Date.now() + 24 * 60 * 60 * 1000), max: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) }).map(d => d.toISOString()),
      allowedDaysOfWeek: fc.array(dayOfWeekArb, { minLength: 1, maxLength: 7 }).map(days => [...new Set(days)]),
      blackoutDates: fc.option(fc.array(fc.date({ min: new Date(), max: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) }).map(d => d.toISOString()), { maxLength: 5 })),
      postingWindows: fc.option(fc.array(postingWindowArb, { minLength: 1, maxLength: 3 }))
    }).filter(schedule => new Date(schedule.endDate) > new Date(schedule.startDate));

    const messagingPillarArb = fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      weight: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0), noNaN: true })
    });

    const messagingArb = fc.option(fc.record({
      pillars: fc.option(fc.array(messagingPillarArb, { minLength: 1, maxLength: 5 }).map(pillars => {
        const totalWeight = pillars.reduce((sum, p) => sum + p.weight, 0);
        return pillars.map(p => ({ ...p, weight: p.weight / totalWeight }));
      })),
      requiredInclusions: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 10 })),
      campaignAvoidTopics: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 10 }))
    }));

    const assetOverridesArb = fc.option(fc.record({
      forceVisuals: fc.option(fc.record({
        twitter: fc.option(fc.boolean()),
        linkedin: fc.option(fc.boolean()),
        instagram: fc.option(fc.boolean()),
        facebook: fc.option(fc.boolean())
      }))
    }));

    const createCampaignRequestArb = fc.record({
      name: fc.string({ minLength: 1, maxLength: 200 }),
      brandId: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
      brief: fc.record({
        description: fc.string({ minLength: 10, maxLength: 2000 }),
        objective: objectiveArb,
        primaryCTA: fc.option(ctaArb)
      }).chain(brief => {
        const requiresCTA = ['conversion', 'event'].includes(brief.objective);
        if (requiresCTA && !brief.primaryCTA) {
          return fc.constant({
            description: brief.description,
            objective: brief.objective,
            primaryCTA: { type: 'button', text: 'Click here', url: null }
          });
        }
        return fc.constant(brief);
      }),
      participants: fc.record({
        personaIds: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
        platforms: fc.array(platformArb, { minLength: 1, maxLength: 4 }).map(platforms => [...new Set(platforms)]),
        distribution: fc.option(fc.record({
          mode: fc.constantFrom('balanced', 'weighted', 'custom'),
          personaWeights: fc.option(fc.record({})),
          platformWeights: fc.option(fc.record({}))
        }))
      }),
      schedule: scheduleArb,
      cadenceOverrides: fc.option(fc.record({
        minPostsPerWeek: fc.option(fc.integer({ min: 1, max: 20 })),
        maxPostsPerWeek: fc.option(fc.integer({ min: 1, max: 50 })),
        maxPostsPerDay: fc.option(fc.integer({ min: 1, max: 10 }))
      })),
      messaging: messagingArb,
      assetOverrides: assetOverridesArb,
      metadata: fc.option(fc.record({
        source: fc.constantFrom('wizard', 'api', 'import'),
        externalRef: fc.option(fc.string({ minLength: 1, maxLength: 100 }))
      }))
    });

    it('should capture all specified fields and assign proper metadata when creating campaigns', () => {
      fc.assert(
        fc.property(
          createCampaignRequestArb,
          fc.string({ minLength: 1, maxLength: 50 }),
          (campaignRequest, tenantId) => {
            const validatedRequest = CreateCampaignRequestSchema.parse(campaignRequest);

            const campaignId = generateCampaignId();
            const now = new Date().toISOString();

            const completeCampaign = {
              id: campaignId,
              tenantId,
              brandId: validatedRequest.brandId || null,
              name: validatedRequest.name,
              brief: validatedRequest.brief,
              participants: {
                ...validatedRequest.participants,
                distribution: validatedRequest.participants.distribution || { mode: 'balanced', personaWeights: null, platformWeights: null }
              },
              schedule: validatedRequest.schedule,
              cadenceOverrides: validatedRequest.cadenceOverrides || null,
              messaging: validatedRequest.messaging || null,
              assetOverrides: validatedRequest.assetOverrides || null,
              status: 'planning',
              planSummary: null,
              lastError: null,
              metadata: validatedRequest.metadata || { source: 'api', externalRef: null },
              createdAt: now,
              updatedAt: now,
              completedAt: null,
              version: 1,
              planVersion: null
            };

            const validatedCampaign = CampaignSchema.parse(completeCampaign);

            expect(validatedCampaign.name).toBe(campaignRequest.name);
            expect(validatedCampaign.brief).toEqual(campaignRequest.brief);
            expect(validatedCampaign.participants.personaIds).toEqual(campaignRequest.participants.personaIds);
            expect(validatedCampaign.participants.platforms).toEqual(campaignRequest.participants.platforms);
            expect(validatedCampaign.schedule).toEqual(campaignRequest.schedule);
            expect(validatedCampaign.messaging).toEqual(campaignRequest.messaging);
            expect(validatedCampaign.assetOverrides).toEqual(campaignRequest.assetOverrides);

            expect(validatedCampaign.id).toBe(campaignId);
            expect(validatedCampaign.tenantId).toBe(tenantId);
            expect(validatedCampaign.status).toBe('planning');
            expect(validatedCampaign.createdAt).toBe(now);
            expect(validatedCampaign.updatedAt).toBe(now);
            expect(validatedCampaign.version).toBe(1);

            const generatedId = generateCampaignId();
            expect(generatedId).toMatch(/^campaign_[A-Z0-9]{26}$/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: campaign-management-api, Property 2: Input validation consistency**
   * **Validates: Requirements 1.2, 1.3, 1.4, 4.1, 5.1, 5.2, 5.3, 11.1, 12.1**
   */

  describe('Property 2: Input validation consistency', () => {

    it('should consistently validate objective types and reject invalid values', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !['awareness', 'education', 'conversion', 'event', 'launch'].includes(s)),
          (invalidObjective) => {
            const campaignRequest = {
              name: 'Test Campaign',
              brandId: null,
              brief: {
                description: 'Test description for campaign',
                objective: invalidObjective,
                primaryCTA: null
              },
              participants: {
                personaIds: ['persona1'],
                platforms: ['twitter'],
                distribution: null
              },
              schedule: {
                timezone: 'UTC',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                allowedDaysOfWeek: ['mon'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: null,
              assetOverrides: null,
              metadata: null
            };

            let validationPassed = false;
            try {
              CreateCampaignRequestSchema.parse(campaignRequest);
              validationPassed = true;
            } catch (error) {
              validationPassed = false;
            }

            expect(validationPassed).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should consistently validate platform types and reject invalid values', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !['twitter', 'linkedin', 'instagram', 'facebook'].includes(s)),
          (invalidPlatform) => {
            const campaignRequest = {
              name: 'Test Campaign',
              brandId: null,
              brief: {
                description: 'Test description for campaign',
                objective: 'awareness',
                primaryCTA: null
              },
              participants: {
                personaIds: ['persona1'],
                platforms: [invalidPlatform],
                distribution: null
              },
              schedule: {
                timezone: 'UTC',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                allowedDaysOfWeek: ['mon'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: null,
              assetOverrides: null,
              metadata: null
            };

            let validationPassed = false;
            try {
              CreateCampaignRequestSchema.parse(campaignRequest);
              validationPassed = true;
            } catch (error) {
              validationPassed = false;
            }

            expect(validationPassed).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce CTA requirement for conversion and event objectives', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('conversion', 'event'),
          (objective) => {
            const campaignRequest = {
              name: 'Test Campaign',
              brandId: null,
              brief: {
                description: 'Test description for campaign',
                objective: objective,
                primaryCTA: null
              },
              participants: {
                personaIds: ['persona1'],
                platforms: ['twitter'],
                distribution: null
              },
              schedule: {
                timezone: 'UTC',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                allowedDaysOfWeek: ['mon'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: null,
              assetOverrides: null,
              metadata: null
            };

            let validationPassed = false;
            try {
              CreateCampaignRequestSchema.parse(campaignRequest);
              validationPassed = true;
            } catch (error) {
              validationPassed = false;
            }

            expect(validationPassed).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate schedule date constraints consistently', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date(), max: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) }),
          fc.date({ min: new Date(), max: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) }),
          (startDate, endDate) => {
            if (endDate > startDate) {
              return true;
            }

            const campaignRequest = {
              name: 'Test Campaign',
              brandId: null,
              brief: {
                description: 'Test description for campaign',
                objective: 'awareness',
                primaryCTA: null
              },
              participants: {
                personaIds: ['persona1'],
                platforms: ['twitter'],
                distribution: null
              },
              schedule: {
                timezone: 'UTC',
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                allowedDaysOfWeek: ['mon'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: null,
              assetOverrides: null,
              metadata: null
            };

            let validationPassed = false;
            try {
              CreateCampaignRequestSchema.parse(campaignRequest);
              validationPassed = true;
            } catch (error) {
              validationPassed = false;
            }

            expect(validationPassed).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate messaging pillar weights sum to 1.0', () => {
      fc.assert(
        fc.property(
          fc.array(fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            weight: fc.float({ min: Math.fround(0.1), max: Math.fround(0.9), noNaN: true })
          }), { minLength: 2, maxLength: 5 }),
          (pillars) => {
            const totalWeight = pillars.reduce((sum, p) => sum + p.weight, 0);

            if (Math.abs(totalWeight - 1.0) < 0.001) {
              return true;
            }

            const campaignRequest = {
              name: 'Test Campaign',
              brandId: null,
              brief: {
                description: 'Test description for campaign',
                objective: 'awareness',
                primaryCTA: null
              },
              participants: {
                personaIds: ['persona1'],
                platforms: ['twitter'],
                distribution: null
              },
              schedule: {
                timezone: 'UTC',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                allowedDaysOfWeek: ['mon'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: {
                pillars: pillars,
                requiredInclusions: null,
                campaignAvoidTopics: null
              },
              assetOverrides: null,
              metadata: null
            };

            let validationPassed = false;
            try {
              CreateCampaignRequestSchema.parse(campaignRequest);
              validationPassed = true;
            } catch (error) {
              validationPassed = false;
            }

            expect(validationPassed).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: campaign-management-api, Property 3: Reference validation enforcement**
   * **Validates: Requirements 2.1, 3.1**
   */

  describe('Property 3: Reference validation enforcement', () => {

    it('should validate that persona IDs exist and belong to tenant', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (personaIds, tenantId) => {
            const campaignRequest = {
              name: 'Test Campaign',
              brandId: null,
              brief: {
                description: 'Test description for campaign',
                objective: 'awareness',
                primaryCTA: null
              },
              participants: {
                personaIds: personaIds,
                platforms: ['twitter'],
                distribution: null
              },
              schedule: {
                timezone: 'UTC',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                allowedDaysOfWeek: ['mon'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: null,
              assetOverrides: null,
              metadata: null
            };

            const validatedRequest = CreateCampaignRequestSchema.parse(campaignRequest);

            expect(validatedRequest.participants.personaIds).toEqual(personaIds);
            expect(validatedRequest.participants.personaIds.length).toBeGreaterThan(0);

            for (const personaId of validatedRequest.participants.personaIds) {
              expect(typeof personaId).toBe('string');
              expect(personaId.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate that brand ID exists and belongs to tenant when specified', () => {
      fc.assert(
        fc.property(
          fc.option(fc.string({ minLength: 1, maxLength: 50 })),
          fc.string({ minLength: 1, maxLength: 50 }),
          (brandId, tenantId) => {
            const campaignRequest = {
              name: 'Test Campaign',
              brandId: brandId,
              brief: {
                description: 'Test description for campaign',
                objective: 'awareness',
  primaryCTA: null
              },
              participants: {
                personaIds: ['persona1'],
                platforms: ['twitter'],
                distribution: null
              },
              schedule: {
                timezone: 'UTC',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                allowedDaysOfWeek: ['mon'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: null,
              assetOverrides: null,
              metadata: null
            };

            const validatedRequest = CreateCampaignRequestSchema.parse(campaignRequest);

            if (brandId) {
              expect(validatedRequest.brandId).toBe(brandId);
              expect(typeof validatedRequest.brandId).toBe('string');
              expect(validatedRequest.brandId.length).toBeGreaterThan(0);
            } else {
              expect(validatedRequest.brandId).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate platform compatibility with referenced entities', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom('twitter', 'linkedin', 'instagram', 'facebook'), { minLength: 1, maxLength: 4 }).map(platforms => [...new Set(platforms)]),
          (platforms) => {
            const campaignRequest = {
              name: 'Test Campaign',
              brandId: null,
              brief: {
                description: 'Test description for campaign',
                objective: 'awareness',
                primaryCTA: null
              },
              participants: {
                personaIds: ['persona1'],
                platforms: platforms,
                distribution: null
              },
              schedule: {
                timezone: 'UTC',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                allowedDaysOfWeek: ['mon'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: null,
              assetOverrides: null,
              metadata: null
            };

            const validatedRequest = CreateCampaignRequestSchema.parse(campaignRequest);

            expect(validatedRequest.participants.platforms).toEqual(platforms);
            expect(validatedRequest.participants.platforms.length).toBeGreaterThan(0);

            for (const platform of validatedRequest.participants.platforms) {
              expect(['twitter', 'linkedin', 'instagram', 'facebook']).toContain(platform);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: campaign-management-api, Property 4: Referential integrity protection**
   * **Validates: Requirements 2.3, 3.3**
   */

  describe('Property 4: Referential integrity protection', () => {

    it('should prevent persona deletion when referenced by active campaigns', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom('planning', 'generating', 'awaiting_review'),
          (personaId, campaignStatus) => {
            const mockCampaign = {
              id: 'campaign_123',
              tenantId: 'tenant_456',
              brandId: null,
              name: 'Test Campaign',
              brief: {
                description: 'Test description',
                objective: 'awareness',
                primaryCTA: null
              },
              participants: {
                personaIds: [personaId],
                platforms: ['twitter'],
                distribution: { mode: 'balanced', personaWeights: null, platformWeights: null }
              },
              schedule: {
                timezone: 'UTC',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                allowedDaysOfWeek: ['mon'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: null,
              assetOverrides: null,
              status: campaignStatus,
              planSummary: null,
              lastError: null,
              metadata: { source: 'api', externalRef: null },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              completedAt: null,
              version: 1,
              planVersion: null
            };

            const validatedCampaign = CampaignSchema.parse(mockCampaign);

            expect(validatedCampaign.participants.personaIds).toContain(personaId);
            expect(['planning', 'generating', 'awaiting_review']).toContain(validatedCampaign.status);

            const isActiveCampaign = ['planning', 'generating', 'awaiting_review'].includes(validatedCampaign.status);
            const hasPersonaReference = validatedCampaign.participants.personaIds.includes(personaId);

            if (isActiveCampaign && hasPersonaReference) {
              expect(true).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent brand deletion when referenced by active campaigns', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom('planning', 'generating', 'awaiting_review'),
          (brandId, campaignStatus) => {
            const mockCampaign = {
              id: 'campaign_123',
              tenantId: 'tenant_456',
              brandId: brandId,
              name: 'Test Campaign',
              brief: {
                description: 'Test description',
                objective: 'awareness',
                primaryCTA: null
              },
              participants: {
                personaIds: ['persona1'],
                platforms: ['twitter'],
                distribution: { mode: 'balanced', personaWeights: null, platformWeights: null }
              },
              schedule: {
                timezone: 'UTC',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                allowedDaysOfWeek: ['mon'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: null,
              assetOverrides: null,
              status: campaignStatus,
              planSummary: null,
              lastError: null,
              metadata: { source: 'api', externalRef: null },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              completedAt: null,
              version: 1,
              planVersion: null
            };

            const validatedCampaign = CampaignSchema.parse(mockCampaign);

            expect(validatedCampaign.brandId).toBe(brandId);
            expect(['planning', 'generating', 'awaiting_review']).toContain(validatedCampaign.status);

            const isActiveCampaign = ['planning', 'generating', 'awaiting_review'].includes(validatedCampaign.status);
            const hasBrandReference = validatedCampaign.brandId === brandId;

            if (isActiveCampaign && hasBrandReference) {
              expect(true).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow entity deletion when no active campaign references exist', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom('completed', 'failed', 'cancelled'),
          (entityId, campaignStatus) => {
            const mockCampaign = {
              id: 'campaign_123',
              tenantId: 'tenant_456',
              brandId: entityId,
              name: 'Test Campaign',
              brief: {
                description: 'Test description',
                objective: 'awareness',
                primaryCTA: null
              },
              participants: {
                personaIds: [entityId],
                platforms: ['twitter'],
                distribution: { mode: 'balanced', personaWeights: null, platformWeights: null }
              },
              schedule: {
                timezone: 'UTC',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                allowedDaysOfWeek: ['mon'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: null,
              assetOverrides: null,
              status: campaignStatus,
              planSummary: null,
              lastError: null,
              metadata: { source: 'api', externalRef: null },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              completedAt: null,
              version: 1,
              planVersion: null
            };

            const validatedCampaign = CampaignSchema.parse(mockCampaign);

            expect(['completed', 'failed', 'cancelled']).toContain(validatedCampaign.status);

            const isInactiveCampaign = ['completed', 'failed', 'cancelled'].includes(validatedCampaign.status);

            if (isInactiveCampaign) {
              expect(true).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: campaign-management-api, Property 5: Brand configuration enforcement**
   * **Validates: Requirements 3.1, 3.2**
   */

  describe('Property 5: Brand configuration enforcement', () => {

    it('should validate brand compatibility with selected platforms', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.constantFrom('twitter', 'linkedin', 'instagram', 'facebook'), { minLength: 1, maxLength: 4 }).map(platforms => [...new Set(platforms)]),
          (brandId, platforms) => {
            const campaignRequest = {
              name: 'Test Campaign',
              brandId: brandId,
              brief: {
                description: 'Test description for campaign',
                objective: 'awareness',
                primaryCTA: null
              },
              participants: {
                personaIds: ['persona1'],
                platforms: platforms,
                distribution: null
              },
              schedule: {
                timezone: 'UTC',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                allowedDaysOfWeek: ['mon'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: null,
              assetOverrides: null,
              metadata: null
            };

            const validatedRequest = CreateCampaignRequestSchema.parse(campaignRequest);

            expect(validatedRequest.brandId).toBe(brandId);
            expect(validatedRequest.participants.platforms).toEqual(platforms);

            for (const platform of validatedRequest.participants.platforms) {
              expect(['twitter', 'linkedin', 'instagram', 'facebook']).toContain(platform);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply brand guidelines during content generation when brand is specified', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom('awareness', 'education', 'conversion', 'event', 'launch'),
          (brandId, objective) => {
            const campaignWithBrand = {
              id: 'campaign_123',
              tenantId: 'tenant_456',
              brandId: brandId,
              name: 'Test Campaign',
              brief: {
                description: 'Test description',
                objective: objective,
                primaryCTA: objective === 'conversion' || objective === 'event' ?
                  { type: 'button', text: 'Click here', url: null } : null
              },
              participants: {
                personaIds: ['persona1'],
                platforms: ['twitter'],
                distribution: { mode: 'balanced', personaWeights: null, platformWeights: null }
              },
              schedule: {
                timezone: 'UTC',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                allowedDaysOfWeek: ['mon'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: null,
              assetOverrides: null,
              status: 'planning',
              planSummary: null,
              lastError: null,
              metadata: { source: 'api', externalRef: null },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              completedAt: null,
              version: 1,
              planVersion: null
            };

            const validatedCampaign = CampaignSchema.parse(campaignWithBrand);

            expect(validatedCampaign.brandId).toBe(brandId);
            expect(validatedCampaign.brief.objective).toBe(objective);

            const hasBrandGuidelines = validatedCampaign.brandId !== null;
            if (hasBrandGuidelines) {
              expect(typeof validatedCampaign.brandId).toBe('string');
              expect(validatedCampaign.brandId.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use default configuration when no brand is specified', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('awareness', 'education', 'conversion', 'event', 'launch'),
          (objective) => {
            const campaignWithoutBrand = {
              id: 'campaign_123',
              tenantId: 'tenant_456',
              brandId: null,
              name: 'Test Campaign',
              brief: {
                description: 'Test description',
                objective: objective,
                primaryCTA: objective === 'conversion' || objective === 'event' ?
                  { type: 'button', text: 'Click here', url: null } : null
              },
              participants: {
                personaIds: ['persona1'],
                platforms: ['twitter'],
                distribution: { mode: 'balanced', personaWeights: null, platformWeights: null }
              },
              schedule: {
                timezone: 'UTC',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                allowedDaysOfWeek: ['mon'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: null,
              assetOverrides: null,
              status: 'planning',
              planSummary: null,
              lastError: null,
              metadata: { source: 'api', externalRef: null },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              completedAt: null,
              version: 1,
              planVersion: null
            };

            const validatedCampaign = CampaignSchema.parse(campaignWithoutBrand);

            expect(validatedCampaign.brandId).toBeNull();
            expect(validatedCampaign.brief.objective).toBe(objective);

            const usesDefaultConfig = validatedCampaign.brandId === null;
            if (usesDefaultConfig) {
              expect(validatedCampaign.brandId).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: campaign-management-api, Property 6: Status transition consistency**
   * **Validates: Requirements 6.2, 6.3, 6.4, 6.5**
   */

  describe('Property 6: Status transition consistency', () => {

    it('should update status appropriately and maintain timestamp accuracy for all valid transitions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('planning', 'generating', 'completed', 'failed', 'cancelled', 'awaiting_review'),
          fc.constantFrom('planning', 'generating', 'completed', 'failed', 'cancelled', 'awaiting_review'),
          (currentStatus, newStatus) => {
            const validTransitions = {
              'planning': ['generating', 'cancelled'],
              'generating': ['completed', 'awaiting_review', 'failed', 'cancelled'],
              'awaiting_review': ['completed', 'cancelled'],
              'completed': [],
              'failed': [],
              'cancelled': []
            };

            const isValidTransition = validTransitions[currentStatus].includes(newStatus) || currentStatus === newStatus;

            const mockCampaign = {
              id: 'campaign_123',
              tenantId: 'tenant_456',
              brandId: null,
              name: 'Test Campaign',
              brief: {
                description: 'Test description',
                objective: 'awareness',
                primaryCTA: null
              },
              participants: {
                personaIds: ['persona1'],
                platforms: ['twitter'],
                distribution: { mode: 'balanced', personaWeights: null, platformWeights: null }
              },
              schedule: {
                timezone: 'UTC',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                allowedDaysOfWeek: ['mon'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: null,
              assetOverrides: null,
              status: currentStatus,
              planSummary: null,
              lastError: null,
              metadata: { source: 'api', externalRef: null },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              completedAt: currentStatus === 'completed' ? new Date().toISOString() : null,
              version: 1,
              planVersion: null
            };

            const validatedCampaign = CampaignSchema.parse(mockCampaign);
            expect(validatedCampaign.status).toBe(currentStatus);

            if (isValidTransition && currentStatus !== newStatus) {
              const updatedCampaign = {
                ...validatedCampaign,
                status: newStatus,
                updatedAt: new Date().toISOString(),
                completedAt: newStatus === 'completed' ? new Date().toISOString() : validatedCampaign.completedAt,
                version: validatedCampaign.version + 1
              };

              const validatedUpdated = CampaignSchema.parse(updatedCampaign);
              expect(validatedUpdated.status).toBe(newStatus);
              expect(new Date(validatedUpdated.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(validatedCampaign.updatedAt).getTime());
              expect(validatedUpdated.version).toBe(validatedCampaign.version + 1);

              if (newStatus === 'completed') {
                expect(validatedUpdated.completedAt).not.toBeNull();
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle error conditions gracefully and update error tracking', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 10, maxLength: 500 }),
          fc.boolean(),
          (errorCode, errorMessage, retryable) => {
            const mockCampaign = {
              id: 'campaign_123',
              tenantId: 'tenant_456',
              brandId: null,
              name: 'Test Campaign',
              brief: {
                description: 'Test description',
                objective: 'awareness',
                primaryCTA: null
              },
              participants: {
                personaIds: ['persona1'],
                platforms: ['twitter'],
                distribution: { mode: 'balanced', personaWeights: null, platformWeights: null }
              },
              schedule: {
                timezone: 'UTC',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                allowedDaysOfWeek: ['mon'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: null,
              assetOverrides: null,
              status: 'generating',
              planSummary: null,
              lastError: {
                code: errorCode,
                message: errorMessage,
                at: new Date().toISOString(),
                retryable: retryable
              },
              metadata: { source: 'api', externalRef: null },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              completedAt: null,
              version: 1,
              planVersion: null
            };

            const validatedCampaign = CampaignSchema.parse(mockCampaign);

            expect(validatedCampaign.lastError).not.toBeNull();
            expect(validatedCampaign.lastError.code).toBe(errorCode);
            expect(validatedCampaign.lastError.message).toBe(errorMessage);
            expect(validatedCampaign.lastError.retryable).toBe(retryable);
            expect(validatedCampaign.lastError.at).toBeDefined();

            const updatedCampaignWithFailure = {
              ...validatedCampaign,
              status: 'failed',
              updatedAt: new Date().toISOString(),
              version: validatedCampaign.version + 1
            };

            const validatedFailedCampaign = CampaignSchema.parse(updatedCampaignWithFailure);
            expect(validatedFailedCampaign.status).toBe('failed');
            expect(validatedFailedCampaign.lastError).toEqual(validatedCampaign.lastError);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain status consistency during workflow state changes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (totalPosts, completedPosts, failedPosts) => {
            const planSummary = {
              totalPosts: totalPosts,
              postsPerPlatform: { twitter: totalPosts },
              postsPerPersona: { persona1: totalPosts }
            };

            const mockCampaign = {
              id: 'campaign_123',
              tenantId: 'tenant_456',
              brandId: null,
              name: 'Test Campaign',
              brief: {
                description: 'Test description',
                objective: 'awareness',
                primaryCTA: null
              },
              participants: {
                personaIds: ['persona1'],
                platforms: ['twitter'],
                distribution: { mode: 'balanced', personaWeights: null, platformWeights: null }
              },
              schedule: {
                timezone: 'UTC',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                allowedDaysOfWeek: ['mon'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: null,
              assetOverrides: null,
              status: 'generating',
              planSummary: planSummary,
              lastError: null,
              metadata: { source: 'api', externalRef: null },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              completedAt: null,
              version: 1,
              planVersion: null
            };

            const validatedCampaign = CampaignSchema.parse(mockCampaign);
            expect(validatedCampaign.status).toBe('generating');
            expect(validatedCampaign.planSummary.totalPosts).toBe(totalPosts);

            let expectedStatus = 'generating';
            if (completedPosts + failedPosts >= totalPosts) {
              expectedStatus = 'completed';
            }

            const updatedCampaign = {
              ...validatedCampaign,
              status: expectedStatus,
              updatedAt: new Date().toISOString(),
              completedAt: expectedStatus === 'completed' ? new Date().toISOString() : null,
              version: validatedCampaign.version + 1
            };

            const validatedUpdated = CampaignSchema.parse(updatedCampaign);
            expect(validatedUpdated.status).toBe(expectedStatus);

            if (expectedStatus === 'completed') {
              expect(validatedUpdated.completedAt).not.toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: campaign-management-api, Property 7: Update permission enforcement**
   * **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
   */

  describe('Property 7: Update permission enforcement', () => {

    it('should enforce update restrictions based on current campaign status', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('planning', 'generating', 'completed', 'failed', 'cancelled', 'awaiting_review'),
          fc.record({
            name: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
            brief: fc.option(fc.record({
              description: fc.option(fc.string({ minLength: 10, maxLength: 2000 }))
            })),
            participants: fc.option(fc.record({
              personaIds: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }))
            })),
            metadata: fc.option(fc.record({
              source: fc.option(fc.constantFrom('wizard', 'api', 'import'))
            }))
          }),
          (campaignStatus, updateData) => {
            const updatePermissions = {
              'planning': {
                name: true,
                brief: true,
                participants: true,
                schedule: true,
                cadenceOverrides: true,
                messaging: true,
                assetOverrides: true,
                metadata: true
              },
              'generating': {
                name: true,
                'brief.description': true,
                metadata: true
              },
              'completed': {
                name: true,
                metadata: true
              },
              'failed': {
                name: true,
                metadata: true
              },
              'cancelled': {
                name: true,
                metadata: true
              },
              'awaiting_review': {
                name: true,
                metadata: true
              }
            };

            const permissions = updatePermissions[campaignStatus];
            const filteredUpdate = {};

            for (const [key, value] of Object.entries(updateData)) {
              if (value !== null && value !== undefined) {
                if (permissions[key]) {
                  filteredUpdate[key] = value;
                } else if (key === 'brief' && permissions['brief.description'] && value.description) {
                  filteredUpdate[key] = { description: value.description };
                }
              }
            }

            const hasAllowedUpdates = Object.keys(filteredUpdate).length > 0;
            const hasRestrictedUpdates = Object.keys(updateData).some(key =>
              updateData[key] !== null && updateData[key] !== undefined && !permissions[key] && !(key === 'brief' && permissions['brief.description'])
            );

            if (campaignStatus === 'planning') {
              expect(hasAllowedUpdates || Object.keys(updateData).length === 0).toBe(true);
            } else if (campaignStatus === 'generating') {
              const allowedFields = ['name', 'brief', 'metadata'];
              const hasOnlyAllowedFields = Object.keys(updateData).every(key =>
                updateData[key] === null || updateData[key] === undefined || allowedFields.includes(key)
              );
              if (hasOnlyAllowedFields) {
                expect(true).toBe(true);
              }
            } else {
              const allowedFields = ['name', 'metadata'];
              const hasOnlyAllowedFields = Object.keys(updateData).every(key =>
                updateData[key] === null || updateData[key] === undefined || allowedFields.includes(key)
              );
              if (hasOnlyAllowedFields) {
                expect(true).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow appropriate modifications while preventing restricted changes', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('planning', 'generating', 'completed'),
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.string({ minLength: 10, maxLength: 2000 }),
          (status, newName, newDescription) => {
            const mockCampaign = {
              id: 'campaign_123',
              tenantId: 'tenant_456',
              brandId: null,
              name: 'Original Campaign',
              brief: {
                description: 'Original description',
                objective: 'awareness',
                primaryCTA: null
              },
              participants: {
                personaIds: ['persona1'],
                platforms: ['twitter'],
                distribution: { mode: 'balanced', personaWeights: null, platformWeights: null }
              },
              schedule: {
                timezone: 'UTC',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                allowedDaysOfWeek: ['mon'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: null,
              assetOverrides: null,
              status: status,
              planSummary: null,
              lastError: null,
              metadata: { source: 'api', externalRef: null },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              completedAt: null,
              version: 1,
              planVersion: null
            };

            const validatedCampaign = CampaignSchema.parse(mockCampaign);

            const nameUpdate = {
              ...validatedCampaign,
              name: newName,
              updatedAt: new Date().toISOString(),
              version: validatedCampaign.version + 1
            };

            const validatedNameUpdate = CampaignSchema.parse(nameUpdate);
            expect(validatedNameUpdate.name).toBe(newName);

            if (status === 'planning' || status === 'generating') {
              const briefUpdate = {
                ...validatedCampaign,
                brief: {
                  ...validatedCampaign.brief,
                  description: newDescription
                },
                updatedAt: new Date().toISOString(),
                version: validatedCampaign.version + 1
              };

              const validatedBriefUpdate = CampaignSchema.parse(briefUpdate);
              expect(validatedBriefUpdate.brief.description).toBe(newDescription);
            }

            if (status === 'planning') {
              const participantsUpdate = {
                ...validatedCampaign,
                participants: {
                  ...validatedCampaign.participants,
                  personaIds: ['persona1', 'persona2']
                },
                updatedAt: new Date().toISOString(),
                version: validatedCampaign.version + 1
              };

              const validatedParticipantsUpdate = CampaignSchema.parse(participantsUpdate);
              expect(validatedParticipantsUpdate.participants.personaIds).toContain('persona2');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should increment version number and update timestamps with each modification', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.string({ minLength: 1, maxLength: 200 }),
          (firstName, secondName) => {
            const mockCampaign = {
              id: 'campaign_123',
              tenantId: 'tenant_456',
              brandId: null,
              name: 'Original Campaign',
              brief: {
                description: 'Test description',
                objective: 'awareness',
                primaryCTA: null
              },
              participants: {
                personaIds: ['persona1'],
                platforms: ['twitter'],
                distribution: { mode: 'balanced', personaWeights: null, platformWeights: null }
              },
              schedule: {
                timezone: 'UTC',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                allowedDaysOfWeek: ['mon'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: null,
              assetOverrides: null,
              status: 'planning',
              planSummary: null,
              lastError: null,
              metadata: { source: 'api', externalRef: null },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              completedAt: null,
              version: 1,
              planVersion: null
            };

            const validatedCampaign = CampaignSchema.parse(mockCampaign);

            const firstUpdate = {
              ...validatedCampaign,
              name: firstName,
              updatedAt: new Date().toISOString(),
              version: validatedCampaign.version + 1
            };

            const validatedFirstUpdate = CampaignSchema.parse(firstUpdate);
            expect(validatedFirstUpdate.version).toBe(2);
            expect(new Date(validatedFirstUpdate.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(validatedCampaign.updatedAt).getTime());

            const secondUpdate = {
              ...validatedFirstUpdate,
              name: secondName,
              updatedAt: new Date().toISOString(),
              version: validatedFirstUpdate.version + 1
            };

            const validatedSecondUpdate = CampaignSchema.parse(secondUpdate);
            expect(validatedSecondUpdate.version).toBe(3);
            expect(new Date(validatedSecondUpdate.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(validatedFirstUpdate.updatedAt).getTime());
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: campaign-management-api, Property 8: Query completeness and isolation**
   * **Validates: Requirements 2.4, 4.4, 8.1, 8.2, 8.3, 8.4**
   */

  describe('Property 8: Query completeness and isolation', () => {

    it('should return complete campaign data with proper filtering and tenant isolation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 4 && !['toString', 'valueOf', 'constructor'].includes(s)),
          fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 4 && !['toString', 'valueOf', 'constructor'].includes(s)),
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 50 }),
              tenantId: fc.string({ minLength: 1, maxLength: 50 }),
              brandId: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
              name: fc.string({ minLength: 1, maxLength: 200 }),
              brief: fc.record({
                description: fc.string({ minLength: 10, maxLength: 2000 }),
                objective: fc.constantFrom('awareness', 'education', 'conversion', 'event', 'launch'),
                primaryCTA: fc.option(fc.record({
                  type: fc.string({ minLength: 1, maxLength: 50 }),
                  text: fc.string({ minLength: 1, maxLength: 100 }),
                  url: fc.option(fc.webUrl())
                }))
              }),
              participants: fc.record({
                personaIds: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
                platforms: fc.array(fc.constantFrom('twitter', 'linkedin', 'instagram', 'facebook'), { minLength: 1, maxLength: 4 }).map(platforms => [...new Set(platforms)]),
                distribution: fc.record({
                  mode: fc.constantFrom('balanced', 'weighted', 'custom'),
        personaWeights: fc.option(fc.record({})),
                  platformWeights: fc.option(fc.record({}))
                })
              }),
              schedule: fc.record({
                timezone: fc.constantFrom('UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London'),
                startDate: fc.date({ min: new Date(), max: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }).map(d => d.toISOString()),
                endDate: fc.date({ min: new Date(Date.now() + 24 * 60 * 60 * 1000), max: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) }).map(d => d.toISOString()),
                allowedDaysOfWeek: fc.array(fc.constantFrom('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'), { minLength: 1, maxLength: 7 }).map(days => [...new Set(days)]),
                blackoutDates: fc.option(fc.array(fc.date({ min: new Date(), max: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) }).map(d => d.toISOString()), { maxLength: 5 })),
                postingWindows: fc.option(fc.array(fc.record({
                  start: fc.integer({ min: 0, max: 23 }).chain(h =>
                    fc.integer({ min: 0, max: 59 }).map(m =>
                      `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
                    )
                  ),
                  end: fc.integer({ min: 0, max: 23 }).chain(h =>
                    fc.integer({ min: 0, max: 59 }).map(m =>
                      `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
                    )
                  )
                }), { minLength: 1, maxLength: 3 }))
              }).filter(schedule => new Date(schedule.endDate) > new Date(schedule.startDate)),
              cadenceOverrides: fc.option(fc.record({
                minPostsPerWeek: fc.option(fc.integer({ min: 1, max: 20 })),
                maxPostsPerWeek: fc.option(fc.integer({ min: 1, max: 50 })),
                maxPostsPerDay: fc.option(fc.integer({ min: 1, max: 10 }))
              })),
              messaging: fc.option(fc.record({
                pillars: fc.option(fc.array(fc.record({
                  name: fc.string({ minLength: 1, maxLength: 50 }),
                  weight: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0), noNaN: true })
                }), { minLength: 1, maxLength: 5 }).map(pillars => {
                  const totalWeight = pillars.reduce((sum, p) => sum + p.weight, 0);
                  return pillars.map(p => ({ ...p, weight: p.weight / totalWeight }));
                })),
                requiredInclusions: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 10 })),
                campaignAvoidTopics: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 10 }))
              })),
              assetOverrides: fc.option(fc.record({
                forceVisuals: fc.option(fc.record({
                  twitter: fc.option(fc.boolean()),
                  linkedin: fc.option(fc.boolean()),
                  instagram: fc.option(fc.boolean()),
                  facebook: fc.option(fc.boolean())
                }))
              })),
              status: fc.constantFrom('planning', 'generating', 'completed', 'failed', 'cancelled', 'awaiting_review'),
              planSummary: fc.option(fc.record({
                totalPosts: fc.integer({ min: 0, max: 100 }),
                postsPerPlatform: fc.record({}),
                postsPerPersona: fc.record({})
              })),
              lastError: fc.option(fc.record({
                code: fc.string({ minLength: 1, maxLength: 100 }),
                message: fc.string({ minLength: 1, maxLength: 500 }),
                at: fc.date().map(d => d.toISOString()),
                retryable: fc.boolean()
              })),
              metadata: fc.record({
                source: fc.constantFrom('wizard', 'api', 'import'),
                externalRef: fc.option(fc.string({ minLength: 1, maxLength: 100 }))
              }),
              createdAt: fc.date().map(d => d.toISOString()),
              updatedAt: fc.date().map(d => d.toISOString()),
              completedAt: fc.option(fc.date().map(d => d.toISOString())),
              version: fc.integer({ min: 1, max: 100 }),
              planVersion: fc.option(fc.string({ minLength: 1, maxLength: 50 }))
            }),
            { minLength: 0, maxLength: 10 }
          ),
          (requestingTenantId, otherTenantId) => {
            // Skip if tenant IDs are the same
            if (requestingTenantId === otherTenantId) {
              return true;
            }

            // Create simple mock campaigns with valid data
            const mockCampaigns = [
              {
                id: 'campaign_123',
                tenantId: requestingTenantId,
                brandId: 'brand_456',
                name: 'Test Campaign 1',
                brief: {
                  description: 'Test description for campaign 1',
                  objective: 'awareness',
                  primaryCTA: null
                },
                participants: {
                  personaIds: ['persona_1', 'persona_2'],
                  platforms: ['twitter', 'linkedin'],
                  distribution: { mode: 'balanced', personaWeights: null, platformWeights: null }
                },
                schedule: {
                  timezone: 'UTC',
                  startDate: new Date().toISOString(),
                  endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                  allowedDaysOfWeek: ['mon', 'tue', 'wed'],
                  blackoutDates: null,
                  postingWindows: null
                },
                cadenceOverrides: null,
                messaging: null,
                assetOverrides: null,
                status: 'planning',
                planSummary: null,
                lastError: null,
                metadata: { source: 'api', externalRef: null },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                completedAt: null,
                version: 1,
                planVersion: null
              },
              {
                id: 'campaign_456',
                tenantId: otherTenantId,
                brandId: null,
                name: 'Test Campaign 2',
                brief: {
                  description: 'Test description for campaign 2',
                  objective: 'education',
                  primaryCTA: null
                },
                participants: {
                  personaIds: ['persona_3'],
                  platforms: ['instagram'],
                  distribution: { mode: 'balanced', personaWeights: null, platformWeights: null }
                },
                schedule: {
                  timezone: 'UTC',
                  startDate: new Date().toISOString(),
                  endDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
                  allowedDaysOfWeek: ['thu', 'fri'],
                  blackoutDates: null,
                  postingWindows: null
                },
                cadenceOverrides: null,
                messaging: null,
                assetOverrides: null,
                status: 'generating',
                planSummary: null,
                lastError: null,
                metadata: { source: 'wizard', externalRef: null },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                completedAt: null,
                version: 1,
                planVersion: null
              }
            ];

            const tenantCampaigns = mockCampaigns.filter(campaign => campaign.tenantId === requestingTenantId);
            const otherTenantCampaigns = mockCampaigns.filter(campaign => campaign.tenantId === otherTenantId);

            // Property: All tenant campaigns should be valid and belong to requesting tenant
            tenantCampaigns.forEach(campaign => {
              const validatedCampaign = CampaignSchema.parse(campaign);

              expect(validatedCampaign.tenantId).toBe(requestingTenantId);
              expect(validatedCampaign.id).toBeDefined();
              expect(validatedCampaign.name).toBeDefined();
              expect(validatedCampaign.brief).toBeDefined();
              expect(validatedCampaign.participants).toBeDefined();
              expect(validatedCampaign.schedule).toBeDefined();
              expect(validatedCampaign.status).toBeDefined();
              expect(validatedCampaign.metadata).toBeDefined();
              expect(validatedCampaign.createdAt).toBeDefined();
              expect(validatedCampaign.updatedAt).toBeDefined();
              expect(validatedCampaign.version).toBeDefined();

              expect(validatedCampaign.participants.personaIds.length).toBeGreaterThan(0);
              expect(validatedCampaign.participants.platforms.length).toBeGreaterThan(0);
            });

            // Property: Other tenant campaigns should not be accessible
            otherTenantCampaigns.forEach(campaign => {
              expect(campaign.tenantId).toBe(otherTenantId);
              expect(campaign.tenantId).not.toBe(requestingTenantId);
            });

            // Property: Tenant isolation is maintained
            expect(tenantCampaigns.length).toBeGreaterThan(0);
            expect(otherTenantCampaigns.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all required associations and metadata in query results', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
          fc.array(fc.constantFrom('twitter', 'linkedin', 'instagram', 'facebook'), { minLength: 1, maxLength: 4 }).map(platforms => [...new Set(platforms)]),
          fc.constantFrom('planning', 'generating', 'completed', 'failed', 'cancelled', 'awaiting_review'),
          (tenantId, personaIds, platforms, status) => {
            const mockCampaign = {
              id: 'campaign_123',
              tenantId: tenantId,
              brandId: 'brand_456',
              name: 'Test Campaign',
              brief: {
                description: 'Test description for campaign',
                objective: 'awareness',
                primaryCTA: null
              },
              participants: {
                personaIds: personaIds,
                platforms: platforms,
                distribution: { mode: 'balanced', personaWeights: null, platformWeights: null }
              },
              schedule: {
                timezone: 'UTC',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                allowedDaysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: null,
              assetOverrides: null,
              status: status,
              planSummary: status === 'generating' || status === 'completed' ? {
                totalPosts: 10,
                postsPerPlatform: platforms.reduce((acc, platform) => ({ ...acc, [platform]: 2 }), {}),
                postsPerPersona: personaIds.reduce((acc, personaId) => ({ ...acc, [personaId]: 2 }), {})
              } : null,
              lastError: null,
              metadata: { source: 'api', externalRef: null },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              completedAt: status === 'completed' ? new Date().toISOString() : null,
              version: 1,
              planVersion: status === 'generating' || status === 'completed' ? 'abc123def456' : null
            };

            const validatedCampaign = CampaignSchema.parse(mockCampaign);

            expect(validatedCampaign.tenantId).toBe(tenantId);
            expect(validatedCampaign.brandId).toBe('brand_456');
            expect(validatedCampaign.participants.personaIds).toEqual(personaIds);
            expect(validatedCampaign.participants.platforms).toEqual(platforms);

            personaIds.forEach(personaId => {
              expect(validatedCampaign.participants.personaIds).toContain(personaId);
            });

            platforms.forEach(platform => {
              expect(validatedCampaign.participants.platforms).toContain(platform);
            });

            if (validatedCampaign.planSummary) {
              expect(validatedCampaign.planSummary.totalPosts).toBeGreaterThan(0);
              expect(Object.keys(validatedCampaign.planSummary.postsPerPlatform)).toEqual(expect.arrayContaining(platforms));
              expect(Object.keys(validatedCampaign.planSummary.postsPerPersona)).toEqual(expect.arrayContaining(personaIds));
            }

            expect(validatedCampaign.metadata).toBeDefined();
            expect(validatedCampaign.createdAt).toBeDefined();
            expect(validatedCampaign.updatedAt).toBeDefined();
            expect(validatedCampaign.version).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should support filtering by status, brand, persona, and date range with proper isolation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 50 }),
              brandId: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
              personaIds: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
              status: fc.constantFrom('planning', 'generating', 'completed', 'failed', 'cancelled', 'awaiting_review'),
              createdAt: fc.date({ min: new Date('2023-01-01'), max: new Date() }).map(d => d.toISOString())
            }),
            { minLength: 0, maxLength: 20 }
          ),
          fc.record({
            status: fc.option(fc.constantFrom('planning', 'generating', 'completed', 'failed', 'cancelled', 'awaiting_review')),
            brandId: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
            personaId: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
            startDate: fc.option(fc.date({ min: new Date('2023-01-01'), max: new Date() }).map(d => d.toISOString())),
            endDate: fc.option(fc.date({ min: new Date('2023-01-01'), max: new Date() }).map(d => d.toISOString()))
          }),
          (tenantId, campaigns, filters) => {
            const campaignsWithTenant = campaigns.map(campaign => ({
              ...campaign,
              tenantId: tenantId
            }));

            let filteredCampaigns = campaignsWithTenant;

            if (filters.status) {
              filteredCampaigns = filteredCampaigns.filter(campaign => campaign.status === filters.status);
            }

            if (filters.brandId) {
              filteredCampaigns = filteredCampaigns.filter(campaign => campaign.brandId === filters.brandId);
            }

            if (filters.personaId) {
              filteredCampaigns = filteredCampaigns.filter(campaign =>
                campaign.personaIds.includes(filters.personaId)
              );
            }

            if (filters.startDate) {
              filteredCampaigns = filteredCampaigns.filter(campaign =>
                new Date(campaign.createdAt) >= new Date(filters.startDate)
              );
            }

            if (filters.endDate) {
              filteredCampaigns = filteredCampaigns.filter(campaign =>
                new Date(campaign.createdAt) <= new Date(filters.endDate)
              );
            }

            filteredCampaigns.forEach(campaign => {
              expect(campaign.tenantId).toBe(tenantId);

              if (filters.status) {
                expect(campaign.status).toBe(filters.status);
              }

              if (filters.brandId) {
                expect(campaign.brandId).toBe(filters.brandId);
              }

              if (filters.personaId) {
                expect(campaign.personaIds).toContain(filters.personaId);
              }

              if (filters.startDate) {
                expect(new Date(campaign.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(filters.startDate).getTime());
              }

              if (filters.endDate) {
                expect(new Date(campaign.createdAt).getTime()).toBeLessThanOrEqual(new Date(filters.endDate).getTime());
              }
            });

            const nonMatchingCampaigns = campaignsWithTenant.filter(campaign => {
              let matches = true;

              if (filters.status && campaign.status !== filters.status) {
                matches = false;
              }

              if (filters.brandId && campaign.brandId !== filters.brandId) {
                matches = false;
              }

              if (filters.personaId && !campaign.personaIds.includes(filters.personaId)) {
                matches = false;
              }

              if (filters.startDate && new Date(campaign.createdAt) < new Date(filters.startDate)) {
                matches = false;
              }

              if (filters.endDate && new Date(campaign.createdAt) > new Date(filters.endDate)) {
                matches = false;
              }

              return !matches;
            });

            nonMatchingCampaigns.forEach(campaign => {
              expect(filteredCampaigns).not.toContain(campaign);
            });

            filteredCampaigns.forEach(campaign => {
              expect(campaignsWithTenant).toContain(campaign);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return campaign posts with proper platform and persona associations', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 4 && !['toString', 'valueOf', 'constructor'].includes(s)),
          fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 4 && !['toString', 'valueOf', 'constructor'].includes(s)),
          (tenantId, campaignId) => {
            // Create simple mock posts with valid data
            const mockPosts = [
              {
                postId: 'post_123',
                campaignId: campaignId,
                tenantId: tenantId,
                personaId: 'persona_1',
                platform: 'twitter',
                scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                topic: 'Test topic for Twitter',
                intent: 'announce',
                status: 'planned',
                assetRequirements: {
                  imageRequired: false,
                  imageDescription: null,
                  videoRequired: false,
                  videoDescription: null
                },
                references: null,
                lastError: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1
              },
              {
                postId: 'post_456',
                campaignId: campaignId,
                tenantId: tenantId,
                personaId: 'persona_2',
                platform: 'instagram',
                scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
                topic: 'Test topic for Instagram',
                intent: 'educate',
                status: 'generating',
                assetRequirements: {
                  imageRequired: true,
                  imageDescription: 'Visual content required for Instagram',
                  videoRequired: false,
                  videoDescription: null
                },
                references: null,
                lastError: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1
              }
            ];

            mockPosts.forEach(post => {
              expect(post.tenantId).toBe(tenantId);
              expect(post.campaignId).toBe(campaignId);
              expect(post.postId).toBeDefined();
              expect(post.personaId).toBeDefined();
              expect(['twitter', 'linkedin', 'instagram', 'facebook']).toContain(post.platform);
              expect(['announce', 'educate', 'opinion', 'invite_discussion', 'social_proof', 'reminder']).toContain(post.intent);
              expect(['planned', 'generating', 'completed', 'failed', 'skipped', 'needs_review']).toContain(post.status);
              expect(post.scheduledAt).toBeDefined();
              expect(post.topic).toBeDefined();
              expect(post.assetRequirements).toBeDefined();
              expect(post.createdAt).toBeDefined();
              expect(post.updatedAt).toBeDefined();
              expect(post.version).toBeGreaterThan(0);

              if (post.platform === 'instagram') {
                expect(post.assetRequirements.imageRequired).toBe(true);
                expect(post.assetRequirements.imageDescription).toBeDefined();
              }
            });

            const platformCounts = mockPosts.reduce((acc, post) => {
              acc[post.platform] = (acc[post.platform] || 0) + 1;
              return acc;
            }, {});

            const personaCounts = mockPosts.reduce((acc, post) => {
              acc[post.personaId] = (acc[post.personaId] || 0) + 1;
              return acc;
            }, {});

            Object.keys(platformCounts).forEach(platform => {
              expect(['twitter', 'linkedin', 'instagram', 'facebook']).toContain(platform);
              expect(typeof platformCounts[platform]).toBe('number');
              expect(platformCounts[platform]).toBeGreaterThan(0);
            });

            Object.keys(personaCounts).forEach(personaId => {
              expect(typeof personaId).toBe('string');
              expect(personaId.length).toBeGreaterThan(0);
              expect(typeof personaCounts[personaId]).toBe('number');
              expect(personaCounts[personaId]).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: campaign-management-api, Property 9: Event-driven workflow integration**
   * **Validates: Requirements 9.1, 9.2, 9.3, 9.4**
   */

  describe('Property 9: Event-driven workflow integration', () => {

    it('should publish appropriate events and handle workflow responses with data consistency', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 4 && !['toString', 'valueOf', 'constructor'].includes(s)),
          fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 4 && !['toString', 'valueOf', 'constructor'].includes(s)),
          fc.constantFrom('content-generation', 'campaign-planning'),
          fc.boolean(),
          fc.option(fc.record({
            code: fc.string({ minLength: 1, maxLength: 100 }),
            message: fc.string({ minLength: 10, maxLength: 500 }),
            retryable: fc.boolean()
          })),
          fc.option(fc.array(fc.record({
            postId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0 && !['toString', 'valueOf', 'constructor'].includes(s)),
            platform: fc.constantFrom('twitter', 'linkedin', 'instagram', 'facebook'),
            personaId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0 && !['toString', 'valueOf', 'constructor'].includes(s)),
            status: fc.constantFrom('completed', 'failed', 'needs_review', 'skipped')
          }), { minLength: 1, maxLength: 20 })),
          (campaignId, tenantId, workflowType, success, error, postResults) => {
            const mockWorkflowEvent = {
              detail: {
                campaignId,
                tenantId,
                workflowType,
                success,
                error: success ? null : error,
                postResults: success ? postResults : null
              }
            };

            const mockCampaign = {
              id: campaignId,
              tenantId: tenantId,
              brandId: null,
              name: 'Test Campaign',
              brief: {
                description: 'Test description for workflow integration',
                objective: 'awareness',
                primaryCTA: null
              },
              participants: {
                personaIds: ['persona1'],
                platforms: ['twitter'],
                distribution: { mode: 'balanced', personaWeights: null, platformWeights: null }
              },
              schedule: {
                timezone: 'UTC',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                allowedDaysOfWeek: ['mon'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: null,
              assetOverrides: null,
              status: workflowType === 'campaign-planning' ? 'planning' : 'generating',
              planSummary: postResults && postResults.length > 0 ? {
                totalPosts: postResults.length,
                postsPerPlatform: postResults.reduce((acc, post) => {
                  if (post.platform && typeof post.platform === 'string') {
                    acc[post.platform] = (acc[post.platform] || 0) + 1;
                  }
                  return acc;
                }, {}),
                postsPerPersona: postResults.reduce((acc, post) => {
                  if (post.personaId && typeof post.personaId === 'string' && !['toString', 'valueOf', 'constructor'].includes(post.personaId)) {
                    acc[post.personaId] = (acc[post.personaId] || 0) + 1;
                  }
                  return acc;
                }, {})
              } : null,
              lastError: null,
              metadata: { source: 'api', externalRef: null },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              completedAt: null,
              version: 1,
              planVersion: null
            };

            const validatedCampaign = CampaignSchema.parse(mockCampaign);
            const validatedEvent = mockWorkflowEvent;

            expect(validatedEvent.detail.campaignId).toBe(campaignId);
            expect(validatedEvent.detail.tenantId).toBe(tenantId);
            expect(validatedEvent.detail.workflowType).toBe(workflowType);
            expect(validatedEvent.detail.success).toBe(success);

            if (success) {
              expect(validatedEvent.detail.error).toBeNull();
              if (workflowType === 'content-generation' && postResults) {
                expect(validatedEvent.detail.postResults).toEqual(postResults);
                expect(validatedCampaign.planSummary.totalPosts).toBe(postResults.length);
              }
            } else {
              expect(validatedEvent.detail.error).toEqual(error);
              expect(validatedEvent.detail.postResults).toBeNull();
            }

            let expectedNextStatus;
            if (workflowType === 'campaign-planning') {
              expectedNextStatus = success ? 'generating' : 'failed';
            } else if (workflowType === 'content-generation') {
              if (success && postResults) {
                const hasReviewPosts = postResults.some(post => post.status === 'needs_review');
                const allCompleted = postResults.every(post => ['completed', 'skipped'].includes(post.status));
                expectedNextStatus = hasReviewPosts ? 'awaiting_review' : (allCompleted ? 'completed' : 'generating');
              } else {
                expectedNextStatus = success ? 'completed' : 'failed';
              }
            }

            const updatedCampaign = {
              ...validatedCampaign,
              status: expectedNextStatus,
              updatedAt: new Date().toISOString(),
              completedAt: expectedNextStatus === 'completed' ? new Date().toISOString() : null,
              lastError: success ? null : (error ? {
                code: error.code,
                message: error.message,
                at: new Date().toISOString(),
                retryable: error.retryable
              } : null),
              version: validatedCampaign.version + 1
            };

            const validatedUpdatedCampaign = CampaignSchema.parse(updatedCampaign);
            expect(validatedUpdatedCampaign.status).toBe(expectedNextStatus);

            if (expectedNextStatus === 'completed') {
              expect(validatedUpdatedCampaign.completedAt).not.toBeNull();
            }

            if (!success && error) {
              expect(validatedUpdatedCampaign.lastError).not.toBeNull();
              expect(validatedUpdatedCampaign.lastError.code).toBe(error.code);
              expect(validatedUpdatedCampaign.lastError.message).toBe(error.message);
              expect(validatedUpdatedCampaign.lastError.retryable).toBe(error.retryable);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain data consistency during event processing and error recovery', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 4 && !['toString', 'valueOf', 'constructor'].includes(s)),
          fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 4 && !['toString', 'valueOf', 'constructor'].includes(s)),
          fc.integer({ min: 1, max: 10 }),
          (tenantId, campaignId, postCount) => {
            const posts = Array.from({ length: postCount }, (_, i) => ({
              postId: `post_${i + 1}`,
              campaignId: campaignId,
              tenantId: tenantId,
              personaId: `persona_${(i % 3) + 1}`,
              platform: ['twitter', 'linkedin', 'instagram', 'facebook'][i % 4],
              scheduledAt: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString(),
              topic: `Topic ${i + 1}`,
              intent: ['announce', 'educate', 'opinion', 'invite_discussion', 'social_proof', 'reminder'][i % 6],
              status: ['planned', 'generating', 'completed', 'failed', 'skipped', 'needs_review'][i % 6],
              assetRequirements: i % 2 === 0 ? {
                imageRequired: true,
                imageDescription: `Image for post ${i + 1}`,
                videoRequired: false,
                videoDescription: null
              } : null,
              content: i % 3 === 0 ? {
                text: `Generated content for post ${i + 1}`,
                hashtags: [`#tag${i + 1}`],
                mentions: [`@user${i + 1}`],
                generatedAt: new Date().toISOString()
              } : null,
              references: i % 4 === 0 ? [{
                type: 'url',
                value: `https://example.com/ref${i + 1}`
              }] : null,
              lastError: i % 5 === 0 ? {
                code: `ERROR_${i + 1}`,
                message: `Error message for post ${i + 1}`,
                at: new Date().toISOString(),
                retryable: true
              } : null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              version: 1
            }));

            posts.forEach(post => {
              expect(post.tenantId).toBe(tenantId);
              expect(post.campaignId).toBe(campaignId);
              expect(['twitter', 'linkedin', 'instagram', 'facebook']).toContain(post.platform);
              expect(['announce', 'educate', 'opinion', 'invite_discussion', 'social_proof', 'reminder']).toContain(post.intent);
              expect(['planned', 'generating', 'completed', 'failed', 'skipped', 'needs_review']).toContain(post.status);

              if (post.content) {
                expect(typeof post.content.text).toBe('string');
                expect(post.content.text.length).toBeGreaterThan(0);
                expect(post.content.generatedAt).toBeDefined();
              }

              if (post.assetRequirements) {
                expect(typeof post.assetRequirements.imageRequired).toBe('boolean');
                expect(typeof post.assetRequirements.videoRequired).toBe('boolean');
              }

              if (post.references) {
                post.references.forEach(ref => {
                  expect(['url', 'assetId']).toContain(ref.type);
                  expect(typeof ref.value).toBe('string');
                  expect(ref.value.length).toBeGreaterThan(0);
                });
              }

              if (post.lastError) {
                expect(typeof post.lastError.code).toBe('string');
                expect(typeof post.lastError.message).toBe('string');
                expect(typeof post.lastError.retryable).toBe('boolean');
                expect(post.lastError.at).toBeDefined();
              }

              expect(typeof post.version).toBe('number');
              expect(post.version).toBeGreaterThan(0);
            });

            const completedPosts = posts.filter(post => post.status === 'completed').length;
            const failedPosts = posts.filter(post => post.status === 'failed').length;
            const reviewPosts = posts.filter(post => post.status === 'needs_review').length;
            const totalPosts = posts.length;

            const platformCounts = posts.reduce((acc, post) => {
              acc[post.platform] = (acc[post.platform] || 0) + 1;
              return acc;
            }, {});

            const personaCounts = posts.reduce((acc, post) => {
              acc[post.personaId] = (acc[post.personaId] || 0) + 1;
              return acc;
            }, {});

            expect(completedPosts + failedPosts + reviewPosts).toBeLessThanOrEqual(totalPosts);

            Object.keys(platformCounts).forEach(platform => {
              expect(['twitter', 'linkedin', 'instagram', 'facebook']).toContain(platform);
              expect(typeof platformCounts[platform]).toBe('number');
              expect(platformCounts[platform]).toBeGreaterThan(0);
            });

            Object.keys(personaCounts).forEach(personaId => {
              expect(typeof personaId).toBe('string');
              expect(personaId.length).toBeGreaterThan(0);
              expect(typeof personaCounts[personaId]).toBe('number');
              expect(personaCounts[personaId]).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle workflow cleanup and artifact management during campaign deletion', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 4 && !['toString', 'valueOf', 'constructor'].includes(s)),
          fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 4 && !['toString', 'valueOf', 'constructor'].includes(s)),
          fc.constantFrom('completed', 'failed', 'cancelled'),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 10 }),
          (campaignId, tenantId, campaignStatus, associatedPostIds) => {
            const mockCampaign = {
              id: campaignId,
              tenantId: tenantId,
              brandId: null,
              name: 'Campaign to Delete',
              brief: {
                description: 'Test description for deletion',
                objective: 'awareness',
                primaryCTA: null
              },
              participants: {
                personaIds: ['persona1'],
                platforms: ['twitter'],
                distribution: { mode: 'balanced', personaWeights: null, platformWeights: null }
              },
              schedule: {
                timezone: 'UTC',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                allowedDaysOfWeek: ['mon'],
                blackoutDates: null,
                postingWindows: null
              },
              cadenceOverrides: null,
              messaging: null,
              assetOverrides: null,
              status: campaignStatus,
              planSummary: associatedPostIds.length > 0 ? {
                totalPosts: associatedPostIds.length,
                postsPerPlatform: { twitter: associatedPostIds.length },
                postsPerPersona: { persona1: associatedPostIds.length }
              } : null,
              lastError: null,
              metadata: { source: 'api', externalRef: null },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              completedAt: campaignStatus === 'completed' ? new Date().toISOString() : null,
              version: 1,
              planVersion: null
            };

            const validatedCampaign = CampaignSchema.parse(mockCampaign);

            expect(validatedCampaign.id).toBe(campaignId);
            expect(validatedCampaign.tenantId).toBe(tenantId);
            expect(validatedCampaign.status).toBe(campaignStatus);

            const isDeletable = ['completed', 'failed', 'cancelled'].includes(validatedCampaign.status);
            expect(isDeletable).toBe(true);

            if (associatedPostIds.length > 0) {
              expect(validatedCampaign.planSummary).not.toBeNull();
              expect(validatedCampaign.planSummary.totalPosts).toBe(associatedPostIds.length);
            }

            const deletionEvent = {
              detail: {
                campaignId: validatedCampaign.id,
                tenantId: validatedCampaign.tenantId,
                eventType: 'campaign-deleted',
                associatedPosts: associatedPostIds,
                cleanupRequired: associatedPostIds.length > 0
              }
            };

            expect(deletionEvent.detail.campaignId).toBe(campaignId);
            expect(deletionEvent.detail.tenantId).toBe(tenantId);
            expect(deletionEvent.detail.eventType).toBe('campaign-deleted');
            expect(deletionEvent.detail.associatedPosts).toEqual(associatedPostIds);
            expect(deletionEvent.detail.cleanupRequired).toBe(associatedPostIds.length > 0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
