import { DynamoDBClient, GetItemCommand, BatchGetItemCommand, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { z } from 'zod';
import { ulid } from 'ulid';
import { logger } from '../utils/logger.mjs';

const ddb = new DynamoDBClient();

export const PersonaSchema = z.object({
  personaId: z.string(),
  tenantId: z.string(),
  name: z.string().trim().min(1).max(100),
  role: z.string().trim().min(1).max(100),
  company: z.string().trim().min(1).max(100),
  primaryAudience: z.enum(['executives', 'professionals', 'consumers', 'technical', 'creative']),
  voiceTraits: z.array(z.string().trim()).min(1).max(10),
  writingHabits: z.object({
    paragraphs: z.enum(['short', 'medium', 'long']),
    questions: z.enum(['frequent', 'occasional', 'rare']),
    emojis: z.enum(['frequent', 'sparing', 'none']),
    structure: z.enum(['prose', 'lists', 'mixed'])
  }),
  opinions: z.object({
    strongBeliefs: z.array(z.string().trim()).min(1).max(3),
    avoidsTopics: z.array(z.string().trim()).max(10)
  }),
  language: z.object({
    avoid: z.array(z.string().trim()).max(20),
    prefer: z.array(z.string().trim()).max(20)
  }),
  ctaStyle: z.object({
    aggressiveness: z.enum(['low', 'medium', 'high']),
    patterns: z.array(z.string().trim()).max(10)
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
    overallTone: z.string().trim().optional(),
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
  platform: z.string().trim().min(1).max(50),
  intent: z.string().trim().min(1).max(100),
  text: z.string().trim().min(10).max(10000),
  notes: z.string().trim().max(1000).optional(),
  analyzedAt: z.string().optional(),
  createdAt: z.string()
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

      return this.fromDynamoDB(rawPersona);
    } catch (error) {
      logger.error('Persona retrieval failed', {
        operation: 'findById',
        tenantId,
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

      const validatedPersona = PersonaSchema.parse(personaWithDefaults);
      const dynamoItem = this.toDynamoDB(tenantId, validatedPersona);

      await ddb.send(new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall(dynamoItem),
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
      }));

      return this.fromDynamoDB(validatedPersona);
    } catch (error) {
      logger.error('Persona save failed', {
        operation: 'save',
        tenantId,
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
      const updateSchema = PersonaSchema.omit({
        personaId: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true
      }).partial();
      const validatedUpdateData = updateSchema.parse(updateData);
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

      const validatedPersona = PersonaSchema.parse(personaForValidation);
      const dynamoItem = this.toDynamoDB(tenantId, validatedPersona);

      await ddb.send(new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall(dynamoItem)
      }));

      return this.fromDynamoDB(validatedPersona);
    } catch (error) {
      logger.error('Persona update failed', {
        operation: 'update',
        tenantId,
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
      logger.error('Persona delete failed', {
        operation: 'delete',
        tenantId,
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
      const { nextToken, limit = 20 } = options;

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

      const personas = response.Items?.map(item => {
        const rawPersona = unmarshall(item);
        return this.fromDynamoDB(rawPersona);
      }) || [];

      const personaListResponse = {
        items: personas,
        pagination: {
          limit,
          hasNextPage: !!response.LastEvaluatedKey,
          nextToken: response.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(unmarshall(response.LastEvaluatedKey))).toString('base64')
            : null
        }
      };

      return personaListResponse;
    } catch (error) {
      logger.error('Persona list failed', {
        operation: 'list',
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
        return this.fromDynamoDB(rawPersona);
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

  static fromDynamoDB(rawPersona) {
    const cleanPersona = { ...rawPersona };

    delete cleanPersona.pk;
    delete cleanPersona.sk;
    delete cleanPersona.GSI1PK;
    delete cleanPersona.GSI1SK;
    delete cleanPersona.GSI2PK;
    delete cleanPersona.GSI2SK;

    delete cleanPersona.tenantId;
    cleanPersona.id = cleanPersona.personaId;
    delete cleanPersona.personaId;

    return cleanPersona;
  }

  static toDynamoDB(tenantId, persona) {
    const now = new Date().toISOString();

    const internalPersona = { ...persona };

    if (internalPersona.id) {
      internalPersona.personaId = internalPersona.id;
      delete internalPersona.id;
    }

    internalPersona.tenantId = tenantId;

    return {
      pk: `${tenantId}#${internalPersona.personaId}`,
      sk: 'persona',
      GSI1PK: tenantId,
      GSI1SK: `PERSONA#${now}`,
      ...internalPersona
    };
  }
}

