import { describe, it, expect } from 'vitest';
import { getPersonaDefaults } from '../../utils/defaults.mjs';
import { PersonaSchema } from '../../models/persona.mjs';

describe('Persona Defaults Generation', () => {
  describe('Executives Audience', () => {
    it('should return correct defaults for executives audience', () => {
      const defaults = getPersonaDefaults('executives');

      expect(defaults).toEqual({
        voiceTraits: ['strategic', 'authoritative', 'results-oriented'],
        writingHabits: {
          paragraphs: 'medium',
          questions: 'occasional',
          emojis: 'none',
          structure: 'prose'
        },
        opinions: {
          strongBeliefs: ['Leadership drives results'],
          avoidsTopics: []
        },
        language: {
          avoid: ['slang', 'jargon'],
          prefer: ['clear', 'direct', 'professional']
        },
        ctaStyle: {
          aggressiveness: 'medium',
          patterns: ['Learn more', 'Discover how']
        }
      });
    });
  });

  describe('Professionals Audience', () => {
    it('should return correct defaults for professionals audience', () => {
      const defaults = getPersonaDefaults('professionals');

      expect(defaults).toEqual({
        voiceTraits: ['knowledgeable', 'practical', 'collaborative'],
        writingHabits: {
          paragraphs: 'medium',
          questions: 'frequent',
          emojis: 'sparing',
          structure: 'mixed'
        },
        opinions: {
          strongBeliefs: ['Continuous learning matters'],
          avoidsTopics: []
        },
        language: {
          avoid: ['overly formal'],
          prefer: ['conversational', 'clear', 'actionable']
        },
        ctaStyle: {
          aggressiveness: 'medium',
          patterns: ['Check it out', 'Learn more', 'Share your thoughts']
        }
      });
    });
  });

  describe('Consumers Audience', () => {
    it('should return correct defaults for consumers audience', () => {
      const defaults = getPersonaDefaults('consumers');

      expect(defaults).toEqual({
        voiceTraits: ['friendly', 'relatable', 'helpful'],
        writingHabits: {
          paragraphs: 'short',
          questions: 'frequent',
          emojis: 'frequent',
          structure: 'mixed'
        },
        opinions: {
          strongBeliefs: ['Customer experience is everything'],
          avoidsTopics: []
        },
        language: {
          avoid: ['jargon', 'technical terms'],
          prefer: ['simple', 'friendly', 'conversational']
        },
        ctaStyle: {
          aggressiveness: 'high',
          patterns: ['Try it now', 'Get started', 'Shop now']
        }
      });
    });
  });

  describe('Technical Audience', () => {
    it('should return correct defaults for technical audience', () => {
      const defaults = getPersonaDefaults('technical');

      expect(defaults).toEqual({
        voiceTraits: ['precise', 'analytical', 'detail-oriented'],
        writingHabits: {
          paragraphs: 'long',
          questions: 'occasional',
          emojis: 'none',
          structure: 'lists'
        },
        opinions: {
          strongBeliefs: ['Technical accuracy is critical'],
          avoidsTopics: []
        },
        language: {
          avoid: ['marketing speak', 'hype'],
          prefer: ['technical', 'precise', 'data-driven']
        },
        ctaStyle: {
          aggressiveness: 'low',
          patterns: ['Read the docs', 'View details', 'Explore']
        }
      });
    });
  });

  describe('Creative Audience', () => {
    it('should return correct defaults for creative audience', () => {
      const defaults = getPersonaDefaults('creative');

      expect(defaults).toEqual({
        voiceTraits: ['expressive', 'innovative', 'inspiring'],
        writingHabits: {
          paragraphs: 'medium',
          questions: 'frequent',
          emojis: 'frequent',
          structure: 'prose'
        },
        opinions: {
          strongBeliefs: ['Creativity drives innovation'],
          avoidsTopics: []
        },
        language: {
          avoid: ['corporate speak', 'rigid'],
          prefer: ['vivid', 'metaphorical', 'storytelling']
        },
        ctaStyle: {
          aggressiveness: 'medium',
          patterns: ['Get inspired', 'Explore', 'Create with us']
        }
      });
    });
  });

  describe('Invalid Audience', () => {
    it('should throw error for invalid audience type', () => {
      expect(() => getPersonaDefaults('invalid')).toThrow('Invalid primaryAudience: invalid');
    });

    it('should throw error for null audience', () => {
      expect(() => getPersonaDefaults(null)).toThrow('Invalid primaryAudience: null');
    });

    it('should throw error for undefined audience', () => {
      expect(() => getPersonaDefaults(undefined)).toThrow('Invalid primaryAudience: undefined');
    });
  });

  describe('Schema Validation', () => {
    const audiences = ['executives', 'professionals', 'consumers', 'technical', 'creative'];

    audiences.forEach(audience => {
      it(`should return defaults that pass schema validation when combined with required fields for ${audience}`, () => {
        const defaults = getPersonaDefaults(audience);

        const completePersona = {
          personaId: 'persona_test123',
          tenantId: 'tenant_test456',
          name: 'Test Persona',
          role: 'Test Role',
          company: 'Test Company',
          primaryAudience: audience,
          ...defaults,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isActive: true
        };

        expect(() => PersonaSchema.parse(completePersona)).not.toThrow();
      });
    });
  });
});
