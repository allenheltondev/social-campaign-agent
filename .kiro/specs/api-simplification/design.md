# API Simplification - Design Document

## Design Overview
Remove all filtering and search parameters from list endpoints, keeping only pagination (limit and nextToken). This simplifies the API, reduces code complexity, and makes the system more predictable.

## Architecture Decisions

### 1. Pagination-Only List Endpoints
**Decision:** Keep only `limit` and `nextToken` parameters for all list operations.

**Rationale:**
- Simpler API surface
- Consistent behavior across all endpoints
- Easier to maintain and test
- Frontend can filter client-side if needed
- Reduces DynamoDB query complexity

### 2. Remove DynamoDB FilterExpression
**Decision:** Remove FilterExpression from all Query operations.

**Rationale:**
- FilterExpression is applied after reading items (inefficient)
- Simplifies query logic
- More predictable pagination behavior
- Reduces code complexity

### 3. Remove Client-Side Filtering
**Decision:** Remove all client-side filtering logic in model methods.

**Rationale:**
- Filtering after pagination breaks expected behavior
- Inconsistent result counts
- Unnecessary complexity
- Frontend can filter if needed

## Implementation Plan

### Phase 1: Model Layer Changes

#### Asset Model (`models/asset.mjs`)
**Changes:**
- Remove `contentType` parameter from `list()` method
- Remove `createdAfter` parameter from `list()` method
- Remove FilterExpression for contentType
- Remove client-side filtering for createdAfter

**Before:**
```javascript
static async list(tenantId, options = {}) {
  const { nextToken, contentType, createdAfter } = options;
  // FilterExpression and client-side filtering
}
```

**After:**
```javascript
static async list(tenantId, options = {}) {
  const { nextToken, limit = 20 } = options;
  // Simple query with no filtering
}
```

#### Brand Model (`models/brand.mjs`)
**Changes:**
- Remove `search` parameter from `list()` method
- Remove `status` parameter from `list()` method
- Remove any FilterExpression or client-side filtering

#### Campaign Model (`models/campaign.mjs`)
**Changes:**
- Remove `status` parameter from `list()` method
- Remove `brandId` parameter from `list()` method
- Remove `personaId` parameter from `list()` method
- Remove FilterExpression and expression attribute logic

#### Persona Model (`models/persona.mjs`)
**Changes:**
- Remove `search` parameter from `list()` method
- Remove `company` parameter from `list()` method
- Remove `role` parameter from `list()` method
- Remove `primaryAudience` parameter from `list()` method
- Keep only `isActive = true` FilterExpression (this is a soft-delete filter, not a user filter)
- Remove all client-side filtering logic

#### SocialPost Model (`models/social-post.mjs`)
**Changes:**
- Remove `platform` parameter from `findByCampaign()` method
- Simplify KeyConditionExpression to not filter by platform

### Phase 2: Lambda Handler Changes

#### List Assets Handler (`functions/assets/list-assets.mjs`)
**Changes:**
- Remove `contentType` from queryParams
- Remove `createdAfter` from queryParams
- Remove validation for these parameters
- Update logging to not reference filters

#### List Brands Handler (`functions/brand/list-brands.mjs`)
**Changes:**
- Remove `search` from queryParams
- Remove `status` from queryParams

#### List Campaigns Handler (`functions/campaign/list-campaigns.mjs`)
**Changes:**
- Remove `status` from queryParams
- Remove `brandId` from queryParams
- Remove `personaId` from queryParams

#### List Personas Handler (`functions/persona/list-personas.mjs`)
**Changes:**
- Remove all filter parameters from QueryPersonasRequestSchema
- Update validation to only accept limit and nextToken

#### List Posts Handler (`functions/campaign/list-posts.mjs`)
**Changes:**
- Remove `platform` from queryParams
- Remove `persona` from queryParams
- Remove client-side filtering logic

#### List Examples Handler (`functions/persona/examples/list-examples.mjs`)
**Changes:**
- Already simple, no filter parameters to remove

#### Brand Assets List Handler (`functions/brand/assets/list-assets.mjs`)
**Changes:**
- Already simple, no filter parameters to remove

### Phase 3: OpenAPI Spec Changes

**Changes:**
- Remove all filter parameters from list endpoint definitions
- Keep only `limit` and `nextToken` parameters
- Update descriptions to reflect simplified behavior

**Endpoints to update:**
- `GET /personas`
- `GET /brands`
- `GET /assets`
- `GET /campaigns`
- `GET /campaigns/{campaignId}/posts`
- `GET /personas/{personaId}/examples`
- `GET /brands/{brandId}/assets`

### Phase 4: Test Updates

**Changes:**
- Remove test cases that test filtering behavior
- Keep pagination test cases
- Update mocks to not expect filter parameters
- Simplify test setup

**Test files to review:**
- `tests/unit/collection-response-format-consistency.test.mjs`
- `tests/unit/campaign-list-multiple-status.test.mjs` (may need significant changes)
- Any other tests that verify filtering behavior

## Data Flow

### Before (with filtering)
```
Request → Handler (extract filters) → Model (apply filters) → DynamoDB (FilterExpression) → Client-side filter → Response
```

### After (pagination only)
```
Request → Handler (extract pagination) → Model (simple query) → DynamoDB → Response
```

## API Changes Summary

### Personas
**Removed parameters:** search, company, role, primaryAudience
**Kept parameters:** limit, nextToken

### Brands
**Removed parameters:** search, status
**Kept parameters:** limit, nextToken

### Assets
**Removed parameters:** contentType, createdAfter
**Kept parameters:** limit, nextToken

### Campaigns
**Removed parameters:** status, brandId, personaId
**Kept parameters:** limit, nextToken

### Posts
**Removed parameters:** platform, persona
**Kept parameters:** limit, nextToken

## Backward Compatibility

**Breaking Change:** Yes, this is a breaking API change.

**Migration Strategy:**
- Frontend will need to remove filter parameters from API calls
- Frontend can implement client-side filtering if needed
- Document the change in API changelog

## Performance Impact

**Positive impacts:**
- Simpler DynamoDB queries
- No FilterExpression overhead
- More predictable query performance
- Consistent pagination behavior

**Neutral impacts:**
- Frontend may need to fetch more data and filter client-side
- For small datasets, this is negligible

## Testing Strategy

1. Update existing tests to remove filter assertions
2. Verify pagination still works correctly
3. Verify all list endpoints return expected data structure
4. Test with empty result sets
5. Test with large result sets requiring pagination

## Rollout Plan

1. Update models (Phase 1)
2. Update handlers (Phase 2)
3. Update OpenAPI spec (Phase 3)
4. Update tests (Phase 4)
5. Build and deploy
6. Update frontend to remove filter parameters
7. Document API changes

## Success Criteria

- All list endpoints accept only limit and nextToken
- No FilterExpression in DynamoDB queries (except isActive for soft deletes)
- No client-side filtering in model methods
- OpenAPI spec reflects simplified parameters
- All tests pass
- API responses maintain same structure (just without filtering)
