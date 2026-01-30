# Complexity Reduction - Design

## Overview
This design outlines a systematic approach to simplifying the Social Media Campaign Builder codebase by removing over-engineering, consolidating duplicate functionality, and reducing unnecessary abstraction layers. The refactoring will be done incrementally to minimize risk while maintaining all existing functionality.

## Design Principles

1. **Simplicity First** - Choose the simplest solution that works
2. **Inline Over Abstraction** - Prefer inline code over utility functions for simple operations
3. **Direct Over Indirect** - Use direct calls instead of wrapper functions
4. **One Place for One Thing** - Validation, error handling, and transformations should happen in one place
5. **Self-Documenting Code** - Code should be clear without excessive abstraction

## Architecture Changes

### 1. Validation Simplification

**Current State:**
```javascript
// models/persona.mjs
export const validateRequestBody = (schema, body) => {
  try {
    const parsed = JSON.parse(body);
    return schema.parse(parsed);
  } catch (error) {
    // Complex error transformation
  }
};

// Lambda handler
const requestData = validateRequestBody(CreatePersonaRequestSchema, event.body);
```

**New State:**
```javascript
// Lambda handler - direct Zod usage
const requestData = CreatePersonaRequestSchema.parse(JSON.parse(event.body));
```

**Changes:**
- Remove `validateRequestBody`, `validateQueryParams` from all models
- Remove `utils/validation.mjs` entirely
- Use Zod `.parse()` directly in Lambda handlers
- Handle Zod errors with simple try-catch in handlers

### 2. Error Handling Consolidation

**Current State:**
```javascript
// Multiple error classes
export class ModelError extends Error { ... }
export class BrandError extends Error { ... }

// Complex error transformation
export const createStandardizedError = (error, operation, context) => {
  // 50+ lines of error mapping
};
```

**New State:**
```javascript
// Lambda handler
try {
  // operation
} catch (error) {
  logger.error('Operation failed', { error: error.message });

  if (error instanceof z.ZodError) {
    return formatResponse(400, { message: 'Validation failed', errors: error.errors });
  }
  if (error.name === 'ConditionalCheckFailedException') {
    return formatResponse(404, { message: 'Resource not found' });
  }
  return formatResponse(500, { message: 'Internal server error' });
}
```

**Changes:**
- Remove `ModelError`, `BrandError` classes
- Remove `createStandardizedError`, `createModelError` functions
- Remove `utils/error-handler.mjs` file
- Use simple error handling directly in Lambda handlers
- Keep consistent error response format

### 3. Model Layer Simplification

**Current State:**
```javascript
// Duplicate transformation methods
static transformFromDynamoDB(rawData) { ... }
static _transformFromDynamoDB(rawData) { ... }

// Validation wrappers
static validateEntity(entity) {
  return Schema.parse(entity);
}

// Business logic in models
static enrichForCampaign(persona) { ... }
static mergeEffectiveRestrictions(persona, campaign, brand) { ... }
```

**New State:**
```javascript
// Single transformation method
static fromDynamoDB(rawData) {
  const clean = { ...rawData };
  delete clean.pk;
  delete clean.sk;
  delete clean.GSI1PK;
  delete clean.GSI1SK;
  delete clean.tenantId;
  clean.id = clean.personaId;
  delete clean.personaId;
  return clean;
}

// No validation wrappers - use Zod directly
// Business logic moved to Lambda handlers or dedicated service functions
```

**Changes:**
- Consolidate to single `fromDynamoDB` and `toDynamoDB` methods
- Remove `validateEntity`, `validateUpdateData` methods
- Move business logic (`enrichForCampaign`, `mergeEffectiveRestrictions`) to Lambda handlers
- Remove unused GSI2 indexes from DynamoDB schema
- Keep only essential CRUD operations in models

### 4. Logger Consolidation

