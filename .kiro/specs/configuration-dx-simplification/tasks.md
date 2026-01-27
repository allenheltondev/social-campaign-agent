# Configuration DX Simplification - Tasks

## Task List

- [ ] 1. Create persona defaults utility
  - [x] 1.1 Create utils/persona-defaults.mjs with audience-specific defaults
  - [x] 1.2 Add unit tests for persona defaults generation
- [ ] 2. Create brand defaults utility
  - [x] 2.1 Create utils/brand-defaults.mjs with audience-specific defaults
  - [x] 2.2 Add unit tests for brand defaults generation
- [ ] 3. Update persona schema
  - [x] 3.1 Update CreatePersonaRequestSchema to make fields optional
  - [x] 3.2 Keep PersonaSchema unchanged for storage validation
  - [x] 3.3 Add unit tests for schema validation with minimal fields
  - [x] 3.4 Add unit tests for schema validation with full fields
- [ ] 4. Update brand schema
  - [x] 4.1 Update CreateBrandRequestSchema to make fields optional
  - [x] 4.2 Keep BrandSchema unchanged for storage validation
  - [x] 4.3 Update asset association schemas to make metadata optional
  - [x] 4.4 Add unit tests for schema validation with minimal fields
  - [x] 4.5 Add unit tests for schema validation with full fields
- [ ] 5. Update create-persona function
  - [x] 5.1 Import persona defaults utility
  - [x] 5.2 Apply defaults based on primaryAudience
  - [x] 5.3 Merge user-provided values over defaults
  - [x] 5.4 Add unit tests for minimal persona creation
  - [x] 5.5 Add unit tests for full persona creation
  - [x] 5.6 Add unit tests for partial override of defaults
- [ ] 6. Update create-brand function
  - [x] 6.1 Import brand defaults utility
  - [x] 6.2 Apply defaults based on primaryAudience
  - [x] 6.3 Merge user-provided values over defaults
  - [x] 6.4 Auto-populate asset metadata (addedAt, addedBy)
  - [x] 6.5 Add unit tests for minimal brand creation
  - [x] 6.6 Add unit tests for full brand creation
  - [x] 6.7 Add unit tests for partial override of defaults
  - [x] 6.8 Add unit tests for asset metadata auto-population
- [ ] 7. Update OpenAPI specification
  - [x] 7.1 Mark optional fields in CreatePersonaRequest schema
  - [x] 7.2 Mark optional fields in CreateBrandRequest schema
  - [x] 7.3 Add minimal configuration examples
  - [x] 7.4 Add full configuration examples
  - [x] 7.5 Document default values for each audience type
- [ ] 8. Integration testing
  - [x] 8.1 Test persona creation with minimal fields via API
  - [x] 8.2 Test brand creation with minimal fields via API
  - [x] 8.3 Test that defaults vary by audience type
  - [x] 8.4 Test that provided values override defaults
  - [x] 8.5 Test backward compatibility with existing full configurations
  - [x] 8.6 Test campaign generation with default-configured personas
  - [x] 8.7 Test campaign generation with default-configured brands

## Task Details

### 1. Create persona defaults utility

**Dependencies:** None

**Description:** Create a utility module that generates audience-specific default configurations for personas.

**Implementation Notes:**
- Create `utils/persona-defaults.mjs`
- Export `getPersonaDefaults(primaryAudience)` function
- Return complete default object for each audience type
- Include all optional fields: voiceTraits, writingHabits, opinions, language, ctaStyle

**Acceptance Criteria:**
- Function returns correct defaults for each audience type
- Defaults match design specification exactly
- Function throws error for invalid audience type
- All returned objects pass PersonaSchema validation when combined with required fields

### 1.1 Create utils/persona-defaults.mjs with audience-specific defaults

**Dependencies:** None

**Implementation:**
```javascript
export const getPersonaDefaults = (primaryAudience) => {
  const defaults = {
    executives: { /* from design */ },
    professionals: { /* from design */ },
    consumers: { /* from design */ },
    technical: { /* from design */ },
    creative: { /* from design */ }
  };

  if (!defaults[primaryAudience]) {
    throw new Error(`Invalid primaryAudience: ${primaryAudience}`);
  }

  return defaults[primaryAudience];
};
```

