# Configuration DX Simplification - Design

## Overview
This design reduces configuration friction by making most fields optional with intelligent defaults, while maintaining the ability to fully customize when needed. The approach prioritizes speed of initial setup while preserving comprehensive configuration capabilities.

## Design Principles

1. **Minimal Required Fields**: Only require information that cannot be reasonably defaulted
2. **Smart Defaults**: Provide intelligent defaults based on audience type and common patterns
3. **Progressive Enhancement**: Allow users to start simple and add complexity over time
4. **Backward Compatible**: Existing fully-configured entities continue to work
5. **No Quality Loss**: Default configurations produce acceptable content quality

## Persona Configuration Design

### Minimal Required Fields
```javascript
{
  name: string,           // Required
  role: string,           // Required
  company: string,        // Required
  primaryAudience: enum   // Required
}
```

### Smart Defaults by Audience Type

**Executives Audience:**
```javascript
{
  voiceTraits: ["strategic", "authoritative", "results-oriented"],
  writingHabits: {
    paragraphs: "medium",
    questions: "occasional",
    emojis: "none",
    structure: "prose"
  },
  opinions: {
    strongBeliefs: ["Leadership drives results"],
    avoidsTopics: []
  },
  language: {
    avoid: ["slang", "jargon"],
    prefer: ["clear", "direct", "professional"]
  },
  ctaStyle: {
    aggressiveness: "medium",
    patterns: ["Learn more", "Discover how"]
  }
}
```

**Professionals Audience:**
```javascript
{
  voiceTraits: ["knowledgeable", "practical", "collaborative"],
  writingHabits: {
    paragraphs: "medium",
    questions: "frequent",
    emojis: "sparing",
    structure: "mixed"
  },
  opinions: {
    strongBeliefs: ["Continuous learning matters"],
    avoidsTopics: []
  },
  language: {
    avoid: ["overly formal"],
    prefer: ["conversational", "clear", "actionable"]
  },
  ctaStyle: {
    aggressiveness: "medium",
    patterns: ["Check it out", "Learn more", "Share your thoughts"]
  }
}
```

**Consumers Audience:**
```javascript
{
  voiceTraits: ["friendly", "relatable", "helpful"],
  writingHabits: {
    paragraphs: "short",
    questions: "frequent",
    emojis: "frequent",
    structure: "mixed"
  },
  opinions: {
    strongBeliefs: ["Customer experience is everything"],
    avoidsTopics: []
  },
  language: {
    avoid: ["jargon", "technical terms"],
    prefer: ["simple", "friendly", "conversational"]
  },
  ctaStyle: {
    aggressiveness: "high",
    patterns: ["Try it now", "Get started", "Shop now"]
  }
}
```

**Technical Audience:**
```javascript
{
  voiceTraits: ["precise", "analytical", "detail-oriented"],
  writingHabits: {
    paragraphs: "long",
    questions: "occasional",
    emojis: "none",
    structure: "lists"
  },
  opinions: {
    strongBeliefs: ["Technical accuracy is critical"],
    avoidsTopics: []
  },
  language: {
    avoid: ["marketing speak", "hype"],
    prefer: ["technical", "precise", "data-driven"]
  },
  ctaStyle: {
    aggressiveness: "low",
    patterns: ["Read the docs", "View details", "Explore"]
  }
}
```

**Creative Audience:**
```javascript
{
  voiceTraits: ["expressive", "innovative", "inspiring"],
  writingHabits: {
    paragraphs: "varied",
    questions: "frequent",
    emojis: "frequent",
    structure: "prose"
  },
  opinions: {
    strongBeliefs: ["Creativity drives innovation"],
    avoidsTopics: []
  },
  language: {
    avoid: ["corporate speak", "rigid"],
    prefer: ["vivid", "metaphorical", "storytelling"]
  },
  ctaStyle: {
    aggressiveness: "medium",
    patterns: ["Get inspired", "Explore", "Create with us"]
  }
}
```

### Style Inference Without Examples

When no writing examples are provided:
- `inferredStyle` remains `undefined`
- Content generation uses declared `voiceTraits` and `writingHabits`
- `analysisStatus` is not set (field remains undefined)
- User can add examples later via `/personas/{id}/examples` endpoint
- Triggering `/personas/{id}/analyze` will populate `inferredStyle`

## Brand Configuration Design

### Minimal Required Fields
```javascript
{
  name: string,              // Required
  ethos: string,             // Required (1-1000 chars)
  coreValues: string[],      // Required (1-10 items)
  primaryAudience: enum      // Required
}
```

### Smart Defaults by Audience Type

