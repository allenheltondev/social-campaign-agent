export const getPersonaDefaults = (primaryAudience) => {
  const defaults = {
    executives: {
      voiceTraits: ['strategic', 'authoritative', 'results-oriented'],
      writingHabits: {
        paragraphs: 'medium',
        questions: 'occasional',
        emojis: 'none',
        structure: 'prose'
      },
      opinions: {
        strongBeliefs: ['Leadership drives results'],
        avoidsTopics: []
      },
      language: {
        avoid: ['slang', 'jargon'],
        prefer: ['clear', 'direct', 'professional']
      },
      ctaStyle: {
        aggressiveness: 'medium',
        patterns: ['Learn more', 'Discover how']
      }
    },
    professionals: {
      voiceTraits: ['knowledgeable', 'practical', 'collaborative'],
      writingHabits: {
        paragraphs: 'medium',
        questions: 'frequent',
        emojis: 'sparing',
        structure: 'mixed'
      },
      opinions: {
        strongBeliefs: ['Continuous learning matters'],
        avoidsTopics: []
      },
      language: {
        avoid: ['overly formal'],
        prefer: ['conversational', 'clear', 'actionable']
      },
      ctaStyle: {
        aggressiveness: 'medium',
        patterns: ['Check it out', 'Learn more', 'Share your thoughts']
      }
    },
    consumers: {
      voiceTraits: ['friendly', 'relatable', 'helpful'],
      writingHabits: {
        paragraphs: 'short',
        questions: 'frequent',
        emojis: 'frequent',
        structure: 'mixed'
      },
      opinions: {
        strongBeliefs: ['Customer experience is everything'],
        avoidsTopics: []
      },
      language: {
        avoid: ['jargon', 'technical terms'],
        prefer: ['simple', 'friendly', 'conversational']
      },
      ctaStyle: {
        aggressiveness: 'high',
        patterns: ['Try it now', 'Get started', 'Shop now']
      }
    },
    technical: {
      voiceTraits: ['precise', 'analytical', 'detail-oriented'],
      writingHabits: {
        paragraphs: 'long',
        questions: 'occasional',
        emojis: 'none',
        structure: 'lists'
      },
      opinions: {
        strongBeliefs: ['Technical accuracy is critical'],
        avoidsTopics: []
      },
      language: {
        avoid: ['marketing speak', 'hype'],
        prefer: ['technical', 'precise', 'data-driven']
      },
      ctaStyle: {
        aggressiveness: 'low',
        patterns: ['Read the docs', 'View details', 'Explore']
      }
    },
    creative: {
      voiceTraits: ['expressive', 'innovative', 'inspiring'],
      writingHabits: {
        paragraphs: 'medium',
        questions: 'frequent',
        emojis: 'frequent',
        structure: 'prose'
      },
      opinions: {
        strongBeliefs: ['Creativity drives innovation'],
        avoidsTopics: []
      },
      language: {
        avoid: ['corporate speak', 'rigid'],
        prefer: ['vivid', 'metaphorical', 'storytelling']
      },
      ctaStyle: {
        aggressiveness: 'medium',
        patterns: ['Get inspired', 'Explore', 'Create with us']
      }
    }
  };

  if (!defaults[primaryAudience]) {
    throw new Error(`Invalid primaryAudience: ${primaryAudience}`);
  }

  return defaults[primaryAudience];
};
