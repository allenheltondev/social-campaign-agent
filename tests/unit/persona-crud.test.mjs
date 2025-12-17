import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { handler as createPersonaHandler } from '../../functions/persona/create-persona.mjs';
import { handler as getPersonaHandler } from '../../functions/persona/get-persona.mjs';

vi.mock('ulid', () => ({
  ulid: vi.fn(() => 'test-persona-id-123')
}));

const ddbMock = mockClient(DynamoDBClient);

describe('Persona CRUD Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ddbMock.reset();
    process.env.TABLE_NAME = 'TestTable';
  });

  describe('Create Persona', () => {
    it('should create persona with valid data', async () => {
      const validPersonaData = {
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

      ddbMock.on(PutItemCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant'
          }
        },
        body: JSON.stringify(validPersonaData)
      };

      const response = await createPersonaHandler(event);
      expect(response.statusCode).toBe(201);
    });
  });

  describe('Get Persona', () => {
    it('should retrieve persona by ID', async () => {
      const mockPersona = {
        pk: { S: 'test-tenant#test-persona-id' },
        sk: { S: 'metadata' },
        personaId: { S: 'test-persona-id' },
        tenantId: { S: 'test-tenant' },
        name: { S: 'John Doe' },
        role: { S: 'Manager' },
        company: { S: 'Test Corp' },
        primaryAudience: { S: 'professionals' },
        voiceTraits: { L: [{ S: 'direct' }] },
        writingHabits: { M: {
          paragraphs: { S: 'medium' },
          questions: { S: 'occasional' },
          emojis: { S: 'sparing' },
          structure: { S: 'mixed' }
        }},
        opinions: { M: {
          strongBeliefs: { L: [{ S: 'Innovation drives success' }] },
          avoidsTopics: { L: [] }
        }},
        language: { M: {
          avoid: { L: [] },
          prefer: { L: [] }
        }},
        ctaStyle: { M: {
          aggressiveness: { S: 'medium' },
          patterns: { L: [] }
        }},
        createdAt: { S: '2023-01-01T00:00:00Z' },
        updatedAt: { S: '2023-01-01T00:00:00Z' },
        version: { N: '1' },
        isActive: { BOOL: true }
      };

      ddbMock.on(GetItemCommand).resolves({
        Item: mockPersona
      });

      const event = {
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant'
          }
        },
        pathParameters: { personaId: 'test-persona-id' }
      };

      const response = await getPersonaHandler(event);
      expect(response.statusCode).toBe(200);
    });
  });
});