### 1.2 Add unit tests for persona defaults generation

**Dependencies:** 1.1

**Test Cases:**
- Returns correct defaults for executives audience
- Returns correct defaults for professionals audience
- Returns correct defaults for consumers audience
- Returns correct defaults for technical audience
- Returns correct defaults for creative audience
- Throws error for invalid audience type
- Returned defaults pass schema validation

### 2. Create brand defaults utility

**Dependencies:** None

**Description:** Create a utility module that generates audience-specific default configurations for brands.

**Implementation Notes:**
- Create `utils/brand-defaults.mjs`
- Export `getBrandDefaults(primaryAudience)` function
- Return complete default object for each audience type
- Include all optional fields: voiceGuidelines, contentStandards, visualIdentity, platformGuidelines, claimsPolicy, approvalPolicy

**Acceptance Criteria:**
- Function returns correct defaults for each audience type
- Defaults match design specification exactly
- Function throws error for invalid audience type
- All returned objects pass BrandSchema validation when combined with required fields

### 2.1 Create utils/brand-defaults.mjs with audience-specific defaults

**Dependencies:** None

**Implementation:**
```javascript
export const getBrandDefaults = (primaryAudience) => {
  const defaults = {
    executives: { /* from design */ },
    professionals: { /* from design */ },
    consumers: { /* from design */ },
    technical: { /* from design */ },
    creative: { /* from design */ }
  };

  if (!defaults[primaryAudience]) {
    throw new Error(`Invalid primaryAudience: ${primaryAudience}`);
  }

  return defaults[primaryAudience];
};
```

### 2.2 Add unit tests for brand defaults generation

**Dependencies:** 2.1

**Test Cases:**
- Returns correct defaults for executives audience
- Returns correct defaults for professionals audience
- Returns correct defaults for consumers audience
- Returns correct defaults for technical audience
- Returns correct defaults for creative audience
- Throws error for invalid audience type
- Returned defaults pass schema validation

### 3. Update persona schema

**Dependencies:** None

**Description:** Modify the CreatePersonaRequestSchema to make all fields except the core 4 optional.

**Implementation Notes:**
- Update `models/persona.mjs`
- Keep PersonaSchema unchanged (used for storage validation)
- Make voiceTraits, writingHabits, opinions, language, ctaStyle optional in CreatePersonaRequestSchema
- Ensure UpdatePersonaRequestSchema remains fully optional

**Acceptance Criteria:**
- CreatePersonaRequestSchema accepts minimal fields (name, role, company, primaryAudience)
- CreatePersonaRequestSchema accepts full fields
- CreatePersonaRequestSchema rejects invalid data
- PersonaSchema remains unchanged
- All existing tests continue to pass

### 3.1 Update CreatePersonaRequestSchema to make fields optional

**Dependencies:** None

**Implementation:**
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
    structure: z.en
ema unchanged for storage validation

**Dependencies:** None

**Verification:** Ensure PersonaSchema still requires all fields for storage validation.

### 3.3 Add unit tests for schema validation with minimal fields

**Dependencies:** 3.1

**Test Cases:**
- Validates minimal persona request (4 required fields only)
- Rejects request missing name
- Rejects request missing role
- Rejects request missing company
- Rejects request missing primaryAudience

### 3.4 Add unit tests for schema validation with full fields

**Dependencies:** 3.1

**Test Cases:**
- Validates full persona request with all optional fields
- Validates partial persona request with some optional fields
- Rejects invalid voiceTraits format
- Rejects invalid writingHabits values
- Rejects invalid opinions structure

### 4. Update brand schema

**Dependencies:** None

**Description:** Modify the CreateBrandRequestSchema to make all fields except the core 4 optional, and simplify asset associations.

