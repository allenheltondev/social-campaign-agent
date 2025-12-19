import { Persona, QueryPersonasRequestSchema, validateQueryParams } from '../../models/persona.mjs';
import { formatResponse } from '../../utils/api-response.mjs';

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;

    if (!tenantId) {
      return formatResponse(401, { message: 'Unauthorized' });
    }

    const queryParams = validateQueryParams(QueryPersonasRequestSchema, event.queryStringParameters || {});

    const result = await Persona.list(tenantId, queryParams);

    // Transform to maintain backward compatibility while using standardized format
    const response = {
      personas: result.items,
      ...result.pagination
    };

    return formatResponse(200, response);
  } catch (error) {
    console.error('List personas error:', error);

    if (error.message.includes('validation error') || error.message.includes('Invalid nextToken')) {
      return formatResponse(400, { message: error.message });
    }

    return formatResponse(500, { message: 'Internal server error' });
  }
};
