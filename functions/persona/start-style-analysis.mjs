import { DynamoDBClient, QueryCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { z } from 'zod';
import { formatResponse } from '../../utils/api-response.mjs';
import { personaLogger } from '../../utils/logger.mjs';

const ddb = new DynamoDBClient();
const eventBridge = new EventBridgeClient();

// Request validation schema
const triggerAnalysisSchema = z.object({
  personaId: z.string().min(1, 'Persona ID is required'),
  tenantId: z.string().min(1, 'Tenant ID is required')
});

async function validatePersona(tenantId, personaId) {
  const getParams = {
    TableName: process.env.TABLE_NAME,
    Key: marshall({
      pk: `${tenantId}#${personaId}`,
      sk: 'persona'
    })
  };

  const personaResponse = await ddb.send(new GetItemCommand(getParams));

  if (!personaResponse.Item) {
    throw new Error(`Persona ${personaId} not found for tenant ${tenantId}`);
  }

  const persona = unmarshall(personaResponse.Item);

  if (!persona.isActive) {
    throw new Error(`Persona ${personaId} is not active`);
  }

  return persona;
}

async function validateExamples(tenantId, personaId) {
  const queryParams = {
    TableName: process.env.TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
    ExpressionAttributeValues: marshall({
      ':pk': `${tenantId}#${personaId}`,
      ':skPrefix': 'example#'
    }),
    Select: 'COUNT'
  };

  const exampleCountResponse = await ddb.send(new QueryCommand(queryParams));
  const exampleCount = exampleCountResponse.Count || 0;

  if (exampleCount < 5) {
    const error = new Error(`Insufficient writing examples. Found ${exampleCount}, minimum 5 required for style analysis.`);
    error.exampleCount = exampleCount;
    error.required = 5;
    throw error;
  }

  return exampleCount;
}

/**
 * Trigger async style analysis via EventBridge
 * @param {string} tenantId - Tenant identifier
 * @param {string} personaId - Persona identifier
 * @returns {Object} Event result
 */
async function triggerStyleAnalysis(tenantId, personaId) {
  const requestId = `analysis_${Date.now()}`;
  const triggeredAt = new Date().toISOString();

  const eventParams = {
    Entries: [
      {
        Source: 'persona-management-api',
        DetailType: 'Style Analysis Requested',
        Detail: JSON.stringify({
          personaId,
          tenantId,
          requestId
        })
      }
    ]
  };

  const eventResponse = await eventBridge.send(new PutEventsCommand(eventParams));

  return {
    requestId,
    eventId: eventResponse.Entries[0].EventId,
    triggeredAt
  };
}

/**
 * Lambda handler for triggering style analysis
 * @param {Object} event - API Gateway event
 * @returns {Object} HTTP response
 */
export const handler = async (event) => {
  try {
    const tenantId = event.requestContext?.authorizer?.tenantId;
    const personaId = event.pathParameters?.personaId;

    if (!tenantId) {
      return formatResponse(401, { message: 'Unauthorized' });
    }

    const validatedInput = triggerAnalysisSchema.parse({
      personaId,
      tenantId
    });

    await validatePersona(validatedInput.tenantId, validatedInput.personaId);

    const exampleCount = await validateExamples(validatedInput.tenantId, validatedInput.personaId);

    // Trigger async style analysis
    const analysisResult = await triggerStyleAnalysis(validatedInput.tenantId, validatedInput.personaId);

    return formatResponse(202, {
      message: 'Style analysis started',
      personaId: validatedInput.personaId,
      exampleCount,
      requestId: analysisResult.requestId
    });

  } catch (error) {
    personaLogger.error('Style analysis trigger operation failed', {
      operation: 'startStyleAnalysis',
      tenantId: event.requestContext?.authorizer?.tenantId,
      personaId: event.pathParameters?.personaId,
      errorName: error.name,
      errorMessage: error.message
    });

    if (error instanceof z.ZodError) {
      if (error.errors.some(e => e.path.includes('personaId'))) {
        return formatResponse(400, { message: 'Required' });
      }
      return formatResponse(400, { message: 'Invalid request parameters' });
    }

    if (error.message.includes('not found')) {
      return formatResponse(404, { message: 'Persona not found' });
    }

    if (error.message.includes('not active')) {
      return formatResponse(400, { message: 'Persona is not active' });
    }

    if (error.message.includes('Insufficient')) {
      return formatResponse(422, {
        message: error.message,
        required: error.required,
        provided: error.exampleCount
      });
    }

    return formatResponse(500, { message: 'Internal server error' });
  }
};