**Implementation Notes:**
- Update `models/brand.mjs`
- Keep BrandSchema unchanged (used for storage validation)
- Make voiceGuidelines, contentStandards, visualIdentity optional in CreateBrandRequestSchema
- Make platformGuidelines, audienceProfile, pillars, claimsPolicy, ctaLibrary, approvalPolicy, assets optional
- Update InternalAssetAssociationSchema to make addedAt, addedBy, usageIntent, categories optional
- Update ExternalAssetAssociationSchema to make addedAt, addedBy, usageIntent, categories optional

**Acceptance Criteria:**
- CreateBrandRequestSchema accepts minimal fields (name, ethos, coreValues, primaryAudience)
- CreateBrandRequestSchema accepts full fields
- Asset associations work with minimal fields (type + assetId/url)
- BrandSchema remains unchanged
- All existing tests continue to pass

### 4.1 Update CreateBrandRequestSchema to make fields optional

**Dependencies:** None

**Implementation:**
```javascript
export const CreateBrandRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  ethos: z.string().trim().min(1).max(1000),
  coreValues: z.array(z.string().trim().min(1).max(200)).min(1).max(10),
  primaryAudience: z.enum(['executives', 'professionals', 'consumers', 'technical', 'creative']),
  voiceGuidelines: z.object({ /* ... */ }).optional(),
  visualIdentity: z.object({ /* ... */ }).optional(),
  contentStandards: z.object({ /* ... */ }).optional(),
  platformGuidelines: z.object({ /* ... */ }).optional(),
  audienceProfile: z.object({ /* ... */ }).optional(),
  pillars: z.array(z.object({ /* ... */ })).max(10).nullable().optional(),
  claimsPolicy: z.object({ /* ... */ }).optional(),
  ctaLibrary: z.array(z.object({ /* ... */ })).max(20).nullable().optional(),
  approvalPolicy: z.object({ /* ... */ }).optional(),
  assets: z.array(BrandAssetAssociationSchema).max(50).optional().nullable()
});
```

### 4.2 Keep BrandSchema unchanged for storage validation

**Dependencies:** None

**Verification:** Ensure BrandSchema still requires all fields for storage validation.

### 4.3 Update asset association schemas to make metadata optional

**Dependencies:** None

**Implementation:**
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

