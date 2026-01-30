import { describe, it, expect } from 'vitest';
import { PersonaSchema } from '../../models/persona.mjs';

describe('Persona Schemas', () => {
  describe('PersonaSchema with inline transformations', () => {
    it('should validate a minimal persona creation request with only required fields', () => {
      const createSchema = PersonaSchema.pick({
        name: true,
        role: true,
        company: true,
        primaryAudience: true
      });

      const minimalPersona = {
        name: 'John Doe',
        role: 'Marketing Manager',
        company: 'Tech Corp',
        primaryAudience: 'professionals'
      };

      expect(() => createSchema.parse(minimalPersona)).not.toThrow();
    });

    it('should validate a complete persona creation request', () => {
      const createSchema = PersonaSchema.pick({
        name: true,
        role: true,
        company: true,
        primaryAudience: true,
        voiceTraits: true,
        writingHabits: true,
        opinions: true,
        language: true,
        ctaStyle: true
      });

      const validPersona = {
        name: 'John Doe',
        role: 'Marketing Manager',
        company: 'Tech Corp',
        primaryAudience: 'professionals',
        voiceTraits: ['direct', 'warm'],
        writingHabits: {
          paragraphs: 'medium',
          questions: 'occasional',
          emojis: 'sparing',
          structure: 'mixed'
        },
        opinions: {
          strongBeliefs: ['Innovation drives success'],
          avoidsTopics: ['politics']
        },
        language: {
          avoid: ['jargon'],
          prefer: ['clear language']
        },
        ctaStyle: {
          aggressiveness: 'medium',
          patterns: ['ask_question']
        }
      };

      expect(() => createSchema.parse(validPersona)).not.toThrow();
    });

    it('should reject persona with too many strong beliefs', () => {
      const createSchema = PersonaSchema.pick({
        name: true,
        role: true,
        company: true,
        primaryAudience: true,
        voiceTraits: true,
        writingHabits: true,
        opinions: true,
        language: true,
        ctaStyle: true
      });

      const invalidPersona = {
        name: 'John Doe',
        role: 'Marketing Manager',
        company: 'Tech Corp',
        primaryAudience: 'professionals',
        voiceTraits: ['direct'],
        writingHabits: {
          paragraphs: 'medium',
          questions: 'occasional',
          emojis: 'sparing',
          structure: 'mixed'
        },
        opinions: {
          strongBeliefs: ['Belief 1', 'Belief 2', 'Belief 3', 'Belief 4'],
          avoidsTopics: []
        },
        language: {
          avoid: [],
          prefer: []
        },
        ctaStyle: {
          aggressiveness: 'medium',
          patterns: []
        }
      };

      expect(() => createSchema.parse(invalidPersona)).toThrow();
    });

    it('should validate partial persona with some optional fields', () => {
      const createSchema = PersonaSchema.pick({
        name: true,
        role: true,
        company: true,
        primaryAudience: true,
        voiceTraits: true,
        opinions: true
      });

      const partialPersona = {
        name: 'Jane Smith',
        role: 'Content Strategist',
        company: 'Media Co',
        primaryAudience: 'creative',
        voiceTraits: ['expressive', 'innovative'],
        opinions: {
          strongBeliefs: ['Creativity drives innovation'],
          avoidsTopics: []
        }
      };

      expect(() => createSchema.parse(partialPersona)).not.toThrow();
    });

    it('should reject persona missing name', () => {
      const createSchema = PersonaSchema.pick({
        name: true,
        role: true,
        company: true,
        primaryAudience: true
      });

      const invalidPersona = {
        role: 'Marketing Manager',
        company: 'Tech Corp',
        primaryAudience: 'professionals'
      };

      expect(() => createSchema.parse(invalidPersona)).toThrow();
    });

    it('should reject persona missing role', () => {
      const createSchema = PersonaSchema.pick({
        name: true,
        role: true,
        company: true,
        primaryAudience: true
      });

      const invalidPersona = {
        name: 'John Doe',
        company: 'Tech Corp',
        primaryAudience: 'professionals'
      };

      expect(() => createSchema.parse(invalidPersona)).toThrow();
    });

    it('should reject persona missing company', () => {
      const createSchema = PersonaSchema.pick({
        name: true,
        role: true,
        company: true,
        primaryAudience: true
      });

      const invalidPersona = {
        name: 'John Doe',
        role: 'Marketing Manager',
        primaryAudience: 'professionals'
      };

      expect(() => createSchema.parse(invalidPersona)).toThrow();
    });

    it('should reject persona missing primaryAudience', () => {
      const createSchema = PersonaSchema.pick({
        name: true,
        role: true,
        company: true,
        primaryAudience: true
      });

      const invalidPersona = {
        name: 'John Doe',
        role: 'Marketing Manager',
        company: 'Tech Corp'
      };

      expect(() => createSchema.parse(invalidPersona)).toThrow();
    });
  });

  describe('validateRequestBody pattern', () => {
    it('should parse valid JSON and validate', () => {
      const createSchema = PersonaSchema.pick({
        name: true,
        role: true,
        company: true,
        primaryAudience: true,
        voiceTraits: true,
        writingHabits: true,
        opinions: true,
        language: true,
        ctaStyle: true
      });

      const validJson = JSON.stringify({
        name: 'Test User',
        role: 'Developer',
        company: 'Test Corp',
        primaryAudience: 'technical',
        voiceTraits: ['analytical'],
        writingHabits: {
          paragraphs: 'short',
          questions: 'frequent',
          emojis: 'none',
          structure: 'lists'
        },
        opinions: {
          strongBeliefs: ['Code quality matters'],
          avoidsTopics: []
        },
        language: {
          avoid: [],
          prefer: []
        },
        ctaStyle: {
          aggressiveness: 'low',
          patterns: []
        }
      });

      const parsed = JSON.parse(validJson);
      expect(() => createSchema.parse(parsed)).not.toThrow();
    });

    it('should throw error for invalid JSON', () => {
      const invalidJson = '{ invalid json }';

      expect(() => JSON.parse(invalidJson)).toThrow();
    });
  });
});
