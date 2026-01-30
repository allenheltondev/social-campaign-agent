import { Persona, PersonaSchema } from '../../models/persona.mjs';
import { logger } from '../../utils/logger.mjs';

const QueryParamsSchema = PersonaSchema.pick({
  company: true,
  role: true,
  primaryAudience: true
}).partial();

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;

    if (!tenantId) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Unauthorized' })
      };
    }

    const queryParams = QueryParamsSchema.parse(event.queryStringParameters || {});

    const personaListResponse = await Persona.list(tenantId, queryParams);

    const response = {
      personas: personaListResponse.items,
      ...personaListResponse.pagination
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(response)
    };
  } catch (error) {
    logger.error('List personas operation failed', {
      operation: 'listPersonas',
      tenantId: event.requestContext?.authorizer?.tenantId,
      errorName: error.name,
      errorMessage: error.message
    });

    if (error.message.includes('validation error') || error.message.includes('Invalid nextToken')) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: error.message })
      };
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};
