import { describe, it, expect } from 'vitest';
import {
  PersonaSchema,
  WritingExampleSchema,
  CreatePersonaRequestSchema,
  validateRequestBody
} from '../../schemas/persona.mjs';

describe('Persona Schemas', () => {
  describe('CreatePersonaRequestSchema', () => {
    it('should validate a complete persona creation request', () => {
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

      expect(() => CreatePersonaRequestSchema.parse(validPersona)).not.toThrow();
    });

    it('should reject persona with too many strong beliefs', () => {
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
          strongBeliefs: ['Belief 1', 'Belief 2', 'Belief 3', 'Belief 4'], // Too many
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

      expect(() => CreatePersonaRequestSchema.parse(invalidPersona)).toThrow();
    });
  });

  describe('validateRequestBody', () => {
    it('should parse valid JSON and validate', () => {
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

      expect(() => validateRequestBody(CreatePersonaRequestSchema, validJson)).not.toThrow();
    });

    it('should throw error for invalid JSON', () => {
      const invalidJson = '{ invalid json }';

      expect(() => validateRequestBody(CreatePersonaRequestSchema, invalidJson)).toThrow('Invalid JSON in request body');
    });
  });
});
