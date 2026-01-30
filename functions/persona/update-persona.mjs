import { PersonaSchema, Persona } from '../../models/persona.mjs';
import { logger } from '../../utils/logger.mjs';

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { personaId } = event.pathParameters;

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

    if (!personaId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Missing personaId parameter' })
      };
    }

    const updateSchema = PersonaSchema.pick({
      name: true,
      role: true,
      company: true,
      primaryAudience: true
    }).extend({
      voiceTraits: PersonaSchema.shape.voiceTraits.optional(),
      writingHabits: PersonaSchema.shape.writingHabits.optional(),
      opinions: PersonaSchema.shape.opinions.optional(),
      language: PersonaSchema.shape.language.optional(),
      ctaStyle: PersonaSchema.shape.ctaStyle.optional()
    }).partial();

    const updates = updateSchema.parse(JSON.parse(event.body));

    if (Object.keys(updates).length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'No valid fields to update' })
      };
    }

    const updatedPersona = await Persona.update(tenantId, personaId, updates);

    if (!updatedPersona) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Persona not found' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(updatedPersona)
    };
  } catch (error) {
    logger.error('Update persona operation failed', {
      operation: 'updatePersona',
      tenantId: event.requestContext?.authorizer?.tenantId,
      personaId: event.pathParameters?.personaId,
      errorName: error.name,
      errorMessage: error.message
    });

    if (error.message.includes('Validation error')) {
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
