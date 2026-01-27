export const getBrandDefaults = (primaryAudience) => {
  const defaults = {
    executives: {
      voiceGuidelines: {
        tone: ['professional', 'authoritative', 'strategic'],
        style: ['clear', 'concise', 'data-driven'],
        messaging: ['leadership', 'results', 'innovation']
      },
      contentStandards: {
        qualityRequirements: ['fact-checked', 'professional', 'strategic'],
        restrictions: ['avoid controversial topics', 'maintain professional tone']
      },
      visualIdentity: {
        colorPalette: ['#1E3A8A', '#3B82F6', '#EFF6FF'],
        typography: ['sans-serif', 'professional'],
        imagery: ['professional', 'clean', 'modern']
      },
      platformGuidelines: {
        enabled: ['linkedin', 'twitter'],
        defaults: {
          linkedin: {
            defaultAsset: 'none',
            linkPolicy: 'allowed',
            emojiPolicy: 'none',
            hashtagPolicy: 'sparing',
            typicalCadencePerWeek: 3
          },
          twitter: {
            defaultAsset: 'none',
            linkPolicy: 'allowed',
            emojiPolicy: 'sparing',
            hashtagPolicy: 'sparing',
            typicalCadencePerWeek: 5
          },
          instagram: {
            defaultAsset: 'none',
            linkPolicy: 'discouraged',
            emojiPolicy: 'none',
            hashtagPolicy: 'none',
            typicalCadencePerWeek: 0
          },
          facebook: {
            defaultAsset: 'none',
            linkPolicy: 'allowed',
            emojiPolicy: 'none',
            hashtagPolicy: 'none',
            typicalCadencePerWeek: 0
          }
        }
      },
      claimsPolicy: {
        noGuarantees: true,
        noPerformanceNumbersUnlessProvided: true,
        requireSourceForStats: true,
        competitorMentionPolicy: 'avoid'
      },
      approvalPolicy: {
        threshold: 0.8,
        mode: 'require_review_below_threshold'
      }
    },
    professionals: {
      voiceGuidelines: {
        tone: ['approachable', 'knowledgeable', 'helpful'],
        style: ['conversational', 'clear', 'practical'],
        messaging: ['expertise', 'collaboration', 'growth']
      },
      contentStandards: {
        qualityRequirements: ['accurate', 'actionable', 'engaging'],
        restrictions: ['avoid overly technical jargon']
      },
      visualIdentity: {
        colorPalette: ['#2563EB', '#60A5FA', '#DBEAFE'],
        typography: ['sans-serif', 'readable'],
        imagery: ['professional', 'diverse', 'relatable']
      },
      platformGuidelines: {
        enabled: ['linkedin', 'twitter', 'facebook'],
        defaults: {
          linkedin: {
            defaultAsset: 'none',
            linkPolicy: 'allowed',
            emojiPolicy: 'sparing',
            hashtagPolicy: 'allowed',
            typicalCadencePerWeek: 4
          },
          twitter: {
            defaultAsset: 'none',
            linkPolicy: 'allowed',
            emojiPolicy: 'sparing',
            hashtagPolicy: 'allowed',
            typicalCadencePerWeek: 5
          },
          facebook: {
            defaultAsset: 'none',
            linkPolicy: 'allowed',
            emojiPolicy: 'sparing',
            hashtagPolicy: 'sparing',
            typicalCadencePerWeek: 3
          },
          instagram: {
            defaultAsset: 'none',
            linkPolicy: 'discouraged',
            emojiPolicy: 'sparing',
            hashtagPolicy: 'allowed',
            typicalCadencePerWeek: 0
          }
        }
      },
      claimsPolicy: {
        noGuarantees: true,
        noPerformanceNumbersUnlessProvided: true,
        requireSourceForStats: true,
        competitorMentionPolicy: 'neutral_only'
      },
      approvalPolicy: {
        threshold: 0.7,
        mode: 'auto_approve'
      }
    },
    consumers: {
      voiceGuidelines: {
        tone: ['friendly', 'enthusiastic', 'helpful'],
        style: ['simple', 'engaging', 'visual'],
        messaging: ['value', 'experience', 'community']
      },
      contentStandards: {
        qualityRequirements: ['engaging', 'clear', 'visual'],
        restrictions: ['avoid technical jargon', 'keep it simple']
      },
      visualIdentity: {
        colorPalette: ['#EC4899', '#F472B6', '#FCE7F3'],
        typography: ['sans-serif', 'friendly'],
        imagery: ['vibrant', 'lifestyle', 'diverse']
      },
      platformGuidelines: {
        enabled: ['instagram', 'facebook', 'twitter'],
        defaults: {
          instagram: {
            defaultAsset: 'image',
            linkPolicy: 'discouraged',
            emojiPolicy: 'allowed',
            hashtagPolicy: 'allowed',
            typicalCadencePerWeek: 7
          },
          facebook: {
            defaultAsset: 'image',
            linkPolicy: 'allowed',
            emojiPolicy: 'allowed',
            hashtagPolicy: 'allowed',
            typicalCadencePerWeek: 5
          },
          twitter: {
            defaultAsset: 'none',
            linkPolicy: 'allowed',
            emojiPolicy: 'allowed',
            hashtagPolicy: 'allowed',
            typicalCadencePerWeek: 7
          },
          linkedin: {
            defaultAsset: 'none',
            linkPolicy: 'allowed',
            emojiPolicy: 'sparing',
            hashtagPolicy: 'sparing',
            typicalCadencePerWeek: 0
          }
        }
      },
      claimsPolicy: {
        noGuarantees: true,
        noPerformanceNumbersUnlessProvided: true,
        requireSourceForStats: false,
        competitorMentionPolicy: 'avoid'
      },
      approvalPolicy: {
        threshold: 0.6,
        mode: 'auto_approve'
      }
    },
    technical: {
      voiceGuidelines: {
        tone: ['precise', 'technical', 'authoritative'],
        style: ['detailed', 'accurate', 'technical'],
        messaging: ['innovation', 'technical excellence', 'reliability']
      },
      contentStandards: {
        qualityRequirements: ['technically accurate', 'detailed', 'well-sourced'],
        restrictions: ['avoid marketing hype', 'maintain technical accuracy']
      },
      visualIdentity: {
        colorPalette: ['#0F172A', '#475569', '#E2E8F0'],
        typography: ['monospace', 'technical'],
        imagery: ['technical', 'diagrams', 'code']
      },
      platformGuidelines: {
        enabled: ['twitter', 'linkedin'],
        defaults: {
          twitter: {
            defaultAsset: 'none',
            linkPolicy: 'allowed',
            emojiPolicy: 'none',
            hashtagPolicy: 'sparing',
            typicalCadencePerWeek: 5
          },
          linkedin: {
            defaultAsset: 'none',
            linkPolicy: 'allowed',
            emojiPolicy: 'none',
            hashtagPolicy: 'sparing',
            typicalCadencePerWeek: 3
          },
          instagram: {
            defaultAsset: 'none',
            linkPolicy: 'discouraged',
            emojiPolicy: 'none',
            hashtagPolicy: 'none',
            typicalCadencePerWeek: 0
          },
          facebook: {
            defaultAsset: 'none',
            linkPolicy: 'allowed',
            emojiPolicy: 'none',
            hashtagPolicy: 'none',
            typicalCadencePerWeek: 0
          }
        }
      },
      claimsPolicy: {
        noGuarantees: true,
        noPerformanceNumbersUnlessProvided: true,
        requireSourceForStats: true,
        competitorMentionPolicy: 'neutral_only'
      },
      approvalPolicy: {
        threshold: 0.8,
        mode: 'require_review_below_threshold'
      }
    },
    creative: {
      voiceGuidelines: {
        tone: ['inspiring', 'innovative', 'expressive'],
        style: ['creative', 'visual', 'storytelling'],
        messaging: ['creativity', 'innovation', 'inspiration']
      },
      contentStandards: {
        qualityRequirements: ['creative', 'engaging', 'original'],
        restrictions: ['avoid corporate speak']
      },
      visualIdentity: {
        colorPalette: ['#8B5CF6', '#A78BFA', '#EDE9FE'],
        typography: ['creative', 'expressive'],
        imagery: ['artistic', 'creative', 'inspiring']
      },
      platformGuidelines: {
        enabled: ['instagram', 'twitter', 'facebook'],
        defaults: {
          instagram: {
            defaultAsset: 'image',
            linkPolicy: 'discouraged',
            emojiPolicy: 'allowed',
            hashtagPolicy: 'allowed',
            typicalCadencePerWeek: 7
          },
          twitter: {
            defaultAsset: 'none',
            linkPolicy: 'allowed',
            emojiPolicy: 'allowed',
            hashtagPolicy: 'allowed',
            typicalCadencePerWeek: 5
          },
          facebook: {
            defaultAsset: 'image',
            linkPolicy: 'allowed',
            emojiPolicy: 'allowed',
            hashtagPolicy: 'allowed',
            typicalCadencePerWeek: 4
          },
          linkedin: {
            defaultAsset: 'none',
            linkPolicy: 'allowed',
            emojiPolicy: 'sparing',
            hashtagPolicy: 'sparing',
            typicalCadencePerWeek: 0
          }
        }
      },
      claimsPolicy: {
        noGuarantees: true,
        noPerformanceNumbersUnlessProvided: true,
        requireSourceForStats: false,
        competitorMentionPolicy: 'avoid'
      },
      approvalPolicy: {
        threshold: 0.7,
        mode: 'auto_approve'
      }
    }
  };

  if (!defaults[primaryAudience]) {
    throw new Error(`Invalid primaryAudience: ${primaryAudience}`);
  }

  return defaults[primaryAudience];
};
