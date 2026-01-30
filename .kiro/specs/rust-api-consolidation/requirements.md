# Requirements Document

## Introduction

This specification defines the migration of the Social Media Campaign Builder API layer from 32 separate Node.js Lambda functions to a single consolidated Rust Lambda function with request routing. The migration aims to improve performance, reduce operational complexity, and lower costs while maintaining exact API compatibility and preserving JavaScript-based AI/async workflows.

## Glossary

- **API_Router**: The single Rust Lambda function that handles all synchronous RE
t**: The tenant identifier extracted from the JWT token by the authorizer
- **Connection_Pool**: Shared AWS SDK clients reused across requests within the same Lambda instance

## Requirements

### Requirement 1: Single Rust Lambda for Synchronous APIs

**User Story:** As a platform operator, I want all synchronous REST API endpoints consolidated into a single Rust Lambda function, so that I can reduce operational complexity and improve performance.

#### Acceptance Criteria

1. THE API_Router SHALL handle all HTTP requests from API Gateway for synchronous endpoints
2. WHEN a request is received, THE Request_Router SHALL match the HTTP method and path to the appropriate handler function
3. THE API_Router SHALL maintain separate handler functions for each endpoint operation
4. THE API_Router SHALL reuse DynamoDB client connections across requests within the same Lambda instance
5. THE API_Router SHALL extract tenant context from the authorizer and pass it to handler functions

### Requirement 2: Preserve JavaScript AI and Async Workflows

**User Story:** As a developer, I want AI and async workflows to remain in JavaScript, so that I can leverage existing Bedrock integrations and durable function patterns.

#### Acceptance Criteria

1. THE StyleInferenceFunction SHALL remain as a separate JavaScript Lambda function
2. THE BuildCampaignFunction SHALL remain as a separate JavaScript Lambda function with durable function support
3. THE WorkflowCompletionFunction SHALL remain as a separate JavaScript Lambda function
4. THE AssetUploadCompleteFunction SHALL remain as a separate JavaScript Lambda function
5. THE AuthorizerFunction SHALL remain as a separate JavaScript Lambda function
6. WHEN the API_Router receives a request to trigger async workflows, THE API_Router SHALL publish events to EventBridge

### Requirement 3: Migrate All CRUD Endpoints to Rust

**User Story:** As a platform operator, I want all CRUD operations migrated to Rust, so that I can achieve sub-millisecond response times and reduce cold start latency.

#### Acceptance Criteria

1. THE API_Router SHALL implement handlers for all persona operations (list, create, get, update, delete)
2. THE API_Router SHALL implement handlers for all writing example operations (list, create, delete)
3. THE API_Router SHALL implement handlers for style analysis trigger (POST /personas/{id}/analyze)
4. THE API_Router SHALL implement handlers for all brand operations (list, create, get, update, delete)
5. THE API_Router SHALL implement handlers for all brand asset operations (list, upload, delete)
6. THE API_Router SHALL implement handlers for all campaign operations (list, create, get, update, delete)
7. THE API_Router SHALL implement handlers for campaign post listing (list)
8. THE API_Router SHALL implement handlers for all asset operations (list, create, get, update, delete, approve)

### Requirement 4: Performance Targets

**User Story:** As a platform operator, I want the Rust Lambda to achieve sub-millisecond warm response times and sub-5ms cold starts, so that I can provide a responsive user experience.

#### Acceptance Criteria

1. WHEN the API_Router is warm, THE API_Router SHALL respond to requests in less than 1 millisecond (excluding DynamoDB latency)
2. WHEN the API_Router experiences a cold start, THE API_Router SHALL initialize in less than 5 milliseconds
3. THE API_Router SHALL reuse DynamoDB client connections to minimize per-request overhead
4. THE API_Router SHALL use efficient serialization for DynamoDB data transformation

### Requirement 5: API Contract Preservation

**User Story:** As a frontend developer, I want the API contract to remain unchanged, so that I don't need to modify any frontend code.

#### Acceptance Criteria

1. THE API_Router SHALL accept requests matching the existing OpenAPI specification
2. THE API_Router SHALL return responses matching the existing OpenAPI specification
3. THE API_Router SHALL preserve all HTTP status codes from the current implementation
4. THE API_Router SHALL preserve all error response formats from the current implementation
5. THE API_Router SHALL maintain the same request and response JSON schemas
6. THE API_Router SHALL handle OPTIONS preflight requests and return 200 OK with CORS headers
7. THE API_Router SHALL include CORS headers (Access-Control-Allow-Origin, Access-Control-Allow-Methods, Access-Control-Allow-Headers) in all responses

