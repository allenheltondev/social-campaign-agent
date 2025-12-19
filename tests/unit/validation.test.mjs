import { describe, it, expect } from 'vitest';
import { validatePersonaEntity } from '../../utils/validation.mjs';

describe('Validation Utility Unit Tests', () => {
  it('should validate complete persona entity successfully', () => {
    const validPersona = {
      personaId: 'persona_01HZXYZ123456789ABCDEFGHIJ',
      tenantId: 'tenant-123',
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
      },
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      isActive: true
    };

    expect(() => validatePersonaEntity(validPersona)).not.toThrow();
    const result = validatePersonaEntity(validPersona);
    expect(result.personaId).toBe(validPersona.personaId);
    expect(result.name).toBe(validPersona.name);
  });

  it('should reject persona with non-string personaId', () => {
    const invalidPersona = {
      personaId: 123, // Invalid: should be string
      tenantId: 'tenant-123',
      name: 'John Doe',
      role: 'Manager',
      company: 'Corp',
      primaryAudience: 'professionals',
      voiceTraits: ['professional'],
      writingHabits: {
        paragraphs: 'medium',
        questions: 'occasional',
        emojis: 'none',
        structure: 'prose'
      },
      opinions: {
        strongBeliefs: ['Quality matters'],
        avoidsTopics: []
      },
      language: {
        avoid: [],
        prefer: []
      },
      ctaStyle: {
        aggressiveness: 'medium',
        patterns: []
      },
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      isActive: true
    };

    expect(() => validatePersonaEntity(invalidPersona)).toThrow();
  });

  it('should reject persona with missing required fields', () => {
    const incompletePersona = {
      personaId: 'persona_01HZXYZ123456789ABCDEFGHIJ',
      tenantId: 'tenant-123',
      name: 'John Doe'
      // Missing required fields
    };

    expect(() => validatePersonaEntity(incompletePersona)).toThrow();
  });

  it('should reject persona with invalid enum values', () => {
    const invalidPersona = {
      personaId: 'persona_01HZXYZ123456789ABCDEFGHIJ',
      tenantId: 'tenant-123',
      name: 'John Doe',
      role: 'Manager',
      company: 'Corp',
      primaryAudience: 'invalid-audience', // Invalid enum
      voiceTraits: ['professional'],
      writingHabits: {
        paragraphs: 'medium',
        questions: 'occasional',
        emojis: 'none',
        structure: 'prose'
      },
      opinions: {
        strongBeliefs: ['Quality matters'],
        avoidsTopics: []
      },
      language: {
        avoid: [],
        prefer: []
      },
      ctaStyle: {
        aggressiveness: 'medium',
        patterns: []
      },
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      isActive: true
    };

    expect(() => validatePersonaEntity(invalidPersona)).toThrow();
  });

  it('should reject persona with too many strong beliefs', () => {
    const invalidPersona = {
      personaId: 'persona_01HZXYZ123456789ABCDEFGHIJ',
      tenantId: 'tenant-123',
      name: 'John Doe',
      role: 'Manager',
      company: 'Corp',
      primaryAudience: 'professionals',
      voiceTraits: ['professional'],
      writingHabits: {
        paragraphs: 'medium',
        questions: 'occasional',
        emojis: 'none',
        structure: 'prose'
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
      },
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      isActive: true
    };

    expect(() => validatePersonaEntity(invalidPersona)).toThrow();
  });
});
