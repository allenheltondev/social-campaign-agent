import { DynamoDBClient, GetItemCommand, BatchGetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { z } from 'zod';
import { ulid } from 'ulid';

const ddb = new DynamoDBClient();

export const PersonaSchema = z.object({
  personaId: z.string(),
  tenantId: z.string(),
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(100),
  company: z.string().min(1).max(100),
  primaryAudience: z.enum(['executives', 'professionals', 'consumers', 'technical', 'creative']),
  voiceTraits: z.array(z.string()).min(1).max(10),
  writingHabits: z.object({
    paragraphs: z.enum(['short', 'medium', 'long']),
    questions: z.enum(['frequent', 'occasional', 'rare']),
    emojis: z.enum(['frequent', 'sparing', 'none']),
    structure: z.enum(['prose', 'lists', 'mixed'])
  }),
  opinions: z.object({
    strongBeliefs: z.array(z.string()).min(1).max(3),
    avoidsTopics: z.array(z.string()).max(10)
  }),
  language: z.object({
    avoid: z.array(z.string()).max(20),
    prefer: z.array(z.string()).max(20)
  }),
  ctaStyle: z.object({
    aggressiveness: z.enum(['low', 'medium', 'high']),
    patterns: z.array(z.string()).max(10)
  }),
  inferredStyle: z.object({
    sentenceLengthPattern: z.object({
      avgWordsPerSentence: z.number(),
      variance: z.enum(['low', 'medium', 'high']),
      classification: z.enum(['short', 'medium', 'long', 'varied'])
    }),
    structurePreference: z.enum(['prose', 'lists', 'mixed']),
    pacing: z.enum(['punchy', 'even', 'meandering']),
    emojiFrequency: z.number().min(0).max(1),
    expressivenessMarkers: z.enum(['low', 'medium', 'high']),
    analogyUsage: z.enum(['frequent', 'occasional', 'rare']),
    imageryMetaphorUsage: z.enum(['frequent', 'occasional', 'rare']),
    toneTags: z.array(z.enum(['direct', 'warm', 'candid', 'technical', 'playful', 'skeptical', 'optimistic', 'pragmatic', 'story-driven', 'educational'])).min(1).max(4),
    overallTone: z.string().optional(),
    assertiveness: z.enum(['high', 'medium', 'low']),
    hedgingStyle: z.enum(['rare', 'some', 'frequent']),
    hookStyle: z.enum(['question', 'contrarian', 'story', 'data', 'straight-to-point', 'mixed']),
    anecdoteUsage: z.enum(['frequent', 'occasional', 'rare']),
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
  analysisStatus: z.enum(['pending', 'processing', 'success', 'failure']).optional(),
  lastAnalysisAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().min(1),
  isActive: z.boolean()
});

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

export const generatePersonaId = () => {
  return `persona_${ulid()}`;
};

export const generateExampleId = () => {
  return `example_${ulid()}`;
};

export class Persona {
  static async findById(tenantId, personaId) {
    const response = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${personaId}`,
        sk: 'persona'
      })
    }));

    if (!response.Item) {
      return null;
    }

    const rawPersona = unmarshall(response.Item);
    return this.transformFromDynamoDB(rawPersona);
  }

  static async findByIds(tenantId, personaIds) {
    if (!personaIds || personaIds.length === 0) {
      return [];
    }

    const batchSize = 100;
    const personas = [];

    for (let i = 0; i < personaIds.length; i += batchSize) {
      const batch = personaIds.slice(i, i + batchSize);
      const keys = batch.map(personaId => ({
        pk: { S: `${tenantId}#${personaId}` },
        sk: { S: 'persona' }
      }));

      const response = await ddb.send(new BatchGetItemCommand({
        RequestItems: {
          [process.env.TABLE_NAME]: {
            Keys: keys
          }
        }
      }));

      const batchPersonas = response.Responses[process.env.TABLE_NAME]?.map(item => {
        const rawPersona = unmarshall(item);
        return this.transformFromDynamoDB(rawPersona);
      }) || [];

      personas.push(...batchPersonas);
    }

    const missingPersonas = personaIds.filter(id =>
      !personas.find(p => p.personaId === id)
    );

    if (missingPersonas.length > 0) {
      throw new Error(`Personas not found: ${missingPersonas.join(', ')}`);
    }

    return personas;
  }

  static transformFromDynamoDB(rawPersona) {
    const cleanPersona = { ...rawPersona };

    delete cleanPersona.pk;
    delete cleanPersona.sk;
    delete cleanPersona.GSI1PK;
    delete cleanPersona.GSI1SK;
    delete cleanPersona.GSI2PK;
    delete cleanPersona.GSI2SK;

    return PersonaSchema.parse(cleanPersona);
  }

  static transformToDynamoDB(tenantId, persona) {
    const now = new Date().toISOString();

    return {
      pk: `${tenantId}#${persona.personaId}`,
      sk: 'persona',
      GSI1PK: tenantId,
      GSI1SK: `PERSONA#${now}`,
      GSI2PK: `${tenantId}#${persona.company}`,
      GSI2SK: `PERSONA#${persona.role}#${now}`,
      ...persona
    };
  }

  static enrichForCampaign(persona) {
    return {
      personaId: persona.personaId,
      name: persona.name,
      role: persona.role,
      company: persona.company,
      primaryAudience: persona.primaryAudience,
      voiceTraits: persona.voiceTraits,
      writingHabits: persona.writingHabits,
      opinions: persona.opinions,
      language: persona.language,
      ctaStyle: persona.ctaStyle,
      inferredStyle: persona.inferredStyle,
      hardRestrictions: {
        avoidsTopics: persona.opinions?.avoidsTopics || [],
        languageAvoid: persona.language?.avoid || [],
        ctaLimitations: persona.ctaStyle?.aggressiveness === 'low'
      },
      platformPreferences: {
        twitter: { maxLength: 280, preferHashtags: true },
        linkedin: { maxLength: 3000, preferProfessional: true },
        instagram: { maxLength: 2200, requireVisuals: true },
        facebook: { maxLength: 63206, allowLongForm: true }
      }
    };
  }

  static mergeEffectiveRestrictions(persona, campaignRestrictions = {}, brandRestrictions = {}) {
    const enrichedPersona = this.enrichForCampaign(persona);

    return {
      ...enrichedPersona,
      effectiveRestrictions: {
        avoidsTopics: [
          ...(enrichedPersona.hardRestrictions?.avoidsTopics || []),
          ...(campaignRestrictions.campaignAvoidTopics || []),
          ...(brandRestrictions.avoidTopics || [])
        ],
        languageAvoid: [
          ...(enrichedPersona.hardRestrictions?.languageAvoid || []),
          ...(brandRestrictions.avoidPhrases || [])
        ],
        ctaLimitations: enrichedPersona.hardRestrictions?.ctaLimitations || false
      }
    };
  }
}