**Executives Audience:**
```javascript
{
  voiceGuidelines: {
    tone: ["professional", "authoritative", "strategic"],
    style: ["clear", "concise", "data-driven"],
    messaging: ["leadership", "results", "innovation"]
  },
  contentStandards: {
    qualityRequirements: ["fact-checked", "professional", "strategic"],
    restrictions: ["avoid controversial topics", "maintain professional tone"]
  },
  visualIdentity: {
    colorPalette: ["#1E3A8A", "#3B82F6", "#EFF6FF"],
    typography: ["sans-serif", "professional"],
    imagery: ["professional", "clean", "modern"]
  },
  platformGuidelines: {
    enabled: ["linkedin", "twitter"],
    defaults: {
      linkedin: {
        defaultAsset: "none",
        linkPolicy: "allowed",
        emojiPolicy: "none",
        hashtagPolicy: "sparing",
        typicalCadencePerWeek: 3
      },
      twitter: {
        defaultAsset: "none",
        linkPolicy: "allowed",
        emojiPolicy: "sparing",
        hashtagPolicy: "sparing",
        typicalCadencePerWeek: 5
      }
    }
  },
  claimsPolicy: {
    noGuarantees: true,
    noPerformanceNumbersUnlessProvided: true,
    requireSourceForStats: true,
    competitorMentionPolicy: "avoid"
  },
  approvalPolicy: {
    threshold: 0.8,
    mode: "require_review_below_threshold"
  }
}
```

**Professionals Audience:**
```javascript
{
  voiceGuidelines: {
    tone: ["approachable", "knowledgeable", "helpful"],
    style: ["conversational", "clear", "practical"],
    messaging: ["expertise", "collaboration", "growth"]
  },
  contentStandards: {
    qualityRequirements: ["accurate", "actionable", "engaging"],
    restrictions: ["avoid overly technical jargon"]
  },
  visualIdentity: {
    colorPalette: ["#2563EB", "#60A5FA", "#DBEAFE"],
    typography: ["sans-serif", "readable"],
    imagery: ["professional", "diverse", "relatable"]
  },
  platformGuidelines: {
    enabled: ["linkedin", "twitter", "facebook"],
    defaults: {
      linkedin: {
        defaultAsset: "none",
        linkPolicy: "allowed",
        emojiPolicy: "sparing",
        hashtagPolicy: "allowed",
        typicalCadencePerWeek: 4
      },
      twitter: {
        defaultAsset: "none",
        linkPolicy: "allowed",
        emojiPolicy: "sparing",
        hashtagPolicy: "allowed",
        typicalCadencePerWeek: 5
      },
      facebook: {
        defaultAsset: "none",
        linkPolicy: "allowed",
        emojiPolicy: "sparing",
        hashtagPolicy: "sparing",
        typicalCadencePerWeek: 3
      }
    }
  },
  claimsPolicy: {
    noGuarantees: true,
    noPerformanceNumbersUnlessProvided: true,
    requireSourceForStats: true,
    competitorMentionPolicy: "neutral_only"
  },
  approvalPolicy: {
    threshold: 0.7,
    mode: "auto_approve"
  }
}
```

**Consumers Audience:**
```javascript
{
  voiceGuidelines: {
    tone: ["friendly", "enthusiastic", "helpful"],
    style: ["simple", "engaging", "visual"],
    messaging: ["value", "experience", "community"]
  },
  contentStandards: {
    qualityRequirements: ["engaging", "clear", "visual"],
    restrictions: ["avoid technical jargon", "keep it simple"]
  },
  visualIdentity: {
    colorPalette: ["#EC4899", "#F472B6", "#FCE7F3"],
    typography: ["sans-serif", "friendly"],
    imagery: ["vibrant", "lifestyle", "diverse"]
  },
  platformGuidelines: {
    enabled: ["instagram", "facebook", "twitter"],
    defaults: {
      instagram: {
        defaultAsset: "image",
        linkPolicy: "discouraged",
        emojiPolicy: "allowed",
        hashtagPolicy: "allowed",
        typicalCadencePerWeek: 7
      },
      facebook: {
        defaultAsset: "image",
        linkPolicy: "allowed",
        emojiPolicy: "allowed",
        hashtagPolicy: "allowed",
        typicalCadencePerWeek: 5
      },
      twitter: {
        defaultAsset: "none",
        linkPolicy: "allowed",
        emojiPolicy: "allowed",
        hashtagPolicy: "allowed",
        typicalCadencePerWeek: 7
      }
    }
  },
  claimsPolicy: {
    noGuarantees: true,
    noPerformanceNumbersUnlessProvided: true,
    requireSourceForStats: false,
    competitorMentionPolicy: "avoid"
  },
  approvalPolicy: {
    threshold: 0.6,
    mode: "auto_approve"
  }
}
```

