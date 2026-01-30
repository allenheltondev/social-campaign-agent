# API Simplification

## Overview
Simplify the API by:
1. Removing unnecessary filtering and search capabilities from all list endpoints (COMPLETED)
2. Removing the overengineered approval/decision workflow endpoints and all related code

## User Stories

### 1. As a developer, I want simpler list endpoints
**Acceptance Criteria:**
- All list endpoints accept only `limit` and `nextToken` parameters
- No search, filter, or query parameters are accepted
- Filtering logic is removed from model methods
- OpenAPI spec reflects simplified parameters

### 2. As a frontend developer, I want consistent list endpoints
**Acceptance Criteria:**
- All list endpoints have identical pagination parameters
- No special-case filtering logic per endpoint
- Predictable response format across all list operations

## Current Filtering Capabilities to Remove

### Personas List
- `search` - text search across name, role, company, audience
- `company` - filter by company name
- `role` - filter by role
- `primaryAudience` - filter by audience type

### Brands List
- `search` - text search
- `status` - filter by brand status

### Assets List
- `contentType` - filter by content type (image/video)
- `createdAfter` - filter by creation date

### Campaigns List
- `status` - filter by campaign status
- `brandId` - filter by brand
- `personaId` - filter by persona

### Posts List
- `platform` - filter by social platform
- `persona` - filter by persona (client-side)

## Phase 2: Remove Approval/Decision Workflow

### 3. As a user, I want a simpler campaign workflow without approval steps
**Acceptance Criteria:**
- Campaign approval endpoint is removed
- Campaign decision endpoints are removed
- Post decision endpoints are removed
- All approval/decision-related statuses are removed
- Campaign workflow proceeds directly without approval gates
- All backing Lambda functions are deleted
- All SAM template resources are removed
- OpenAPI spec no longer includes these endpoints

### Endpoints to Remove
1. `POST /campaigns/{id}/approve` - Campaign approval
2. `POST /campaigns/{id}/decisions` - Campaign-level decisions
3. `POST /campaigns/{id}/posts/{id}/decisions` - Individual post decisions
4. `POST /campaigns/{id}/posts/decisions` - Bulk post decisions

### Statuses to Remove
- Any campaign status related to approval/pending decisions
- Any post status related to approval/pending decisions
- Status transition logic that depends on approvals

### Code to Remove
- Lambda handlers for approval/decision endpoints
- Model methods that handle approval/decision logic
- Status validation that enforces approval workflows
- Any event handlers triggered by approval/decision actions
- Tests for approval/decision functionality

## Out of Scope
- Pagination functionality (limit, nextToken) - keep as-is
- Response format changes - keep existing structure
- Authentication/authorization - no changes
- Campaign building and content generation - keep as-is

## Technical Notes

### Phase 1 (Completed)
- Remove FilterExpression from DynamoDB queries where used
- Remove client-side filtering logic in model methods
- Update OpenAPI spec to remove filter parameters
- Update Lambda handlers to not accept filter parameters
- Tests may need updates to remove filter test cases

### Phase 2 (New)
- Delete Lambda function files for approval/decision handlers
- Remove SAM template function definitions and API routes
- Remove approval/decision methods from campaign and social-post models
- Simplify campaign status enum and transitions
- Remove approval-related tests
- Update any workflows that reference approval steps