**Current State:**
```javascript
// utils/logger.mjs
export const assetLogger = createLogger('asset-management');
export const campaignLogger = createLogger('campaign-management');
export const personaLogger = createLogger('persona-management');
export const brandLogger = createLogger('brand-management');
export const agentLogger = createLogger('agent-orchestration');
export const authLogger = createLogger('authentication');
```

**New State:**
```javascript
// utils/logger.mjs
import { Logger } from '@aws-lambda-powertools/logger';

export const logger = new Logger({
  serviceName: 'social-media-campaign-builder',
  logLevel: process.env.LOG_LEVEL || 'ERROR'
});
```

**Changes:**
- Single logger instance for entire application
- Add context in log calls instead of separate loggers
- Update all imports across codebase
- Remove SERVICE_NAMES constant

### 5. Utility File Reduction

**Files to Remove:**
- `utils/validation.mjs` - Zod handles this
- `utils/error-handler.mjs` - Simple error handling in handlers
- `utils/api-response.mjs` - Inline response formatting

**Files to Consolidate:**
- Merge `utils/brand-defaults.mjs` and `utils/persona-defaults.mjs` into `utils/defaults.mjs`

**Files to Keep:**
- `utils/logger.mjs` - Simplified single logger
- `utils/asset-pool-builder.mjs` - Complex business logic
- `utils/asset-resolver.mjs` - Complex business logic
- `utils/asset-security.mjs` - Security logic
- `utils/campaign-status.mjs` - State machine logic
- `utils/platform-constraints.mjs` - Configuration data
- `utils/style-inference.mjs` - Complex AI logic
- `utils/defaults.mjs` - Consolidated defaults

**Inline Response Formatting:**
```javascript
// Instead of formatResponse(200, data)
return {
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify(data)
};
const createSchema = PersonaSchema.omit({ personaId: true, createdAt: true, updatedAt: true });
const updateSchema = createSchema.partial();
const dto = PersonaSchema.omit({ tenantId: true });
```

**Changes:**
- Keep only base schemas (PersonaSchema, BrandSchema, CampaignSchema, AssetSchema)
- Remove all CreateXRequestSchema, UpdateXRequestSchema variations
- Remove all DTOSchema variations
- Use `.partial()`, `.omit()`, `.pick()` inline in handlers

### 7. Lambda Handler Streamlining

**Current State:**
```javascript
export const handler = async (event) => {
  const operation = 'create-brand';

  try {
    const { tenantId } = event.requestContext.authorizer;

    if (!tenantId) {
      throw new BrandError('Unauthorized', BrandErrorCodes.UNAUTHORIZED, 401);
    }

    const requestData = validateRequestBody(CreateBrandRequestSchema, event.body);
    // ... operation

  } catch (error) {
    brandLogger.error('Create brand failed', { operation, tenantId, error });
    return createStandardizedError(error, operation, { tenantId });
  }
};
```

**New State:**
```javascript
export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;

    if (!tenantId) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    const requestData = BrandSchema
      .omit({ brandId: true, tenantId: true, createdAt: true, updatedAt: true })
      .parse(JSON.parse(event.body));

    // ... operation

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(result)
    };

  } catch (error) {
    logger.error('Create brand failed', { tenantId: event.requestContext?.authorizer?.tenantId, error: error.message });

    if (error instanceof z.ZodError) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Validation failed', errors: error.errors }) };
    }
    return { statusCode: 500, body: JSON.stringify({ message: 'Internal server error' }) };
  }
};
```

**Changes:**
- Remove operation constants
- Remove custom error classes
- Inline validation with Zod
- Inline response formatting
- Simplify error handling
- Remove context objects

### 8. Template Simplification

**DynamoDB Table Changes:**
```yaml
# Remove GSI2 if unused
GlobalSecondaryIndexes:
  - IndexName: GSI1
    KeySchema:
      - AttributeName: GSI1PK
        KeyType: HASH
      - AttributeName: GSI1SK
        KeyType: RANGE
    Projection:
      ProjectionType: ALL
  # Remove GSI2 if not used
```

