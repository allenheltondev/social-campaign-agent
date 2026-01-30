# Complexity Reduction - Requirements

## Overview
Simplify the Social Media Campaign Builder codebase by removing over-engineering, reducing abstraction layers, and consolidating duplicate functionality. The goal is to make the codebase easier to understand, maintain, and extend while preserving all core functionality.

## Problem Statement
The current codebase exhibits several patterns of over-engineering that increase cognitive load and maintenance burden without providing proportional value:

1. **Excessive validation layers** - Validation logic is duplicated across models, utilities, and request schemas
2. **Redundant error handling** - Multiple error handling abstractions that don't add value
3. **Over-abstracted models** - Complex transformation layers between DynamoDB and application code
4. **Duplicate logger instances** - Separate logger per domain when one would suffice
5. **Unnecessary utility wrappers** - Simple functions wrapped in utility files
6. **Complex schema hierarchies** - Nested Zod schemas with redundant validation
7. **Over-engineered Lambda patterns** - Boilerplate that could be simplified

## User Stories

### 1. Simplified Validation
**As a** developer
**I want** validation to happen in one place
**So that** I don't have to maintain duplicate validation logic across multiple files

**Acceptance Criteria:**
- 1.1 All validation uses Zod schemas directly in Lambda handlers
- 1.2 Remove validateRequestBody wrapper functions from models
- 1.3 Remove validation.mjs utility file
- 1.4 Validation errors return consistent format without custom error classes

### 2. Consolidated Error Handling
**As a** developer
**I want** simple, direct error handling
**So that** I can quickly understand and fix issues without navigating complex error hierarchies

**Acceptance Criteria:**
- 2.1 Remove ModelError and BrandError custom classes
- 2.2 Remove createStandardizedError and createModelError functions
- 2.3 Use simple try-catch with direct formatResponse calls
- 2.4 Remove error-handler.mjs utility file
- 2.5 Keep error logging but simplify to single logger instance

### 3. Simplified Model Layer
**As a** developer
**I want** models to be thin data access layers
**So that** I can easily understand database operations without complex transformations

**Acceptance Criteria:**
- 3.1 Consolidate _transformFromDynamoDB and transformFromDynamoDB into single method
- 3.2 Remove unnecessary enrichForCampaign and mergeEffectiveRestrictions methods
- 3.3 Simplify DynamoDB key generation (remove GSI2 if unused)
- 3.4 Move business logic out of models into Lambda handlers
- 3.5 Remove validateEntity methods - use Zod directly

### 4. Single Logger Instance
**As a** developer
**I want** one logger for the entire application
**So that** I don't have to import domain-specific loggers everywhere

**Acceptance Criteria:**
- 4.1 Replace all domain-specific loggers with single logger instance
- 4.2 Remove SERVICE_NAMES constant
- 4.3 Update all imports to use single logger
- 4.4 Simplify logger.mjs to export one logger

### 5. Reduced Utility Files
**As a** developer
**I want** utilities only for genuinely reusable complex logic
**So that** I don't have to hunt through utility files for simple operations

**Acceptance Criteria:**
- 5.1 Remove api-response.mjs - use inline response formatting
- 5.2 Consolidate brand-defaults.mjs and persona-defaults.mjs into single defaults.mjs
- 5.3 Remove sanitization functions from validation.mjs (Zod handles this)
- 5.4 Keep only asset-pool-builder.mjs and asset-resolver.mjs as genuinely complex utilities

### 6. Simplified Schema Definitions
**As a** developer
**I want** schemas defined once without redundant request/response variations
**So that** I can maintain schemas more easily

**Acceptance Criteria:**
- 6.1 Define base schemas only (PersonaSchema, BrandSchema, etc.)
- 6.2 Use .partial(), .omit(), .pick() inline in handlers instead of pre-defined variations
- 6.3 Remove CreateXRequestSchema, UpdateXRequestSchema variations
- 6.4 Remove DTO schemas - use base schema with omit inline

### 7. Streamlined Lambda Handlers
**As a** developer
**I want** Lambda handlers to be straightforward and self-contained
**So that** I can understand the entire request flow in one file

**Acceptance Criteria:**
- 7.1 Remove unnecessary try-catch nesting
- 7.2 Inline simple validation instead of calling utility functions
- 7.3 Remove operation constants - use string literals
- 7.4 Simplify error responses to direct formatResponse calls
- 7.5 Remove context objects passed to error handlers

### 8. Reduced Template Complexity
**As a** developer
**I want** SAM template to be as simple as possible
**So that** I can quickly understand infrastructure without excessive YAML

**Acceptance Criteria:**
- 8.1 Remove unused GSI2 from DynamoDB table if not used
- 8.2 Consolidate duplicate IAM policies
- 8.3 Remove unnecessary environment variables
- 8.4 Simplify esbuild configuration if possible
- 8.5 Remove unused Lambda function configurations

## Non-Functional Requirements

### Maintainability
- Code should be self-documenting without excessive abstraction
- New developers should understand flow without navigating multiple files
- Changes should require editing fewer files

### Performance
- No performance degradation from simplification
- Maintain current response times
- Keep DynamoDB access patterns efficient

### Backward Compatibility
- API contracts must remain unchanged
- Database schema must remain unchanged
- All existing tests must pass

## Out of Scope
- Frontend simplification (focus on backend only)
- Database migration or schema changes
- API endpoint changes
- New feature development
- Test refactoring (tests should continue to pass as-is)

## Success Metrics
- Reduce total lines of code by 20-30%
- Reduce number of utility files from 12 to 4-5
- Reduce model file complexity (cyclomatic complexity)
- Maintain 100% test pass rate
- Zero API breaking changes

## Dependencies
- None - this is a refactoring effort

## Risks
- Breaking existing functionality during refactoring
- Missing edge cases in simplified code
- Team resistance to removing "defensive" abstractions

## Mitigation Strategies
- Make changes incrementally, one domain at a time
- Run full test suite after each change
- Keep git history clean with atomic commits
- Document any behavior changes in commit messages