const ExternalAssetAssociationSchema = z.object({
  type: z.literal('external'),
  url: z.string().url().refine(url => url.startsWith('https://'), {
    message: 'External asset URLs must use HTTPS protocol'
  }),
  description: z.string().trim().min(10).max(500),
  contentType: z.string().trim().min(1).max(100),
  usageIntent: UsageIntentSchema.optional(),
  isDefault: z.boolean().optional().default(false),
  categories: z.array(z.string().trim().min(1).max(100)).max(10).optional().nullable(),
  addedAt: z.string().optional(),
  addedBy: z.string().optional()
});
```

### 4.4 Add unit tests for schema validation with minimal fields

**Dependencies:** 4.1

**Test Cases:**
- Validates minimal brand request (4 required fields only)
- Rejects request missing name
- Rejects request missing ethos
- Rejects request missing coreValues
- Rejects request missing primaryAudience
- Validates minimal internal asset association (type + assetId)
- Validates minimal external asset association (type + url + description + contentType)

### 4.5 Add unit tests for schema validation with full fields

**Dependencies:** 4.1

**Test Cases:**
- Validates full brand request with all optional fields
- Validates partial brand request with some optional fields
- Validates asset associations with full metadata
- Rejects invalid voiceGuidelines format
- Rejects invalid contentStandards values
- Rejects invalid visualIdentity structure

### 5. Update create-persona function

**Dependencies:** 1, 3

**Description:** Modify the create-persona Lambda function to apply defaults and merge with user-provided values.

**Implementation Notes:**
- Update `functions/persona/create-persona.mjs`
- Import getPersonaDefaults from utils
- Apply defaults based on primaryAudience
- Merge user-provided values over defaults (user values take precedence)
- Ensure backward compatibility with full configurations

**Acceptance Criteria:**
- Function accepts minimal persona request
- Function applies correct defaults based on audience
- User-provided values override defaults
- Function still accepts full persona request
- All validation errors are properly handled

### 5.1 Import persona defaults utility

**Dependencies:** 1.1

**Implementation:**
```javascript
import { getPersonaDefaults } from '../../utils/persona-defaults.mjs';
```

### 5.2 Apply defaults based on primaryAudience

**Dependencies:** 5.1

**Implementation:**
```javascript
const defaults = getPersonaDefaults(requestData.primaryAudience);
```

### 5.3 Merge user-provided values over defaults

**Dependencies:** 5.2

**Implementation:**
```javascript
const personaWithDefaults = {
  ...defaults,
  ...requestData,
  voiceTraits: requestData.voiceTraits || defaults.voiceTraits,
  writingHabits: requestData.writingHabits || defaults.writingHabits,
  opinions: requestData.opinions || defaults.opinions,
  language: requestData.language || defaults.language,
  ctaStyle: requestData.ctaStyle || defaults.ctaStyle
};
```

### 5.4 Add unit tests for minimal persona creation

**Dependencies:** 5.3

**Test Cases:**
- Creates persona with minimal fields
- Applies correct defaults for executives audience
- Applies correct defaults for professionals audience
- Applies correct defaults for consumers audience
- Applies correct defaults for technical audience
- Applies correct defaults for creative audience
- Saved persona passes full schema validation

### 5.5 Add unit tests for full persona creation

**Dependencies:** 5.3

**Test Cases:**
- Creates persona with all fields provided
- No defaults are applied when all fields provided
- Saved persona matches provided values exactly

### 5.6 Add unit tests for partial override of defaults

**Dependencies:** 5.3

**Test Cases:**
- Creates persona with some optional fields provided
- Provided fields override defaults
- Missing fields use defaults
- Mixed configuration works correctly

### 6. Update create-brand function

**Dependencies:** 2, 4

**Description:** Modify the create-brand Lambda function to apply defaults, merge with user-provided values, and auto-populate asset metadata.

**Implementation Notes:**
- Update `functions/brand/create-brand.mjs`
- Import getBrandDefaults from utils
- Apply defaults based on primaryAudience
- Merge user-provided values over defaults (user values take precedence)
- Auto-populate addedAt and addedBy for asset associations
- Ensure backward compatibility with full configurations

**Acceptance Criteria:**
- Function accepts minimal brand request
- Function applies correct defaults based on audience
- User-provided values override defaults
- Asset metadata is auto-populated
- Function still accepts full brand request
- All validation errors are properly handled

### 6.1 Import brand defaults utility

**Dependencies:** 2.1

**Implementation:**
```javascript
import { getBrandDefaults } from '../../utils/brand-defaults.mjs';
```

### 6.2 Apply defaults based on primaryAudience

**Dependencies:** 6.1

**Implementation:**
```javascript
const defaults = getBrandDefaults(requestData.primaryAudience);
```

### 6.3 Merge user-provided values over defaults

**Dependencies:** 6.2

**Implementation:**
```javascript
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
```

### 6.4 Auto-populate asset metadata (addedAt, addedBy)

**Dependencies:** 6.3

**Implementation:**
```javascript
if (requestData.assets && requestData.assets.length > 0) {
  const now = new Date().toISOString();
  const userId = event.requestContext.authorizer.userId || tenantId;

  brandWithDefaults.assets = requestData.assets.map(asset => ({
    ...asset,
    addedAt: asset.addedAt || now,
    addedBy: asset.addedBy || userId
  }));
}
```

### 6.5 Add unit tests for minimal brand creation

**Dependencies:** 6.4

**Test Cases:**
- Creates brand with minimal fields
- Applies correct defaults for executives audience
- Applies correct defaults for professionals audience
- Applies correct defaults for consumers audience
- Applies correct defaults for technical audience
- Applies correct defaults for creative audience
- Saved brand passes full schema validation

### 6.6 Add unit tests for full brand creation

**Dependencies:** 6.4

**Test Cases:**
- Creates brand with all fields provided
- No defaults are applied when all fields provided
- Saved brand matches provided values exactly

### 6.7 Add unit tests for partial override of defaults

**Dependencies:** 6.4

**Test Cases:**
- Creates brand with some optional fields provided
- Provided fields override defaults
- Missing fields use defaults
- Mixed configuration works correctly

### 6.8 Add unit tests for asset metadata auto-population

**Dependencies:** 6.4

**Test Cases:**
- Auto-populates addedAt when not provided
- Auto-populates addedBy when not provided
- Preserves provided addedAt value
- Preserves provided addedBy value
- Works with internal asset associations
- Works with external asset associations

### 7. Update OpenAPI specification

**Dependencies:** 3, 4

**Description:** Update the OpenAPI spec to reflect optional fields and document default behaviors.

**Implementation Notes:**
- Update `openapi.yaml`
- Mark optional fields in CreatePersonaRequest schema
- Mark optional fields in CreateBrandRequest schema
- Add examples showing minimal configuration
- Add examples showing full configuration
- Document default values in descriptions

**Acceptance Criteria:**
- OpenAPI spec accurately reflects new schema
- Required fields are clearly marked
- Optional fields are clearly marked
- Examples demonstrate both minimal and full usage
- Default values are documented for each audience type

### 7.1 Mark optional fields in CreatePersonaRequest schema

**Dependencies:** 3.1

**Implementation:** Update schema definition to mark voiceTraits, writingHabits, opinions, language, ctaStyle as not required.

### 7.2 Mark optional fields in CreateBrandRequest schema

**Dependencies:** 4.1

**Implementation:** Update schema definition to mark voiceGuidelines, contentStandards, visualIdentity, platformGuidelines, etc. as not required.

### 7.3 Add minimal configuration examples

**Dependencies:** 7.1, 7.2

**Implementation:** Add example requests showing minimal persona and brand creation.

### 7.4 Add full configuration examples

**Dependencies:** 7.1, 7.2

**Implementation:** Add example requests showing full persona and brand creation with all optional fields.

### 7.5 Document default values for each audience type

**Dependencies:** 7.1, 7.2

**Implementation:** Add descriptions explaining what defaults are applied for each audience type.

### 8. Integration testing

**Dependencies:** 5, 6, 7

**Description:** End-to-end testing of the simplified configuration flow.

**Implementation Notes:**
- Test via actual API calls
- Test with different audience types
- Test backward compatibility
- Test campaign generation with simplified configs

**Acceptance Criteria:**
- All API endpoints work with minimal configuration
- Defaults are correctly applied
- Content generation works with default configurations
- Existing full configurations continue to work
- No breaking changes to existing integrations

### 8.1 Test persona creation with minimal fields via API

**Dependencies:** 5

**Test Cases:**
- POST /personas with minimal fields returns 201
- Response includes applied defaults
- GET /personas/{id} returns complete persona with defaults

### 8.2 Test brand creation with minimal fields via API

**Dependencies:** 6

**Test Cases:**
- POST /brands with minimal fields returns 201
- Response includes applied defaults
- GET /brands/{id} returns complete brand with defaults

### 8.3 Test that defaults vary by audience type

**Dependencies:** 8.1, 8.2

**Test Cases:**
- Create personas with different audiences, verify different defaults
- Create brands with different audiences, verify different defaults

### 8.4 Test that provided values override defaults

**Dependencies:** 8.1, 8.2

**Test Cases:**
- Create persona with some optional fields, verify overrides
- Create brand with some optional fields, verify overrides

### 8.5 Test backward compatibility with existing full configurations

**Dependencies:** 8.1, 8.2

**Test Cases:**
- Create persona with all fields (old behavior) still works
- Create brand with all fields (old behavior) still works
- Update existing personas works
- Update existing brands works

### 8.6 Test campaign generation with default-configured personas

**Dependencies:** 8.1

**Test Cases:**
- Create campaign with minimal persona
- Verify content generation works
- Verify content quality is acceptable
- Verify persona voice is reflected in content

### 8.7 Test campaign generation with default-configured brands

**Dependencies:** 8.2

**Test Cases:**
- Create campaign with minimal brand
- Verify content generation works
- Verify brand guidelines are followed
- Verify content quality is acceptable

## Notes

- All tasks maintain backward compatibility
- No migration of existing data required
- Focus on additive changes only
- Preserve all existing validation rules
- Ensure content quality with defaults matches full configurations