**IAM Policy Consolidation:**
```yaml
# Before: Separate policies for each function
Policies:
  - AWSLambdaBasicExecutionRole
  - Version: 2012-10-17
    Statement:
      - Effect: Allow
        Action: dynamodb:PutItem
        Resource: !GetAtt PersonaTable.Arn

# After: Consolidated policies for related functions
Policies:
  - AWSLambdaBasicExecutionRole
  - DynamoDBCrudPolicy:
      TableName: !Ref PersonaTable
```

**Environment Variable Cleanup:**
- Keep only essential variables (TABLE_NAME, ASSETS_BUCKET)
- Remove unused configuration variables
- Remove redundant MODEL_ID variables

## Implementation Strategy

### Phase 1: Foundation (Low Risk)
1. Consolidate loggers
2. Remove unused utility files
3. Simplify schema definitions
4. Clean up template

### Phase 2: Core Refactoring (Medium Risk)
5. Simplify model transformations
6. Remove validation wrappers
7. Consolidate error handling

### Phase 3: Handler Simplification (Higher Risk)
8. Refactor Lambda handlers
9. Move business logic out of models
10. Inline response formatting

### Testing Strategy
- Run full test suite after each change
- Manual API testing for each refactored endpoint
- Verify no breaking changes to API contracts
- Check DynamoDB access patterns remain efficient

## Data Model Changes

**No database schema changes required** - All changes are code-level refactoring.

**Key Structure Remains:**
```
pk: {tenantId}#{entityId}
sk: {entityType} | {subEntityType}#{subEntityId}
GSI1PK: {tenantId}
GSI1SK: {ENTITY_TYPE}#{timestamp}
```

## API Contract Preservation

All API endpoints maintain exact same:
- Request formats
- Response formats
- Status codes
- Error messages
- Authentication requirements

## Migration Path

No data migration required. Changes are purely code refactoring.

## Rollback Strategy

- Keep git history clean with atomic commits
- Each phase can be rolled back independently
- Test suite provides safety net
- Feature flags not needed (no behavior changes)

## Performance Considerations

**Expected Improvements:**
- Slightly faster Lambda cold starts (less code to load)
- Reduced memory footprint (fewer abstractions)
- Same DynamoDB performance (no query changes)

**No Performance Degradation:**
- All DynamoDB access patterns unchanged
- No additional network calls
- No additional processing overhead

## Security Considerations

**Maintained:**
- Tenant isolation enforcement
- Input validation (via Zod)
- Authentication/authorization checks
- S3 presigned URL security

**Removed:**
- Custom sanitization (Zod handles this)
- Redundant validation layers

## Monitoring and Observability

**Logging Changes:**
- Single logger with context instead of domain-specific loggers
- Same log level and format
- Same error tracking
- Add operation context in log calls

**Metrics:**
- No changes to CloudWatch metrics
- Same Lambda execution metrics
- Same DynamoDB metrics

## Success Criteria

1. **Code Reduction:** 20-30% fewer lines of code
2. **File Reduction:** From 12 utility files to 4-5
3. **Test Pass Rate:** 100% of existing tests pass
4. **API Compatibility:** Zero breaking changes
5. **Performance:** No degradation in response times
6. **Maintainability:** Reduced cyclomatic complexity in models

## Risk Mitigation

1. **Incremental Changes:** One domain at a time (Persona → Brand → Campaign → Asset)
2. **Test Coverage:** Run full suite after each change
3. **Code Review:** Review each phase before proceeding
4. **Rollback Plan:** Clean git history for easy rollback
5. **Documentation:** Update inline documentation as needed

## Dependencies

- None - Pure refactoring effort
- No external service changes
- No database migrations
- No API version changes

## Timeline Estimate

- Phase 1 (Foundation): 2-3 hours
- Phase 2 (Core Refactoring): 4-5 hours
- Phase 3 (Handler Simplification): 5-6 hours
- Testing and Validation: 2-3 hours

**Total: 13-17 hours of development time**
