import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, PutItemCommand, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { handler as createExampleHandler } from '../../functions/persona/examples/create-example.mjs';
import { handler as listExamplesHandler } from '../../functions/persona/examples/list-examples.mjs';
import { handler as deleteExampleHandler } from '../../functions/persona/examples/delete-example.mjs';

vi.mock('ulid', () => ({
  ulid: vi.fn(() => 'test-example-id-123')
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

describe('Writing Examples Lambda Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ddbMock.reset();
    process.env.TABLE_NAME = 'TestTable';
  });

  describe('Create Example Function', () => {
    it('should create writing example successfully', async () => {
      const validExampleData = {
        platform: 'LinkedIn',
        intent: 'educational',
        text: 'This is a sample writing example for testing purposes. It demonstrates the persona\'s writing style and voice.',
        notes: 'Educational post with engaging tone'
      };

      ddbMock.on(PutItemCommand).resolves({});

      const event = createMockEvent('POST', validExampleData, { personaId: 'test-persona-id' });
      const response = await createExampleHandler(event);

      expect(response.statusCode).toBe(201);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.exampleId).toBe('test-example-id-123');
      expect(responseBody.personaId).toBe('test-persona-id');
      expect(responseBody.tenantId).toBe('test-tenant');
      expect(responseBody.platform).toBe('LinkedIn');
      expect(responseBody.intent).toBe('educational');
      expect(responseBody.text).toBe(validExampleData.text);
      expect(responseBody.notes).toBe(validExampleData.notes);
      expect(responseBody.createdAt).toBeDefined();
      expect(ddbMock.commandCalls(PutItemCommand)).toHaveLength(1);
    });

    it('should create example without optional notes', async () => {
      const exampleDataWithoutNotes = {
        platform: 'Twitter',
        intent: 'opinion',
        text: 'Short opinion tweet without additional notes.'
      };

      ddbMock.on(PutItemCommand).resolves({});

      const event = createMockEvent('POST', exampleDataWithoutNotes, { personaId: 'test-persona-id' });
      const response = await createExampleHandler(event);

      expect(response.statusCode).toBe(201);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.notes).toBeUndefined();
      expect(responseBody.text).toBe(exampleDataWithoutNotes.text);
    });

    it('should return 400 for invalid example data', async () => {
      const invalidExampleData = {
        platform: '',
        intent: 'educational',
        text: ''
      };

      const event = createMockEvent('POST', invalidExampleData, { personaId: 'test-persona-id' });
      const response = await createExampleHandler(event);

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toContain('Validation error');
      expect(ddbMock.commandCalls(PutItemCommand)).toHaveLength(0);
    });

    it('should return 400 when personaId is missing', async () => {
      const validExampleData = {
        platform: 'LinkedIn',
        intent: 'educational',
        text: 'Valid example text'
      };

      const event = createMockEvent('POST', validExampleData, {});
      const response = await createExampleHandler(event);

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Missing personaId parameter');
      expect(ddbMock.commandCalls(PutItemCommand)).toHaveLength(0);
    });

    it('should return 401 when tenant ID is missing', async () => {
      const validExampleData = {
        platform: 'LinkedIn',
        intent: 'educational',
        text: 'Valid example text'
      };

      const event = createMockEvent('POST', validExampleData, { personaId: 'test-persona-id' }, {}, null);
      event.requestContext.authorizer = {};

      const response = await createExampleHandler(event);

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Unauthorized');
      expect(ddbMock.commandCalls(PutItemCommand)).toHaveLength(0);
    });

    it('should handle DynamoDB errors', async () => {
      const validExampleData = {
        platform: 'LinkedIn',
        intent: 'educational',
        text: 'Valid example text'
      };

      ddbMock.on(PutItemCommand).rejects(new Error('DynamoDB error'));

      const event = createMockEvent('POST', validExampleData, { personaId: 'test-persona-id' });
      const response = await createExampleHandler(event);

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Internal server error');
    });
  });

  describe('List Examples Function', () => {
    it('should list writing examples successfully', async () => {
      const mockExamples = {
        Items: [
          marshall({
            exampleId: 'example-1',
            personaId: 'test-persona-id',
            tenantId: 'test-tenant',
            platform: 'LinkedIn',
            intent: 'educational',
            text: 'First example text',
            notes: 'Educational post',
            createdAt: '2023-01-01T00:00:00.000Z',
            pk: 'test-tenant#test-persona-id',
            sk: 'example#example-1',
            GSI1PK: 'test-tenant#test-persona-id',
            GSI1SK: 'example#2023-01-01T00:00:00.000Z'
          }),
          marshall({
            exampleId: 'example-2',
            personaId: 'test-persona-id',
            tenantId: 'test-tenant',
            platform: 'Twitter',
            intent: 'opinion',
            text: 'Second example text',
            createdAt: '2023-01-02T00:00:00.000Z',
            pk: 'test-tenant#test-persona-id',
            sk: 'example#example-2',
            GSI1PK: 'test-tenant#test-persona-id',
            GSI1SK: 'example#2023-01-02T00:00:00.000Z'
          })
        ]
      };

      ddbMock.on(QueryCommand).resolves(mockExamples);

      const event = createMockEvent('GET', null, { personaId: 'test-persona-id' });
      const response = await listExamplesHandler(event);

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.examples).toBeDefined();
      expect(responseBody.examples.length).toBe(2);
      expect(responseBody.examples[0].exampleId).toBe('example-1');
      expect(responseBody.examples[0].platform).toBe('LinkedIn');
      expect(responseBody.examples[1].exampleId).toBe('example-2');
      expect(responseBody.examples[1].platform).toBe('Twitter');
      expect(responseBody.examples[0].pk).toBeUndefined();
      expect(responseBody.examples[0].sk).toBeUndefined();
      expect(responseBody.examples[0].GSI1PK).toBeUndefined();
      expect(responseBody.examples[0].GSI1SK).toBeUndefined();
    });

    it('should return empty list when no examples found', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const event = createMockEvent('GET', null, { personaId: 'test-persona-id' });
      const response = await listExamplesHandler(event);

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.examples).toEqual([]);
    });

    it('should handle pagination with nextToken', async () => {
      const mockExamples = {
        Items: [
          marshall({
            exampleId: 'example-1',
            personaId: 'test-persona-id',
            platform: 'LinkedIn',
            text: 'Example text'
          })
        ],
        LastEvaluatedKey: marshall({
          GSI1PK: 'test-tenant#test-persona-id',
          GSI1SK: 'example#2023-01-01T00:00:00.000Z'
        })
      };

      ddbMock.on(QueryCommand).resolves(mockExamples);

      const event = createMockEvent('GET', null, { personaId: 'test-persona-id' }, { limit: '1' });
      const response = await listExamplesHandler(event);

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.examples.length).toBe(1);
      expect(responseBody.nextToken).toBeDefined();
    });

    it('should return 400 for invalid nextToken', async () => {
      const event = createMockEvent('GET', null, { personaId: 'test-persona-id' }, { nextToken: 'invalid-token' });
      const response = await listExamplesHandler(event);

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Invalid nextToken');
      expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(0);
    });

    it('should return 400 when personaId is missing', async () => {
      const event = createMockEvent('GET', null, {});
      const response = await listExamplesHandler(event);

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Missing personaId parameter');
      expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(0);
    });

    it('should return 401 when tenant ID is missing', async () => {
      const event = createMockEvent('GET', null, { personaId: 'test-persona-id' }, {}, null);
      event.requestContext.authorizer = {};

      const response = await listExamplesHandler(event);

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Unauthorized');
      expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(0);
    });
  });

  describe('Delete Example Function', () => {
    it('should delete writing example successfully', async () => {
      ddbMock.on(UpdateItemCommand).resolves({});

      const event = createMockEvent('DELETE', null, {
        personaId: 'test-persona-id',
        exampleId: 'test-example-id'
      });
      const response = await deleteExampleHandler(event);

      expect(response.statusCode).toBe(204);
      expect(response.body).toBeUndefined();
      expect(ddbMock.commandCalls(UpdateItemCommand)).toHaveLength(1);
    });

    it('should return 400 when personaId is missing', async () => {
      const event = createMockEvent('DELETE', null, { exampleId: 'test-example-id' });
      const response = await deleteExampleHandler(event);

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Missing personaId parameter');
      expect(ddbMock.commandCalls(UpdateItemCommand)).toHaveLength(0);
    });

    it('should return 400 when exampleId is missing', async () => {
      const event = createMockEvent('DELETE', null, { personaId: 'test-persona-id' });
      const response = await deleteExampleHandler(event);

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Missing exampleId parameter');
      expect(ddbMock.commandCalls(UpdateItemCommand)).toHaveLength(0);
    });

    it('should return 401 when tenant ID is missing', async () => {
      const event = createMockEvent('DELETE', null, {
        personaId: 'test-persona-id',
        exampleId: 'test-example-id'
      }, {}, null);
      event.requestContext.authorizer = {};

      const response = await deleteExampleHandler(event);

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Unauthorized');
      expect(ddbMock.commandCalls(UpdateItemCommand)).toHaveLength(0);
    });

    it('should handle DynamoDB errors', async () => {
      ddbMock.on(UpdateItemCommand).rejects(new Error('DynamoDB error'));

      const event = createMockEvent('DELETE', null, {
        personaId: 'test-persona-id',
        exampleId: 'test-example-id'
      });
      const response = await deleteExampleHandler(event);

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Internal server error');
    });
  });
});