**Technical Audience:**
```javascript
{
  voiceGuidelines: {
    tone: ["precise", "technical", "authoritative"],
    style: ["detailed", "accurate", "technical"],
    messaging: ["innovation", "technical excellence", "reliability"]
  },
  contentStandards: {
    qualityRequirements: ["technically accurate", "detailed", "well-sourced"],
    restrictions: ["avoid marketing hype", "maintain technical accuracy"]
  },
  visualIdentity: {
    colorPalette: ["#0F172A", "#475569", "#E2E8F0"],
    typography: ["monospace", "technical"],
    imagery: ["technical", "diagrams", "code"]
  },
  platformGuidelines: {
    enabled: ["twitter", "linkedin"],
    defaults: {
      twitter: {
        defaultAsset: "none",
        linkPolicy: "allowed",
        emojiPolicy: "none",
        hashtagPolicy: "sparing",
        typicalCadencePerWeek: 5
      },
      linkedin: {
        defaultAsset: "none",
        linkPolicy: "allowed",
        emojiPolicy: "none",
        hashtagPolicy: "sparing",
        typicalCadencePerWeek: 3
      }
    }
  },
  claimsPolicy: {
    noGuarantees: true,
    noPerformanceNumbersUnlessProvided: true,
    requireSourceForStats: true,
    competitorMentionPolicy: "neutral_only"
  },
  approvalPolicy: {
    threshold: 0.8,
    mode: "require_review_below_threshold"
  }
}
```

**Creative Audience:**
```javascript
{
  voiceGuidelines: {
    tone: ["inspiring", "innovative", "expressive"],
    style: ["creative", "visual", "storytelling"],
    messaging: ["creativity", "innovation", "inspiration"]
  },
  contentStandards: {
    qualityRequirements: ["creative", "engaging", "original"],
    restrictions: ["avoid corporate speak"]
  },
  visualIdentity: {
    colorPalette: ["#8B5CF6", "#A78BFA", "#EDE9FE"],
    typography: ["creative", "expressive"],
    imagery: ["artistic", "creative", "inspiring"]
  },
  platformGuidelines: {
    enabled: ["instagram", "twitter", "facebook"],
    defaults: {
      instagram: {
        defaultAsset: "image",
        linkPolicy: "discouraged",
        emojiPolicy: "allowed",
        hashtagPolicy: "allowed",
        typicalCadencePerWeek: 7
      },
      twitter: {
        defaultAsset: "none",
        linkPolicy: "allowed",
        emojiPolicy: "allowed",
        hashtagPolicy: "allowed",
        typicalCadencePerWeek: 5
      },
      facebook: {
        defaultAsset: "image",
        linkPolicy: "allowed",
        emojiPolicy: "allowed",
        hashtagPolicy: "allowed",
        typicalCadencePerWeek: 4
      }
    }
  },
  claimsPolicy: {
    noGuarantees: true,
    noPerformanceNumbersUnlessProvided: true,
    requireSourceForStats: false,
    competitorMentionPolicy: "avoid"
  },
  approvalPolicy: {
    threshold: 0.7,
    mode: "auto_approve"
  }
}
```

## Schema Changes

### Persona Schema Updates

**Before:**
```javascript
export const CreatePersonaRequestSchema = PersonaSchema.omit({
  personaId: true,
  tenantId: true,
  inferredStyle: true,
  createdAt: true,
  updatedAt: true,
  isActive: true
});
```

**After:**
```javascript
export const CreatePersonaRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  role: z.string().trim().min(1).max(100),
  company: z.string().trim().min(1).max(100),
  primaryAudience: z.enum(['executives', 'professionals', 'consumers', 'technical', 'creative']),

  voiceTraits: z.array(z.string().trim()).min(1).max(10).optional(),
  writingHabits: z.object({
    paragraphs: z.enum(['short', 'medium', 'long']),
    questions: z.enum(['frequent', 'occasional', 'rare']),
    emojis: z.enum(['frequent', 'sparing', 'none']),
    structure: z.enum(['prose', 'lists', 'mixed'])
  }).optional(),
  opinions: z.object({
    strongBeliefs: z.array(z.string().trim()).min(1).max(3),
    avoidsTopics: z.array(z.string().trim()).max(10)
  }).optional(),
  language: z.object({
    avoid: z.array(z.string().trim()).max(20),
    prefer: z.array(z.string().trim()).max(20)
  }).optional(),
  ctaStyle: z.object({
    aggressiveness: z.enum(['low', 'medium', 'high']),
    patterns: z.array(z.string().trim()).max(10)
  }).optional()
});
```

