import { Persona, PersonaSchema } from '../../models/persona.mjs';
import { logger } from '../../utils/logger.mjs';
import { getPersonaDefaults } from '../../utils/defaults.mjs';

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

    const createSchema = PersonaSchema.pick({
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
    });

    const requestData = createSchema.parse(JSON.parse(event.body));

    const defaults = getPersonaDefaults(requestData.primaryAudience);

    const personaWithDefaults = {
      ...defaults,
      ...requestData,
      voiceTraits: requestData.voiceTraits || defaults.voiceTraits,
      writingHabits: requestData.writingHabits || defaults.writingHabits,
      opinions: requestData.opinions || defaults.opinions,
      language: requestData.language || defaults.language,
      ctaStyle: requestData.ctaStyle || defaults.ctaStyle
    };

    const persona = await Persona.save(tenantId, personaWithDefaults);

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ id: persona.id })
    };
  } catch (error) {
    logger.error('Create persona failed', {
      operation: 'create-persona',
      tenantId: event.requestContext?.authorizer?.tenantId,
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
