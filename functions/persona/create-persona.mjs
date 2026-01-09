import { Persona, CreatePersonaRequestSchema, validateRequestBody } from '../../models/persona.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import { personaLogger } from '../../utils/logger.mjs';

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;

    if (!tenantId) {
      return formatResponse(401, { message: 'Unauthorized' });
    }

    const requestData = validateRequestBody(CreatePersonaRequestSchema, event.body);

    const persona = await Persona.save(tenantId, requestData);

    return formatResponse(201, { id: persona.id });
  } catch (error) {
    personaLogger.error('Create persona failed', {
      operation: 'create-persona',
      tenantId: event.requestContext?.authorizer?.tenantId,
      errorName: error.name,
      errorMessage: error.message
    });

    if (error.message.includes('Validation error')) {
      return formatResponse(400, { message: error.message });
    }

    return formatResponse(500, { message: 'Internal server error' });
  }
};