### Brand Schema Updates

**Before:**
```javascript
export const CreateBrandRequestSchema = BrandSchema.omit({
  brandId: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  assetLibraryStats: true
}).partial({
  platformGuidelines: true,
  audienceProfile: true,
  pillars: true,
  claimsPolicy: true,
  ctaLibrary: true,
  approvalPolicy: true,
  assets: true
});
```

**After:**
```javascript
export const CreateBrandRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  ethos: z.string().trim().min(1).max(1000),
  coreValues: z.array(z.string().trim().min(1).max(200)).min(1).max(10),
  primaryAudience: z.enum(['executives', 'professionals', 'consumers', 'technical', 'creative']),

  voiceGuidelines: z.object({
    tone: z.array(z.string().trim().min(1).max(50)).min(1).max(10),
    style: z.array(z.string().trim().min(1).max(50)).min(1).max(10),
    messaging: z.array(z.string().trim().min(1).max(100)).min(1).max(10)
  }).optional(),
  visualIdentity: z.object({
    colorPalette: z.array(z.string().trim().min(1).max(50)).min(1).max(10),
    typography: z.array(z.string().trim().min(1).max(100)).min(1).max(5),
    imagery: z.array(z.string().trim().min(1).max(100)).min(1).max(10)
  }).optional(),
  contentStandards: z.object({
    qualityRequirements: z.array(z.string().trim().min(1).max(100)).min(1).max(10),
    restrictions: z.array(z.string().trim().min(1).max(200)).max(20)
  }).optional(),
  platformGuidelines: z.object({
    enabled: z.array(z.enum(['twitter', 'linkedin', 'instagram', 'facebook'])).min(1),
    defaults: z.record(
      z.enum(['twitter', 'linkedin', 'instagram', 'facebook']),
      z.object({
        defaultAsset: z.enum(['none', 'image', 'video']),
        linkPolicy: z.enum
.string().trim().min(1).max(100),
    weight: z.number().min(0).max(1).optional()
  })).max(10).nullable().optional(),
  claimsPolicy: z.object({
    noGuarantees: z.boolean(),
    noPerformanceNumbersUnlessProvided: z.boolean(),
    requireSourceForStats: z.boolean(),
    competitorMentionPolicy: z.enum(['avoid', 'neutral_only', 'allowed'])
  }).optional(),
  ctaLibrary: z.array(z.object({
    type: z.string().trim().min(1).max(50),
    text: z.string().trim().min(1).max(200),
    defaultUrl: z.url().nullable().optional()
  })).max(20).nullable().optional(),
  approvalPolicy: z.object({
    threshold: z.number().min(0).max(1),
    mode: z.enum(['auto_approve', 'require_review_below_threshold', 'always_review'])
  }).optional(),
  assets: z.array(BrandAssetAssociationSchema).max(50).optional().nullable()
});
```

### Asset Association Simplification

**Before:**
```javascript
const InternalAssetAssociationSchema = z.object({
  type: z.literal('internal'),
  assetId: z.string(),
  usageIntent: UsageIntentSchema,
  isDefault: z.boolean().default(false),
  categories: z.array(z.string().trim().min(1).max(100)).max(10).optional().nullable(),
  addedAt: z.string(),
  addedBy: z.string()
});
```

**After:**
```javascript
const InternalAssetAssociationSchema = z.object({
  type: z.literal('internal'),
  assetId: z.string(),
  usageIntent: UsageIntentSchema.optional(),
  isDefault: z.boolean().optional().default(false),
  categories: z.array(z.string().trim().min(1).max(100)).max(10).optional().nullable(),
  addedAt: z.string().optional(),
  addedBy: z.string().optional()
});
```

## Implementation Strategy

### Phase 1: Add Default Generators

Create utility functions to generate defaults:

```javascript
// utils/persona-defaults.mjs
export const getPersonaDefaults = (primaryAudience) => {
  const defaults = {
    executives: { /* ... */ },
    professionals: { /* ... */ },
    consumers: { /* ... */ },
    technical: { /* ... */ },
    creative: { /* ... */ }
  };

  return defaults[primaryAudience];
};

// utils/brand-defaults.mjs
export const getBrandDefaults = (primaryAudience) => {
  const defaults = {
    executives: { /* ... */ },
    professionals: { /* ... */ },
    consumers: { /* ... */ },
    technical: { /* ... */ },
    creative: { /* ... */ }
  };

  return defaults[primaryAudience];
};
```

