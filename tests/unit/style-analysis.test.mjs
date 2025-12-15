import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, GetItemCommand, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { handler as startStyleAnalysisHandler } from '../../functions/persona/start-style-analysis.mjs';
import { handler as styleAnalysisCompleteHandler } from '../../functions/persona/events/style-analysis-complete.mjs';

const ddbMock = mockClient(DynamoDBClient);
const eventBridgeMock = mockClient(EventBridgeClient);

const createMockEvent = (method, body = null, pathParameters = {}, tenantId = 'test-tenant') => ({
  httpMethod: method,
  body: body ? JSON.stringify(body) : null,
  pathParameters,
  requestContext: {
    authorizer: {
      tenantId
    }
  }
});

const createEventBridgeEvent = (source, detailType, detail) => ({
  source: [source],
  'detail-type': detailType,
  detail
});

describe('Style Analysis Lambda Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ddbMock.reset();
    eventBridgeMock.reset();
    process.env.TABLE_NAME = 'TestTable';
    process.env.EVENT_BUS_NAME = 'default';
  });

  describe('Start Style Analysis Function', () => {
    it('should start style analysis successfully with sufficient examples', async () => {
      const mockPersona = marshall({
        personaId: 'test-persona-id',
        tenantId: 'test-tenant',
        name: 'Test Persona',
        isActive: true
      });

      ddbMock.on(GetItemCommand).resolves({ Item: mockPersona });
      ddbMock.on(QueryCommand).resolves({ Count: 5 });
      eventBridgeMock.on(PutEventsCommand).resolves({
        Entries: [{ EventId: 'test-event-id' }]
      });

      const event = createMockEvent('POST', {}, { personaId: 'test-persona-id' });
      const response = await startStyleAnalysisHandler(event);

      expect(response.statusCode).toBe(202);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toContain('Style analysis started');
      expect(responseBody.personaId).toBe('test-persona-id');
      expect(responseBody.exampleCount).toBe(5);
      expect(ddbMock.commandCalls(GetItemCommand)).toHaveLength(1);
      expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(1);
      expect(eventBridgeMock.commandCalls(PutEventsCommand)).toHaveLength(1);
    });

    it('should return 422 when insufficient writing samples', async () => {
      const mockPersona = marshall({
        personaId: 'test-persona-id',
        tenantId: 'test-tenant',
        name: 'Test Persona',
        isActive: true
      });

      ddbMock.on(GetItemCommand).resolves({ Item: mockPersona });
      ddbMock.on(QueryCommand).resolves({ Count: 2 });

      const event = createMockEvent('POST', {}, { personaId: 'test-persona-id' });
      const response = await startStyleAnalysisHandler(event);

      expect(response.statusCode).toBe(422);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toContain('Insufficient writing examples');
      expect(responseBody.required).toBe(5);
      expect(responseBody.provided).toBe(2);
      expect(ddbMock.commandCalls(GetItemCommand)).toHaveLength(1);
      expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(1);
      expect(eventBridgeMock.commandCalls(PutEventsCommand)).toHaveLength(0);
    });

    it('should return 404 when persona not found', async () => {
      ddbMock.on(GetItemCommand).resolves({});

      const event = createMockEvent('POST', {}, { personaId: 'non-existent-id' });
      const response = await startStyleAnalysisHandler(event);

      expect(response.statusCode).toBe(404);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Persona not found');
      expect(ddbMock.commandCalls(GetItemCommand)).toHaveLength(1);
    });

    it('should return 400 when personaId is missing', async () => {
      const event = createMockEvent('POST', {}, {});
      const response = await startStyleAnalysisHandler(event);

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toContain('Required');
      expect(ddbMock.commandCalls(GetItemCommand)).toHaveLength(0);
    });

    it('should return 401 when tenant ID is missing', async () => {
      const event = createMockEvent('POST', {}, { personaId: 'test-persona-id' }, null);
      event.requestContext.authorizer = {};

      const response = await startStyleAnalysisHandler(event);

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Unauthorized');
      expect(ddbMock.commandCalls(GetItemCommand)).toHaveLength(0);
    });

    it('should return 400 when persona is inactive', async () => {
      const mockInactivePersona = marshall({
        personaId: 'test-persona-id',
        tenantId: 'test-tenant',
        name: 'Inactive Persona',
        isActive: false
      });

      ddbMock.on(GetItemCommand).resolves({ Item: mockInactivePersona });

      const event = createMockEvent('POST', {}, { personaId: 'test-persona-id' });
      const response = await startStyleAnalysisHandler(event);

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toContain('not active');
    });

    it('should handle DynamoDB errors', async () => {
      ddbMock.on(GetItemCommand).rejects(new Error('DynamoDB error'));

      const event = createMockEvent('POST', {}, { personaId: 'test-persona-id' });
      const response = await startStyleAnalysisHandler(event);

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Internal server error');
    });

    it('should handle EventBridge errors', async () => {
      const mockPersona = marshall({
        personaId: 'test-persona-id',
        tenantId: 'test-tenant',
        name: 'Test Persona',
        isActive: true
      });

      ddbMock.on(GetItemCommand).resolves({ Item: mockPersona });
      ddbMock.on(QueryCommand).resolves({ Count: 5 });
      eventBridgeMock.on(PutEventsCommand).rejects(new Error('EventBridge error'));

      const event = createMockEvent('POST', {}, { personaId: 'test-persona-id' });
      const response = await startStyleAnalysisHandler(event);

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Internal server error');
    });
  });

  describe('Style Analysis Complete Function', () => {
    it('should handle successful style analysis completion', async () => {
      const mockStyleData = {
        sentenceLengthPattern: {
          avgWordsPerSentence: 18,
          variance: 'medium',
          classification: 'medium'
        },
        structurePreference: 'mixed',
        pacing: 'even',
        emojiFrequency: 0.15,
        expressivenessMarkers: 'medium',
        analogyUsage: 'occasional',
        imageryMetaphorUsage: 'occasional',
        toneTags: ['professional', 'warm'],
        overallTone: 'Professional and approachable',
        assertiveness: 'medium',
        hedgingStyle: 'some',
        hookStyle: 'question',
        anecdoteUsage: 'occasional',
        confidence: {
          overall: 0.85,
          coverage: {
            exampleCount: 5,
            platformCount: 2,
            intentCount: 3
          },
          consistencyByFeature: {
            sentenceLength: 0.8,
            structure: 0.75,
            expressiveness: 0.7,
            metaphors: 0.65,
            tone: 0.85,
            assertiveness: 0.8,
            hooks: 0.7
          }
        }
      };

      const eventBridgeEvent = createEventBridgeEvent(
        'persona-management-api',
        'Style Analysis Completed',
        {
          personaId: 'test-persona-id',
          tenantId: 'test-tenant',
          requestId: 'test-request-123',
          styleData: mockStyleData,
          success: true
        }
      );

      ddbMock.on(UpdateItemCommand).resolves({});

      const response = await styleAnalysisCompleteHandler(eventBridgeEvent);

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toContain('Style analysis completed');
      expect(ddbMock.commandCalls(UpdateItemCommand)).toHaveLength(1);
    });

    it('should handle failed style analysis', async () => {
      const eventBridgeEvent = createEventBridgeEvent(
        'persona-management-api',
        'Style Analysis Completed',
        {
          personaId: 'test-persona-id',
          tenantId: 'test-tenant',
          requestId: 'test-request-456',
          success: false,
          error: 'Analysis service temporarily unavailable'
        }
      );

      ddbMock.on(UpdateItemCommand).resolves({});

      const response = await styleAnalysisCompleteHandler(eventBridgeEvent);

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toContain('Style analysis failed');
      expect(responseBody.error).toBe('Analysis service temporarily unavailable');
      expect(ddbMock.commandCalls(UpdateItemCommand)).toHaveLength(1);
    });

    it('should return 400 for missing required fields', async () => {
      const invalidEvent = createEventBridgeEvent(
        'persona-management-api',
        'Style Analysis Completed',
        {
          requestId: 'test-request-789',
          success: true
        }
      );

      const response = await styleAnalysisCompleteHandler(invalidEvent);

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toContain('Missing required fields');
      expect(ddbMock.commandCalls(UpdateItemCommand)).toHaveLength(0);
    });

    it('should handle DynamoDB errors during update', async () => {
      const eventBridgeEvent = createEventBridgeEvent(
        'persona-management-api',
        'Style Analysis Completed',
        {
          personaId: 'test-persona-id',
          tenantId: 'test-tenant',
          requestId: 'test-request-error',
          success: true,
          styleData: {
            sentenceLengthPattern: { avgWordsPerSentence: 15 },
            structurePreference: 'mixed',
            toneTags: ['professional']
          }
        }
      );

      ddbMock.on(UpdateItemCommand).rejects(new Error('DynamoDB update error'));

      const response = await styleAnalysisCompleteHandler(eventBridgeEvent);

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Internal server error');
    });

    it('should validate style data structure for successful completion', async () => {
      const eventWithInvalidStyleData = createEventBridgeEvent(
        'persona-management-api',
        'Style Analysis Completed',
        {
          personaId: 'test-persona-id',
          tenantId: 'test-tenant',
          requestId: 'test-request-invalid',
          success: true,
          styleData: {
            toneTags: ['professional']
          }
        }
      );

      const response = await styleAnalysisCompleteHandler(eventWithInvalidStyleData);

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toContain('Invalid style data structure');
      expect(ddbMock.commandCalls(UpdateItemCommand)).toHaveLength(0);
    });

    it('should increment persona version on successful style update', async () => {
      const mockStyleData = {
        sentenceLengthPattern: { avgWordsPerSentence: 20, variance: 'high', classification: 'varied' },
        structurePreference: 'lists',
        toneTags: ['analytical', 'direct'],
        confidence: { overall: 0.9 }
      };

      const eventBridgeEvent = createEventBridgeEvent(
        'persona-management-api',
        'Style Analysis Completed',
        {
          personaId: 'test-persona-id',
          tenantId: 'test-tenant',
          requestId: 'test-request-version',
          styleData: mockStyleData,
          success: true
        }
      );

      const updatedPersonaData = marshall({
        personaId: 'test-persona-id',
        version: 2,
        inferredStyle: mockStyleData
      });

      ddbMock.on(UpdateItemCommand).resolves({
        Attributes: updatedPersonaData
      });

      const response = await styleAnalysisCompleteHandler(eventBridgeEvent);

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toContain('Style analysis completed');
      expect(ddbMock.commandCalls(UpdateItemCommand)).toHaveLength(1);
    });
  });
});
