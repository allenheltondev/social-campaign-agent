import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { handler as createPersonaHandler } from '../../functions/persona/create-persona.mjs';
import { handler as getPersonaHandler } from '../../functions/persona/get-persona.mjs';
import { handler as updatePersonaHandler } from '../../functions/persona/update-persona.mjs';
import { handler as deletePersonaHandler } from '../../functions/persona/delete-persona.mjs';
import { handler as listPersonasHandler } from '../../functions/persona/list-personas.mjs';

vi.mock('ulid', () => ({
  ulid: vi.fn(() => 'test-persona-id-123')
}));

const ddbMock = mockClient(DynamoDBClient);

const createMockEvent = (method, body = null, pathParameters = {}, queryStringParameters = {}, tenantId = 'test-tenant') => ({
  httpMethod: method,
  body: body ? JSON.stringify(body) : null,
  pathParameters,
  queryStringParameters,
  requestContext: {
    authorizer: {
      tenantId
    }
  }
});

describe('Persona CRUD Lambda Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ddbMock.reset();
    process.env.TABLE_NAME = 'TestTable';
  });

  describe('Create Persona Function', () => {
    it('should create persona successfully with valid data', async () => {
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

      const event = createMockEvent('POST', validPersonaData);
      const response = await createPersonaHandler(event);

      expect(response.statusCode).toBe(201);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.id).toBeDefined();
      expect(typeof responseBody.id).toBe('string');
      expect(ddbMock.commandCalls(PutItemCommand)).toHaveLength(1);
    });

    it('should return 400 for invalid persona data', async () => {
      const invalidPersonaData = {
        name: '',
        role: 'Manager',
        primaryAudience: 'invalid-audience'
      };

      const event = createMockEvent('POST', invalidPersonaData);
      const response = await createPersonaHandler(event);

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toContain('Validation error');
      expect(ddbMock.commandCalls(PutItemCommand)).toHaveLength(0);
    });

    it('should return 401 when tenant ID is missing', async () => {
      const validPersonaData = {
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
        }
      };

      const event = createMockEvent('POST', validPersonaData, {}, {}, null);
      event.requestContext.authorizer = {};

      const response = await createPersonaHandler(event);

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Unauthorized');
      expect(ddbMock.commandCalls(PutItemCommand)).toHaveLength(0);
    });

    it('should handle DynamoDB errors', async () => {
      const validPersonaData = {
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
        }
      };

      ddbMock.on(PutItemCommand).rejects(new Error('DynamoDB error'));

      const event = createMockEvent('POST', validPersonaData);
      const response = await createPersonaHandler(event);

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Internal server error');
    });
  });

  describe('Get Persona Function', () => {
    it('should retrieve persona successfully', async () => {
      const mockPersonaData = marshall({
        personaId: 'test-persona-id',
        tenantId: 'test-tenant',
        name: 'John Doe',
        role: 'Manager',
        company: 'Corp',
        primaryAudience: 'professionals',
        voiceTraits: ['professional'],
        writingHabits: {
          paragraphs: 'medium',
          questions: 'occasional',
          emojis: 'sparing',
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
        version: 1,
        isActive: true,
        pk: 'test-tenant#test-persona-id',
        sk: 'persona',
        GSI1PK: 'test-tenant',
        GSI1SK: 'persona#2023-01-01T00:00:00.000Z'
      });

      ddbMock.on(GetItemCommand).resolves({
        Item: mockPersonaData
      });

      const event = createMockEvent('GET', null, { personaId: 'test-persona-id' });
      const response = await getPersonaHandler(event);

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.personaId).toBe('test-persona-id');
      expect(responseBody.name).toBe('John Doe');
      expect(responseBody.pk).toBeUndefined();
      expect(responseBody.sk).toBeUndefined();
      expect(ddbMock.commandCalls(GetItemCommand)).toHaveLength(1);
    });

    it('should return 404 when persona not found', async () => {
      ddbMock.on(GetItemCommand).resolves({});

      const event = createMockEvent('GET', null, { personaId: 'non-existent-id' });
      const response = await getPersonaHandler(event);

      expect(response.statusCode).toBe(404);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Persona not found');
    });

    it('should return 400 when personaId is missing', async () => {
      const event = createMockEvent('GET', null, {});
      const response = await getPersonaHandler(event);

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Missing personaId parameter');
      expect(ddbMock.commandCalls(GetItemCommand)).toHaveLength(0);
    });

    it('should return 401 when tenant ID is missing', async () => {
      const event = createMockEvent('GET', null, { personaId: 'test-id' }, {}, null);
      event.requestContext.authorizer = {};

      const response = await getPersonaHandler(event);

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Unauthorized');
    });
  });

  describe('Update Persona Function', () => {
    it('should update persona successfully', async () => {
      const updateData = {
        name: 'Jane Doe',
        company: 'New Corp'
      };

      const updatedPersonaData = marshall({
        personaId: 'test-persona-id',
        tenantId: 'test-tenant',
        name: 'Jane Doe',
        role: 'Manager',
        company: 'New Corp',
        version: 2,
        updatedAt: '2023-01-02T00:00:00.000Z',
        pk: 'test-tenant#test-persona-id',
        sk: 'persona',
        GSI1PK: 'test-tenant',
        GSI1SK: 'persona#2023-01-02T00:00:00.000Z'
      });

      ddbMock.on(UpdateItemCommand).resolves({
        Attributes: updatedPersonaData
      });

      const event = createMockEvent('PUT', updateData, { personaId: 'test-persona-id' });
      const response = await updatePersonaHandler(event);

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.name).toBe('Jane Doe');
      expect(responseBody.company).toBe('New Corp');
      expect(responseBody.version).toBe(2);
      expect(responseBody.pk).toBeUndefined();
      expect(responseBody.sk).toBeUndefined();
      expect(ddbMock.commandCalls(UpdateItemCommand)).toHaveLength(1);
    });

    it('should return 404 when persona not found for update', async () => {
      const conditionalCheckError = new Error('ConditionalCheckFailedException');
      conditionalCheckError.name = 'ConditionalCheckFailedException';
      ddbMock.on(UpdateItemCommand).rejects(conditionalCheckError);

      const updateData = { name: 'New Name' };
      const event = createMockEvent('PUT', updateData, { personaId: 'non-existent-id' });
      const response = await updatePersonaHandler(event);

      expect(response.statusCode).toBe(404);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Persona not found');
    });

    it('should return 400 for invalid update data', async () => {
      const invalidUpdateData = {
        primaryAudience: 'invalid-audience'
      };

      const event = createMockEvent('PUT', invalidUpdateData, { personaId: 'test-id' });
      const response = await updatePersonaHandler(event);

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toContain('Validation error');
      expect(ddbMock.commandCalls(UpdateItemCommand)).toHaveLength(0);
    });
  });

  describe('Delete Persona Function', () => {
    it('should soft delete persona successfully', async () => {
      ddbMock.on(UpdateItemCommand).resolves({});

      const event = createMockEvent('DELETE', null, { personaId: 'test-persona-id' });
      const response = await deletePersonaHandler(event);

      expect(response.statusCode).toBe(204);
      expect(response.body).toBeUndefined();
      expect(ddbMock.commandCalls(UpdateItemCommand)).toHaveLength(1);
    });

    it('should return 404 when persona not found for deletion', async () => {
      const conditionalCheckError = new Error('ConditionalCheckFailedException');
      conditionalCheckError.name = 'ConditionalCheckFailedException';
      ddbMock.on(UpdateItemCommand).rejects(conditionalCheckError);

      const event = createMockEvent('DELETE', null, { personaId: 'non-existent-id' });
      const response = await deletePersonaHandler(event);

      expect(response.statusCode).toBe(404);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Persona not found');
    });
  });

  describe('List Personas Function', () => {
    it('should list personas successfully', async () => {
      const mockPersonas = {
        Items: [
          marshall({
            personaId: 'persona-1',
            tenantId: 'test-tenant',
            name: 'John Doe',
            role: 'Manager',
            company: 'Corp A',
            primaryAudience: 'professionals',
            isActive: true,
            pk: 'test-tenant#persona-1',
            sk: 'persona',
            GSI1PK: 'test-tenant',
            GSI1SK: 'persona#2023-01-01T00:00:00.000Z'
          }),
          marshall({
            personaId: 'persona-2',
            tenantId: 'test-tenant',
            name: 'Jane Smith',
            role: 'Director',
            company: 'Corp B',
            primaryAudience: 'executives',
            isActive: true,
            pk: 'test-tenant#persona-2',
            sk: 'persona',
            GSI1PK: 'test-tenant',
            GSI1SK: 'persona#2023-01-02T00:00:00.000Z'
          })
        ]
      };

      ddbMock.on(QueryCommand).resolves(mockPersonas);

      const event = createMockEvent('GET');
      const response = await listPersonasHandler(event);

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.personas).toBeDefined();
      expect(responseBody.personas.length).toBe(2);
      expect(responseBody.personas[0].name).toBe('John Doe');
      expect(responseBody.personas[1].name).toBe('Jane Smith');
      expect(responseBody.personas[0].pk).toBeUndefined();
      expect(responseBody.personas[0].sk).toBeUndefined();
    });

    it('should filter personas by search term', async () => {
      const mockPersonas = {
        Items: [
          marshall({
            personaId: 'persona-1',
            name: 'John Manager',
            role: 'Marketing Manager',
            company: 'Tech Corp',
            primaryAudience: 'professionals',
            isActive: true
          }),
          marshall({
            personaId: 'persona-2',
            name: 'Jane Director',
            role: 'Sales Director',
            company: 'Sales Inc',
            primaryAudience: 'executives',
            isActive: true
          })
        ]
      };

      ddbMock.on(QueryCommand).resolves(mockPersonas);

      const event = createMockEvent('GET', null, {}, { search: 'Manager' });
      const response = await listPersonasHandler(event);

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.personas.length).toBe(1);
      expect(responseBody.personas[0].name).toBe('John Manager');
    });

    it('should handle pagination with nextToken', async () => {
      const mockPersonas = {
        Items: [
          marshall({
            personaId: 'persona-1',
            name: 'John Doe',
            isActive: true
          })
        ],
        LastEvaluatedKey: marshall({
          pk: 'test-tenant#persona-1',
          sk: 'persona'
        })
      };

      ddbMock.on(QueryCommand).resolves(mockPersonas);

      const event = createMockEvent('GET', null, {}, { limit: '1' });
      const response = await listPersonasHandler(event);

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.personas.length).toBe(1);
      expect(responseBody.nextToken).toBeDefined();
    });

    it('should return 400 for invalid nextToken', async () => {
      const event = createMockEvent('GET', null, {}, { nextToken: 'invalid-token' });
      const response = await listPersonasHandler(event);

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Invalid nextToken');
      expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(0);
    });

    it('should return empty list when no personas found', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const event = createMockEvent('GET');
      const response = await listPersonasHandler(event);

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.personas).toEqual([]);
    });
  });
});
