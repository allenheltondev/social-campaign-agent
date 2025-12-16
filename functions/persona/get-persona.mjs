import { Persona } from '../../models/persona.mjs';
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

    const persona = await Persona.findById(tenantId, personaId);

    if (!persona) {
      return formatResponse(404, { message: 'Persona not found' });
    }

    return formatResponse(200, persona);
  } catch (error) {
    console.error('Get persona error:', error);
    return formatResponse(500, { message: 'Internal server error' });
  }
};
