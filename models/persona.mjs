import { DynamoDBClient, GetItemCommand, BatchGetItemCommand, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
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
      const validationErrors = (error.errors || []).map(e => ({
        field: (e.path || []).join('.'),
        message: e.message || 'Validation failed',
        code: e.code || 'invalid'
      }));
      const errorMessage = `Validation error: ${validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`;
      const validationError = new Error(errorMessage);
      validationError.name = 'ValidationError';
      validationError.details = { errors: validationErrors };
      throw validationError;
    }
    const parseError = new Error('Invalid JSON in request body');
    parseError.name = 'ParseError';
    throw parseError;
  }
};

export const validateQueryParams = (schema, params) => {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationErrors = (error.errors || []).map(e => ({
        field: (e.path || []).join('.'),
        message: e.message || 'Validation failed',
        code: e.code || 'invalid'
      }));
      const errorMessage = `Query parameter validation error: ${validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`;
      const validationError = new Error(errorMessage);
      validationError.name = 'ValidationError';
      validationError.details = { errors: validationErrors };
      throw validationError;
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
  static validateEntity(persona) {
    try {
      return PersonaSchema.parse(persona);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = (error.errors || []).map(e => ({
          field: (e.path || []).join('.'),
          message: e.message || 'Validation failed',
          code: e.code || 'invalid'
        }));
        const errorMessage = `Persona validation error: ${validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`;
        const validationError = new Error(errorMessage);
        validationError.name = 'ValidationError';
        validationError.details = { errors: validationErrors };
        throw validationError;
      }
      throw error;
    }
  }

  static validateUpdateData(updateData) {
    try {
      const updateSchema = PersonaSchema.omit({
        personaId: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true
      }).partial();
      return updateSchema.parse(updateData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = (error.errors || []).map(e => ({
          field: (e.path || []).join('.'),
          message: e.message || 'Validation failed',
          code: e.code || 'invalid'
        }));
        const errorMessage = `Persona update validation error: ${validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`;
        const validationError = new Error(errorMessage);
        validationError.name = 'ValidationError';
        validationError.details = { errors: validationErrors };
        throw validationError;
      }
      throw error;
    }
  }
  static async findById(tenantId, personaId) {
    try {
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

      if (!rawPersona.isActive) {
        return null;
      }

      return this.transformFromDynamoDB(rawPersona);
    } catch (error) {
      console.error('Persona retrieval failed', {
        personaId,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new Error('Failed to retrieve persona');
    }
  }

  static async save(tenantId, persona) {
    try {
      const personaId = persona.id || generatePersonaId();
      const now = new Date().toISOString();

      const personaWithDefaults = {
        ...persona,
        personaId,
        tenantId,
        createdAt: now,
        updatedAt: now,
        isActive: true
      };

      const validatedPersona = this.validateEntity(personaWithDefaults);
      const dynamoItem = this._transformToDynamoDB(tenantId, validatedPersona);

      await ddb.send(new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall(dynamoItem),
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
      }));

      return this.transformFromDynamoDB(validatedPersona);
    } catch (error) {
      console.error('Persona save failed', {
        personaId: persona.id,
        errorName: error.name,
        errorMessage: error.message
      });
      if (error.name === 'ValidationError') {
        throw error;
      }
      throw new Error('Failed to save persona');
    }
  }

  static async update(tenantId, personaId, updateData) {
    try {
      const validatedUpdateData = this.validateUpdateData(updateData);
      const existing = await this.findById(tenantId, personaId);
      if (!existing) {
        return null;
      }

      const updatedPersona = {
        ...existing,
        ...validatedUpdateData,
        id: personaId,
        updatedAt: new Date().toISOString()
      };

      const personaForValidation = {
        ...updatedPersona,
        personaId,
        tenantId
      };

      const validatedPersona = this.validateEntity(personaForValidation);
      const dynamoItem = this._transformToDynamoDB(tenantId, validatedPersona);

      await ddb.send(new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall(dynamoItem)
      }));

      return this.transformFromDynamoDB(validatedPersona);
    } catch (error) {
      console.error('Persona update failed', {
        personaId,
        errorName: error.name,
        errorMessage: error.message
      });
      if (error.name === 'ValidationError') {
        throw error;
      }
      throw new Error('Failed to update persona');
    }
  }

  static async delete(tenantId, personaId) {
    try {
      const { UpdateItemCommand } = await import('@aws-sdk/client-dynamodb');

      const now = new Date().toISOString();
      const ttl = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

      await ddb.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({
          pk: `${tenantId}#${personaId}`,
          sk: 'persona'
        }),
        UpdateExpression: 'SET #isActive = :false, #updatedAt = :now, #ttl = :ttl',
        ExpressionAttributeNames: {
          '#isActive': 'isActive',
          '#updatedAt': 'updatedAt',
          '#ttl': 'ttl'
        },
        ExpressionAttributeValues: marshall({
          ':false': false,
          ':now': now,
          ':ttl': ttl
        }),
        ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)'
      }));

      return true;
    } catch (error) {
      console.error('Persona delete failed', {
        personaId,
        errorName: error.name,
        errorMessage: error.message
      });
      if (error.name === 'ConditionalCheckFailedException') {
        return false;
      }
      throw new Error('Failed to delete persona');
    }
  }

  static async list(tenantId, options = {}) {
    try {
      const { limit = 20, nextToken, search, company, role, primaryAudience } = options;

      let exclusiveStartKey;
      if (nextToken) {
        try {
          exclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
        } catch (e) {
          throw new Error('Invalid nextToken');
        }
      }

      const response = await ddb.send(new QueryCommand({
        TableName: process.env.TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :tenantId AND begins_with(GSI1SK, :personaPrefix)',
        FilterExpression: '#isActive = :true',
        ExpressionAttributeNames: {
          '#isActive': 'isActive'
        },
        ExpressionAttributeValues: marshall({
          ':tenantId': tenantId,
          ':personaPrefix': 'PERSONA#',
          ':true': true
        }),
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey ? marshall(exclusiveStartKey) : undefined
      }));

      let personas = response.Items?.map(item => {
        const rawPersona = unmarshall(item);
        return this.transformFromDynamoDB(rawPersona);
      }) || [];

      // Apply client-side filtering
      if (search) {
        const searchTerm = search.toLowerCase();
        personas = personas.filter(persona =>
          persona.name.toLowerCase().includes(searchTerm) ||
          persona.role.toLowerCase().includes(searchTerm) ||
          persona.company.toLowerCase().includes(searchTerm) ||
          persona.primaryAudience.toLowerCase().includes(searchTerm)
        );
      }

      if (company) {
        personas = personas.filter(persona =>
          persona.company.toLowerCase().includes(company.toLowerCase())
        );
      }

      if (role) {
        personas = personas.filter(persona =>
          persona.role.toLowerCase().includes(role.toLowerCase())
        );
      }

      if (primaryAudience) {
        personas = personas.filter(persona =>
          persona.primaryAudience === primaryAudience
        );
      }

      const result = {
        items: personas,
        pagination: {
          limit,
          hasNextPage: !!response.LastEvaluatedKey,
          nextToken: response.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(unmarshall(response.LastEvaluatedKey))).toString('base64')
            : null
        }
      };

      return result;
    } catch (error) {
      console.error('Persona list failed', {
        tenantId,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new Error('Failed to list personas');
    }
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
      !personas.find(p => p.id === id)
    );

    if (missingPersonas.length > 0) {
      throw new Error(`Personas not found: ${missingPersonas.join(', ')}`);
    }

    return personas;
  }

  static transformFromDynamoDB(rawPersona) {
    const cleanPersona = { ...rawPersona };

    // Remove all internal DynamoDB fields
    delete cleanPersona.pk;
    delete cleanPersona.sk;
    delete cleanPersona.GSI1PK;
    delete cleanPersona.GSI1SK;
    delete cleanPersona.GSI2PK;
    delete cleanPersona.GSI2SK;

    // Remove tenant exposure and use clean "id" property
    delete cleanPersona.tenantId;
    cleanPersona.id = cleanPersona.personaId;
    delete cleanPersona.personaId;

    return cleanPersona;
  }

  static _transformToDynamoDB(tenantId, persona) {
    const now = new Date().toISOString();

    // Convert DTO back to internal format
    const internalPersona = { ...persona };

    // Handle id/personaId conversion
    if (internalPersona.id) {
      internalPersona.personaId = internalPersona.id;
      delete internalPersona.id;
    }

    // Add tenant context back
    internalPersona.tenantId = tenantId;

    return {
      pk: `${tenantId}#${internalPersona.personaId}`,
      sk: 'persona',
      GSI1PK: tenantId,
      GSI1SK: `PERSONA#${now}`,
      GSI2PK: `${tenantId}#${internalPersona.company}`,
      GSI2SK: `PERSONA#${internalPersona.role}#${now}`,
      ...internalPersona
    };
  }

  static enrichForCampaign(persona) {
    return {
      personaId: persona.id,
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
