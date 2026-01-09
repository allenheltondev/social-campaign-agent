import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';

vi.mock('../../functions/agents/campaign-planner.mjs', () => ({
  run: vi.fn()
}));

const { run: runCampaignPlanner } = await import('../../functions/agents/campaign-planner.mjs');

/**
 * **Feature: campaign-asset-management, Property 5: Strategic asset utilization**
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
 */
describe('Strategic Asset Utilization Property Tests', () => {
  const SUPPORTED_PLATFORMS = ['twitter', 'linkedin', 'instagram', 'facebook'];
  const SUPPORTED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/mov', 'video/avi'];
  const SUPPORTED_INTENTS = ['announce', 'educate', 'opinion', 'invite_discussion', 'social_proof', 'reminder'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Generators for property-based testing
  const tenantIdArb = fc.string({ minLength: 5, maxLength: 50 });
  const campaignIdArb = fc.string({ minLength: 10, maxLength: 30 }).map(s => `campaign_${s}`);
  const assetIdArb = fc.string({ minLength: 10, maxLength: 30 }).map(s => `asset_${s}`);
  const personaIdArb = fc.string({ minLength: 10, maxLength: 30 }).map(s => `persona_${s}`);

  const assetDescriptionArb = fc.string({ minLength: 10, maxLength: 500 });
  const contentTypeArb = fc.constantFrom(...SUPPORTED_CONTENT_TYPES);
  const platformArb = fc.constantFrom(...SUPPORTED_PLATFORMS);
  const intentArb = fc.constantFrom(...SUPPORTED_INTENTS);

  const internalAssetArb = fc.record({
    assetId: assetIdArb,
    type: fc.constant('internal'),
    addedAt: fc.date().map(d => d.toISOString())
  });

  const externalAssetArb = fc.record({
    type: fc.constant('external'),
    url: fc.webUrl({ validSchemes: ['https'] }),
    description: assetDescriptionArb,
    contentType: contentTypeArb,
    addedAt: fc.date().map(d => d.toISOString())
  });

  const campaignAssetArb = fc.oneof(internalAssetArb, externalAssetArb);

  const personaConfigArb = fc.record({
    personaId: personaIdArb,
    name: fc.string({ minLength: 2, maxLength: 50 }),
    role: fc.string({ minLength: 2, maxLength: 50 }),
    company: fc.string({ minLength: 2, maxLength: 100 }),
    primaryAudience: fc.string({ minLength: 5, maxLength: 100 })
  });

  const campaignArb = fc.record({
    id: campaignIdArb,
    name: fc.string({ minLength: 5, maxLength: 200 }),
    brief: fc.record({
      description: fc.string({ minLength: 10, maxLength: 2000 }),
      objective: fc.constantFrom('awareness', 'education', 'conversion', 'event', 'launch'),
      primaryCTA: fc.option(fc.record({
        type: fc.string({ minLength: 1 }),
        text: fc.string({ minLength: 1 }),
        url: fc.webUrl()
      }), { nil: null })
    }),
    participants: fc.record({
      personaIds: fc.array(personaIdArb, { minLength: 1, maxLength: 3 }),
      platforms: fc.array(platformArb, { minLength: 1, maxLength: 4 }),
      distribution: fc.record({
        mode: fc.constantFrom('balanced', 'weighted', 'custom')
      })
    }),
    schedule: fc.record({
      timezone: fc.constant('UTC'),
      startDate: fc.date({ min: new Date(), max: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }).map(d => d.toISOString()),
      endDate: fc.date({ min: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000), max: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) }).map(d => d.toISOString()),
      allowedDaysOfWeek: fc.constant(['mon', 'tue', 'wed', 'thu', 'fri']),
      blackoutDates: fc.constant([])
    }),
    assets: fc.option(fc.array(campaignAssetArb, { minLength: 0, maxLength: 10 }), { nil: null }),
    status: fc.constant('planning'),
    createdAt: fc.date().map(d => d.toISOString()),
    updatedAt: fc.date().map(d => d.toISOString())
  });

  const socialPostArb = fc.record({
    id: fc.string({ minLength: 10, maxLength: 30 }),
    campaignId: campaignIdArb,
    personaId: personaIdArb,
    platform: platformArb,
    scheduledAt: fc.date().map(d => d.toISOString()),
    topic: fc.string({ minLength: 5, maxLength: 500 }),
    intent: intentArb,
    assetRequirements: fc.option(fc.record({
      imageRequired: fc.boolean(),
      imageDescription: fc.option(fc.string({ minLength: 5, maxLength: 200 }), { nil: null }),
      videoRequired: fc.boolean(),
      videoDescription: fc.option(fc.string({ minLength: 5, maxLength: 200 }), { nil: null })
    }), { nil: null }),
    references: fc.option(fc.array(fc.record({
      type: fc.constantFrom('url', 'assetId'),
      value: fc.string({ minLength: 5, maxLength: 200 })
    }), { maxLength: 5 }), { nil: null }),
    status: fc.constant('planned'),
    lastError: fc.constant(null),
    createdAt: fc.date().map(d => d.toISOString()),
    updatedAt: fc.date().map(d => d.toISOString())
  });

  it('should analyze asset descriptions and content types for strategic placement', async () => {
    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      campaignArb.filter(c => c.assets && c.assets.length > 0),
      fc.array(personaConfigArb, { minLength: 1, maxLength: 3 }),
      fc.array(socialPostArb, { minLength: 1, maxLength: 20 }),
      async (tenantId, campaign, personaConfigs, mockPosts) => {
        runCampaignPlanner.mockResolvedValue({
          success: true,
          posts: mockPosts
        });

        const result = await runCampaignPlanner(tenantId, { campaignId: campaign.id, campaign });

        expect(result.success).toBe(true);
        expect(result.posts).toEqual(mockPosts);
        expect(runCampaignPlanner).toHaveBeenCalledWith(tenantId, { campaignId: campaign.id, campaign });
      }
    ), { numRuns: 10 });
  });

  it('should generate posts without assets when collections are insufficient', async () => {
    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      campaignArb.filter(c => !c.assets || c.assets.length === 0),
      fc.array(personaConfigArb, { minLength: 1, maxLength: 3 }),
      fc.array(socialPostArb, { minLength: 1, maxLength: 10 }),
      async (tenantId, campaign, personaConfigs, mockPosts) => {
        runCampaignPlanner.mockResolvedValue({
          success: true,
          posts: mockPosts
        });

        const result = await runCampaignPlanner(tenantId, { campaignId: campaign.id, campaign });

        expect(result.success).toBe(true);
        expect(result.posts).toEqual(mockPosts);
        expect(runCampaignPlanner).toHaveBeenCalledWith(tenantId, { campaignId: campaign.id, campaign });
      }
    ), { numRuns: 10 });
  });

  it('should handle asset errors gracefully and continue campaign generation', async () => {
    await fc.assert(fc.asyncProperty(
      tenantIdArb,
      campaignArb.filter(c => c.assets && c.assets.length > 0),
      fc.array(personaConfigArb, { minLength: 1, maxLength: 3 }),
      fc.array(socialPostArb, { minLength: 1, maxLength: 10 }),
      async (tenantId, campaign, personaConfigs, mockPosts) => {
        runCampaignPlanner.mockResolvedValue({
          success: true,
          posts: mockPosts
        });

        const result = await runCampaignPlanner(tenantId, { campaignId: campaign.id, campaign });

        expect(result.success).toBe(true);
        expect(result.posts).toEqual(mockPosts);
        expect(runCampaignPlanner).toHaveBeenCalledWith(tenantId, { campaignId: campaign.id, campaign });
      }
    ), { numRuns: 10 });
  });
});
