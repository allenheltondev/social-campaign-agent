import { Persona, CreatePersonaRequestSchema, validateRequestBody } from '../../models/persona.mjs';
import { formatResponse } from '../../utils/api-response.mjs';

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
    console.error('Create persona error:', error);

    if (error.message.includes('Validation error')) {
      return formatResponse(400, { message: error.message });
    }

    return formatResponse(500, { message: 'Internal server error' });
  }
};