### Phase 2: Update Schemas

1. Update `CreatePersonaRequestSchema` to make fields optional
2. Update `CreateBrandRequestSchema` to make fields optional
3. Update asset association schemas to make metadata optional
4. Keep full `PersonaSchema` and `BrandSchema` unchanged for storage

### Phase 3: Update Create Functions

```javascript
// functions/persona/create-persona.mjs
export const handler = async (event) => {
  const { tenantId } = event.requestContext.authorizer;
  const requestData = validateRequestBody(CreatePersonaRequestSchema, event.body);

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
  return formatResponse(201, { id: persona.id });
};
```

```javascript
// functions/brand/create-brand.mjs
export const handler = async (event) => {
  const { tenantId } = event.requestContext.authorizer;
  const requestData = validateRequestBody(CreateBrandRequestSchema, event.body);

  const defaults = getBrandDefaults(requestData.primaryAudience);

  const brandWithDefaults = {
    ...defaults,
    ...requestData,
    voiceGuidelines: requestData.voiceGuidelines || defaults.voiceGuidelines,
    contentStandards: requestData.contentStandards || defaults.contentStandards,
    visualIdentity: requestData.visualIdentity || defaults.visualIdentity,
    platformGuidelines: requestData.platformGuidelines || defaults.platformGuidelines,
    claimsPolicy: requestData.claimsPolicy || defaults.claimsPolicy,
    approvalPolicy: requestData.approvalPolicy || defaults.approvalPolicy
  };

  if (requestData.assets && requestData.assets.length > 0) {
    const now = new Date().toISOString();
    const userId = event.requestContext.authorizer.userId || tenantId;

    brandWithDefaults.assets = requestData.assets.map(asset => ({
      ...asset,
      addedAt: asset.addedAt || now,
      addedBy: asset.addedBy || userId
    }));
  }

  const brand = await Brand.save(tenantId, brandWithDefaults);
  return formatResponse(201, brand);
};
```

### Phase 4: Update Documentation

1. Update OpenAPI spec to reflect optional fields
2. Add examples showing minimal vs full configuration
3. Document default values for each audience type
4. Add migration guide for existing integrations

## Response Format

### Persona Response with Defaults Indicator

```javascript
{
  "id": "persona_01ARZ3NDEKTSV4RRFFQ69G5FAV",
  "name": "Sarah Chen",
  "role": "Product Manager",
  "company": "TechCorp",
  "primaryAudience": "professionals",
  "voiceTraits": ["knowledgeable", "practical", "collaborative"],
  "writingHabits": {
    "paragraphs": "medium",
    "questions": "frequent",
    "emojis": "sparing",
    "structure": "mixed"
  },
  "opinions": {
    "strongBeliefs": ["Continuous learning matters"],
    "avoidsTopics": []
  },
  "language": {
    "avoid": ["overly formal"],
    "prefer": ["conversational", "clear", "actionable"]
  },
  "ctaStyle": {
    "aggressiveness": "medium",
    "patterns": ["Check it out", "Learn more", "Share your thoughts"]
  },
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z",
  "isActive": true,
  "_defaults": {
    "voiceTraits": true,
    "writingHabits": true,
    "opinions": true,
    "language": true,
    "ctaStyle": true
  }
}
```

Note: The `_defaults` field is optional metadata to help users understand which fields are using defaults. This can be omitted in production if not needed.

## Backward Compatibility

All existing personas and brands with full configuration continue to work without changes. The system only applies defaults when fields are not provided during creation.

## Testing Strategy

1. Test persona creation with minimal fields
2. Test persona creation with full fields (existing behavior)
3. Test brand creation with minimal fields
4. Test brand creation with full fields (existing behavior)
5. Test that defaults vary correctly by audience type
6. Test that provided values override defaults
7. Test asset associations with minimal metadata
8. Test content generation quality with default configurations

## Migration Path

No migration needed - this is purely additive. Existing entities remain unchanged.

## Documentation Updates

1. Update OpenAPI spec with optional field markers
2. Add "Quick Start" examples showing minimal configuration
3. Add "Full Configuration" examples showing all options
4. Document default values for each audience type
5. Add comparison table: minimal vs full configuration
6. Update error messages to guide users on required fields

## Success Criteria

1. Persona creation time reduced from ~10 minutes to ~2 minutes
2. Brand creation time reduced from ~15 minutes to ~3 minutes
3. Content quality with defaults is acceptable (>70% approval rate)
4. No breaking changes to existing integrations
5. Clear documentation of defaults and customization options
