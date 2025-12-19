import { Persona, UpdatePersonaRequestSchema, validateRequestBody } from '../../models/persona.mjs';
import { formatResponse } from '../../utils/api-response.mjs';

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
    console.error('Update persona error:', error);

    if (error.message.includes('Validation error')) {
      return formatResponse(400, { message: error.message });
    }

    return formatResponse(500, { message: 'Internal server error' });
  }
};
