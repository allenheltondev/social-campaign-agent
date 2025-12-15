import { z } from 'zod';
import { ulid } from 'ulid';

// Core persona schema that defines both validation and type
export const PersonaSchema = z.object({
  // Identity
  personaId: z.string(),
  tenantId: z.string(),
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(100),
  company: z.string().min(1).max(100),
  primaryAudience: z.enum(['executives', 'professionals', 'consumers', 'technical', 'creative']),

  // Voice Traits
  voiceTraits: z.array(z.string()).min(1).max(10),

  // Writing Habits
  writingHabits: z.object({
    paragraphs: z.enum(['short', 'medium', 'long']),
    questions: z.enum(['frequent', 'occasional', 'rare']),
    emojis: z.enum(['frequent', 'sparing', 'none']),
    structure: z.enum(['prose', 'lists', 'mixed'])
  }),

  // Opinions Framework
  opinions: z.object({
    strongBeliefs: z.array(z.string()).min(1).max(3),
    avoidsTopics: z.array(z.string()).max(10)
  }),

  // Language Preferences
  language: z.object({
    avoid: z.array(z.string()).max(20),
    prefer: z.array(z.string()).max(20)
  }),

  // CTA Style
  ctaStyle: z.object({
    aggressiveness: z.enum(['low', 'medium', 'high']),
    patterns: z.array(z.string()).max(10)
  }),

  // Inferred Style (optional, populated by AI)
  inferredStyle: z.object({
    // Measurable sentence/paragraph patterns
    sentenceLengthPattern: z.object({
      avgWordsPerSentence: z.number(),
      variance: z.enum(['low', 'medium', 'high']),
      classification: z.enum(['short', 'medium', 'long', 'varied'])
    }),
    structurePreference: z.enum(['prose', 'lists', 'mixed']),
    pacing: z.enum(['punchy', 'even', 'meandering']),

    // Separated emoji and expressiveness
    emojiFrequency: z.number().min(0).max(1),
    expressivenessMarkers: z.enum(['low', 'medium', 'high']),

    // Split metaphor types
    analogyUsage: z.enum(['frequent', 'occasional', 'rare']),
    imageryMetaphorUsage: z.enum(['frequent', 'occasional', 'rare']),

    // Controlled vocabulary tone + free text
    toneTags: z.array(z.enum(['direct', 'warm', 'candid', 'technical', 'playful', 'skeptical', 'optimistic', 'pragmatic', 'story-driven', 'educational'])).min(1).max(4),
    overallTone: z.string().optional(),

    // Stance and hedging
    assertiveness: z.enum(['high', 'medium', 'low']),
    hedgingStyle: z.enum(['rare', 'some', 'frequent']),

    // Hook style
    hookStyle: z.enum(['question', 'contrarian', 'story', 'data', 'straight-to-point', 'mixed']),

    // Anecdote usage (keeping from original)
    anecdoteUsage: z.enum(['frequent', 'occasional', 'rare']),

    // Diagnostic confidence
    confidence: z.object({
      overall: z.number().min(0).max(1),
      coverage: z.object({
        exampleCount: z.number(),
        platformCount: z.number(),
        intentCount: z.number()
      }),
      consistencyByFeature: z.object({
        sentenceLength: z.number().min(0).max(1),
        structure: z.number().min(0).max(1),
        expressiveness: z.number().min(0).max(1),
        metaphors: z.number().min(0).max(1),
        tone: z.number().min(0).max(1),
        assertiveness: z.number().min(0).max(1),
        hooks: z.number().min(0).max(1)
      })
    })
  }).optional(),

  // Analysis Status
  analysisStatus: z.enum(['pending', 'processing', 'success', 'failure']).optional(),
  lastAnalysisAt: z.string().optional(),

  // Metadata
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().min(1),
  isActive: z.boolean()
});

// Writing example schema
export const WritingExampleSchema = z.object({
  exampleId: z.string(),
  personaId: z.string(),
  tenantId: z.string(),
  platform: z.string().min(1).max(50),
  intent: z.string().min(1).max(100),
  text: z.string().min(10).max(10000),
  notes: z.string().max(1000).optional(),
  analyzedAt: z.string().optional(),
  createdAt: z.string()
});

// Request schemas for API validation
export const CreatePersonaRequestSchema = PersonaSchema.omit({
  personaId: true,
  tenantId: true,
  inferredStyle: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isActive: true
});

export const UpdatePersonaRequestSchema = CreatePersonaRequestSchema.partial();

export const CreateWritingExampleRequestSchema = WritingExampleSchema.omit({
  exampleId: true,
  personaId: true,
  tenantId: true,
  analyzedAt: true,
  createdAt: true
});

export const QueryPersonasRequestSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional(),
  nextToken: z.string().optional(),
  search: z.string().max(200).optional(),
  company: z.string().max(100).optional(),
  role: z.string().max(100).optional(),
  primaryAudience: z.enum(['executives', 'professionals', 'consumers', 'technical', 'creative']).optional()
});

// Utility function to validate request body
export const validateRequestBody = (schema, body) => {
  try {
    const parsed = JSON.parse(body);
    return schema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw new Error('Invalid JSON in request body');
  }
};

// Utility function to validate query parameters
export const validateQueryParams = (schema, params) => {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Query parameter validation error: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
};

// Simple ID generation utilities
export const generatePersonaId = () => {
  return `persona_${ulid()}`;
};

export const generateExampleId = () => {
  return `example_${ulid()}`;
};
