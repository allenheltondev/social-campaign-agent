import { Persona, QueryPersonasRequestSchema, validateQueryParams } from '../../models/persona.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import { personaLogger } from '../../utils/logger.mjs';

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;

    if (!tenantId) {
      return formatResponse(401, { message: 'Unauthorized' });
    }

    const queryParams = validateQueryParams(QueryPersonasRequestSchema, event.queryStringParameters || {});

    const personaListResponse = await Persona.list(tenantId, queryParams);

    const response = {
      personas: personaListResponse.items,
      ...personaListResponse.pagination
    };

    return formatResponse(200, response);
  } catch (error) {
    personaLogger.error('List personas operation failed', {
      operation: 'listPersonas',
      tenantId: event.requestContext?.authorizer?.tenantId,
      errorName: error.name,
      errorMessage: error.message
    });

    if (error.message.includes('validation error') || error.message.includes('Invalid nextToken')) {
      return formatResponse(400, { message: error.message });
    }

    return formatResponse(500, { message: 'Internal server error' });
  }
};