### Requirement 6: Tenant Isolation

**User Story:** As a security engineer, I want tenant isolation to work correctly in the consolidated Lambda, so that tenants cannot access each other's data.

#### Acceptance Criteria

1. THE API_Router SHALL extract tenantId from the authorizer context for every request
2. THE API_Router SHALL pass tenantId to all DynamoDB operations as part of the partition key
3. THE API_Router SHALL validate that tenantId is present before processing any request
4. WHEN tenantId is missing, THE API_Router SHALL return a 401 Unauthorized response
5. THE API_Router SHALL never trust tenant identifiers from request bodies or query parameters

### Requirement 7: DynamoDB Integration

**User Story:** As a developer, I want the Rust Lambda to use the existing DynamoDB single-table design, so that I don't need to migrate data or change the data model.

#### Acceptance Criteria

1. THE API_Router SHALL use the existing DynamoDB table structure with pk and sk keys
2. THE API_Router SHALL use the existing GSI patterns for list operations
3. THE API_Router SHALL implement the same conditional expressions for create operations
4. THE API_Router SHALL use marshall/unmarshall equivalent operations for data transformation
5. THE API_Router SHALL maintain the same error handling for DynamoDB operations

### Requirement 8: EventBridge Integration for Async Triggers

**User Story:** As a developer, I want the Rust Lambda to trigger async workflows via EventBridge, so that AI operations continue to work as expected.

#### Acceptance Criteria

1. WHEN the API_Router receives POST /personas/{id}/analyze, THE API_Router SHALL publish a StyleAnalysisRequested event to EventBridge
2. THE API_Router SHALL include tenantId and personaId in the event payload
3. THE API_Router SHALL return a 202 Accepted response immediately after publishing the event
4. THE API_Router SHALL handle EventBridge publish failures with appropriate error responses

### Requirement 9: S3 Integration for Asset Operations

**User Story:** As a developer, I want the Rust Lambda to generate presigned URLs for asset uploads, so that the frontend can upload files directly to S3.

#### Acceptance Criteria

1. WHEN the API_Router receives a brand asset upload request, THE API_Router SHALL generate a presigned POST URL for the BrandAssetsBucket
2. WHEN the API_Router receives an asset upload request, THE API_Router SHALL generate a presigned POST URL for the AssetsBucket
3. THE API_Router SHALL include tenant-specific prefixes in S3 object keys
4. THE API_Router SHALL set appropriate expiration times for presigned URLs
5. THE API_Router SHALL return the presigned URL and required form fields in the response

### Requirement 10: Error Handling and Logging

**User Story:** As a platform operator, I want consistent error handling and logging, so that I can troubleshoot issues effectively.

#### Acceptance Criteria

1. WHEN an error occurs, THE API_Router SHALL log the error with structured context (operation, tenantId, resource identifiers)
2. THE API_Router SHALL return user-friendly error messages in the response body with a "message" property
3. THE API_Router SHALL use appropriate HTTP status codes (400 for validation errors, 404 for not found, 500 for server errors)
4. THE API_Router SHALL not expose sensitive information in error messages
5. THE API_Router SHALL handle panics gracefully and return 500 Internal Server Error responses

### Requirement 11: SAM Template Simplification

**User Story:** As a platform operator, I want the SAM template simplified by consolidating Lambda functions, so that deployments are faster and infrastructure is easier to manage.

#### Acceptance Criteria

1. THE SAM template SHALL define a single API_Router Lambda function for all synchronous endpoints
2. THE SAM template SHALL define API Gateway routes that all point to the API_Router function
3. THE SAM template SHALL reduce the total number of Lambda function definitions from 32 to approximately 6
4. THE SAM template SHALL maintain the existing authorizer configuration
5. THE SAM template SHALL maintain the existing EventBridge rules for async workflows

### Requirement 12: Testing and Validation

**User Story:** As a developer, I want all existing tests to pass with minimal changes, so that I can verify the migration maintains correctness.

#### Acceptance Criteria

1. THE API_Router SHALL pass all existing integration tests for persona operations
2. THE API_Router SHALL pass all existing integration tests for brand operations
3. THE API_Router SHALL pass all existing integration tests for campaign operations
4. THE API_Router SHALL pass all existing integration tests for asset operations
5. WHEN tests require changes, THE changes SHALL only involve updating Lambda function names or ARNs
