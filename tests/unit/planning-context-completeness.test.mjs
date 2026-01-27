import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { buildBrandGuidelinesSection, buildPersonaVoiceSection, buildAssetSection } from '../../functions/agents/campaign-planner.mjs';

vi.mock('@aws-sdk/client-dynamodb');
vi.mock('../../utils/logger.mjs', () => ({
  agentLogger: {
    error: vi.fn()
  },
  brandLogger: {
    error: vi.fn()
  },
  campaignLogger: {
    error: vi.fn()
  }
}));

describe('Feature: brand-asset-ux-integration, Property 4: Planning Context and Metadata Completeness', () => {
  describe('**Validates: Requirements 4.1, 4.5, 6.5, 7.1, 8.2, 8.3**', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    const voiceTraitsArb = fc.record({
      directness: fc.constantFrom('direct', 'reflective'),
      formality: fc.constantFrom('casual', 'formal'),
      opinionation: fc.constantFrom('opinionated', 'neutral')
    });

    const personaIdArb = fc.string({ minLength: 10, maxLength: 20 }).map(s => `persona_${s}`);

    const personaArb = fc.record({
      personaId: personaIdArb,
      name: fc.string({ minLength: 1, maxLength: 100 }),
      role: fc.string({ minLength: 1, maxLength: 100 }),
      company: fc.string({ minLength: 1, maxLength: 100 }),
      primaryAudience: fc.string({ minLength: 1, maxLength: 100 }),
      voiceTraits: fc.oneof(fc.constant(null), voiceTraitsArb),
      ctaComfort: fc.oneof(fc.constant(null), fc.constantFrom('soft', 'medium', 'direct'))
    });

    const brandGuidelinesArb = fc.record({
      voiceGuidelines: fc.oneof(
        fc.constant(null),
        fc.record({
          tone: fc.oneof(
            fc.string({ minLength: 1, maxLength: 50 }),
            fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 })
          )
        })
      ),
      contentStandards: fc.oneof(
        fc.constant(null),
        fc.record({
          restrictions: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 10 })
        })
      ),
      ethos: fc.oneof(fc.constant(null), fc.string({ minLength: 10, maxLength: 500 })),
      visualMotifs: fc.oneof(
        fc.constant(null),
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 10 })
      )
    });

    const usageIntentArb = fc.oneof(
      fc.constant(null),
      fc.record({
        platforms: fc.oneof(
          fc.constant(null),
          fc.array(fc.constantFrom('twitter', 'linkedin', 'instagram', 'facebook'), { minLength: 1, maxLength: 4 })
        ),
        themes: fc.oneof(
          fc.constant(null),
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 })
        ),
        frequency: fc.oneof(fc.constant(null), fc.constantFrom('high', 'medium', 'low'))
      })
    );

    const assetIdArb = fc.string({ minLength: 10, maxLength: 20 }).map(s => `asset_${s}`);

    const assetMetadataArb = fc.record({
      assetId: assetIdArb,
      type: fc.constantFrom('internal', 'external'),
      description: fc.string({ minLength: 10, maxLength: 500 }),
      contentType: fc.constantFrom('image/jpeg', 'image/png', 'video/mp4'),
      source: fc.constantFrom('brand', 'campaign'),
      isDefault: fc.boolean(),
      category: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 100 })),
      usageIntent: usageIntentArb,
      approvalStatus: fc.constant('approved')
    });

    const assetContextArb = fc.record({
      hasAssets: fc.boolean(),
      totalAssets: fc.nat({ max: 50 }),
      availableAssets: fc.array(assetMetadataArb, { minLength: 0, maxLength: 50 }),
      defaultAssets: fc.array(assetMetadataArb, { minLength: 0, maxLength: 10 }),
      hasDefaultAssets: fc.boolean()
    }).chain(context => {
      return fc.constant({
        ...context,
        hasAssets: context.availableAssets.length > 0,
        totalAssets: context.availableAssets.length,
        hasDefaultAssets: context.defaultAssets.length > 0
      });
    });

    it('should provide brand guidelines to campaign planner', () => {
      fc.assert(
        fc.property(brandGuidelinesArb, brandConfig => {
          const guidelinesSection = buildBrandGuidelinesSection(brandConfig);

          expect(guidelinesSection).toBeDefined();
          expect(typeof guidelinesSection).toBe('string');
          expect(guidelinesSection).toContain('BRAND GUIDELINES');

          if (brandConfig?.voiceGuidelines?.tone) {
            expect(guidelinesSection).toContain('Voice Tone');
          }

          if (brandConfig?.contentStandards?.restrictions?.length > 0) {
            expect(guidelinesSection).toContain('Content Restrictions');
          }

          if (brandConfig?.ethos) {
            expect(guidelinesSection).toContain('Brand Ethos');
          }

          if (brandConfig?.visualMotifs?.length > 0) {
            expect(guidelinesSection).toContain('Visual Motifs');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should provide persona voice traits to campaign planner', () => {
      fc.assert(
        fc.property(fc.array(personaArb, { minLength: 1, maxLength: 10 }), personaConfigs => {
          const voiceSection = buildPersonaVoiceSection(personaConfigs);

          expect(voiceSection).toBeDefined();
          expect(typeof voiceSection).toBe('string');
          expect(voiceSection).toContain('PERSONA VOICE TRAITS');

          personaConfigs.forEach(persona => {
            expect(voiceSection).toContain(persona.name);
            expect(voiceSection).toContain(persona.personaId);

            if (persona.voiceTraits) {
              if (persona.voiceTraits.directness) {
                expect(voiceSection).toContain('Directness');
              }
              if (persona.voiceTraits.formality) {
                expect(voiceSection).toContain('Formality');
              }
              if (persona.voiceTraits.opinionation) {
                expect(voiceSection).toContain('Opinionation');
              }
            }

            if (persona.ctaComfort) {
              expect(voiceSection).toContain('CTA Comfort');
            }
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should provide complete asset metadata including usage intent', () => {
      fc.assert(
        fc.property(assetContextArb, assetContext => {
          const assetSection = buildAssetSection(assetContext);

          expect(assetSection).toBeDefined();
          expect(typeof assetSection).toBe('string');
          expect(assetSection).toContain('CONTENT ASSETS');

          if (assetContext.hasAssets) {
            expect(assetSection).toContain('ASSET SELECTION GUIDANCE');
            expect(assetSection).toContain('usage intent');
            expect(assetSection).toContain('DEFAULT');

            assetContext.availableAssets.forEach(asset => {
              expect(assetSection).toContain(asset.description);
              expect(assetSection).toContain(asset.source);

              if (asset.isDefault) {
                expect(assetSection).toContain('DEFAULT (must use)');
              }

              if (asset.category) {
                expect(assetSection).toContain(`Category: ${asset.category}`);
              }

              if (asset.usageIntent) {
                if (asset.usageIntent.platforms?.length > 0) {
                  expect(assetSection).toContain('Platforms');
                }
                if (asset.usageIntent.themes?.length > 0) {
                  expect(assetSection).toContain('Themes');
                }
                if (asset.usageIntent.frequency) {
                  expect(assetSection).toContain('Frequency');
                }
              }
            });
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should include all required context elements in planning prompt', () => {
      fc.assert(
        fc.property(
          brandGuidelinesArb,
          fc.array(personaArb, { minLength: 1, maxLength: 10 }),
          assetContextArb,
          (brandConfig, personaConfigs, assetContext) => {
            const brandGuidelines = buildBrandGuidelinesSection(brandConfig);
            const personaVoice = buildPersonaVoiceSection(personaConfigs);
            const assetSection = buildAssetSection(assetContext);

            expect(brandGuidelines).toBeDefined();
            expect(personaVoice).toBeDefined();
            expect(assetSection).toBeDefined();

            expect(brandGuidelines).toContain('BRAND GUIDELINES');
            expect(personaVoice).toContain('PERSONA VOICE TRAITS');
            expect(assetSection).toContain('CONTENT ASSETS');

            const hasCompleteContext =
              brandGuidelines.length > 0 &&
              personaVoice.length > 0 &&
              assetSection.length > 0;

            expect(hasCompleteContext).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve asset metadata through round-trip operations', () => {
      fc.assert(
        fc.property(assetMetadataArb, asset => {
          const serialized = JSON.stringify(asset);
          const deserialized = JSON.parse(serialized);

          expect(deserialized.assetId).toBe(asset.assetId);
          expect(deserialized.type).toBe(asset.type);
          expect(deserialized.description).toBe(asset.description);
          expect(deserialized.contentType).toBe(asset.contentType);
          expect(deserialized.source).toBe(asset.source);
          expect(deserialized.isDefault).toBe(asset.isDefault);
          expect(deserialized.category).toBe(asset.category);
          expect(deserialized.approvalStatus).toBe(asset.approvalStatus);

          if (asset.usageIntent) {
            expect(deserialized.usageIntent).toEqual(asset.usageIntent);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
