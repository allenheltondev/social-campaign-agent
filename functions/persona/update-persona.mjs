import { Persona, UpdatePersonaRequestSchema, validateRequestBody } from '../../models/persona.mjs';
import { formatResponse } from '../../utils/api-response.mjs';
import { personaLogger } from '../../utils/logger.mjs';

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { personaId } = event.pathParameters;

    if (!tenantId) {
      return formatResponse(401, { message: 'Unauthorized' });
    }

    if (!personaId) {
      return formatResponse(400, { message: 'Missing personaId parameter' });
    }

    const updates = validateRequestBody(UpdatePersonaRequestSchema, event.body);

    if (Object.keys(updates).length === 0) {
      return formatResponse(400, { message: 'No valid fields to update' });
    }

    const updatedPersona = await Persona.update(tenantId, personaId, updates);

    if (!updatedPersona) {
      return formatResponse(404, { message: 'Persona not found' });
    }

    return formatResponse(200, updatedPersona);
  } catch (error) {
    personaLogger.error('Update persona operation failed', {
      operation: 'updatePersona',
      tenantId: event.requestContext?.authorizer?.tenantId,
      personaId: event.pathParameters?.personaId,
      errorName: error.name,
      errorMessage: error.message
    });

    if (error.message.includes('Validation error')) {
      return formatResponse(400, { message: error.message });
    }

    return formatResponse(500, { message: 'Internal server error' });
  }
};
