# Implementation Plan

- [x] 1. Set up project structure and core interfaces
  - Create directory structure for Lambda functions, shared schemas, and utilities using .mjs extension
  - Define Zod schemas for Persona and WritingExample entities with runtime validation
  - Set up SAM template for REST API Gateway and Lambda functions
  - Configure DynamoDB table with GSI for efficient querying
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Implement core data layer and validation

- [x] 2.1 Create shared JavaScript schemas and validation utilities
  - Write Zod schemas for Persona and WritingExample entities matching design specification
  - Implement request/response validation using Zod with .mjs modules
  - Create DynamoDB key generation utilities for tenant isolation
  - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2_

- [x] 2.2 Write property test for persona data round-trip consistency
  - **Property 1: Persona data round-trip consistency**
  - **Validates: Requirements 1.1, 1.2, 1.3, 1.5**

- [x] 2.3 Write property test for input validation consistency
  - **Property 9: Input validation consistency**
  - **Validates: Requirements 4.1, 4.2**

- [x] 2.4 Write property test for tenant isolation enforcement
  - **Property 8: Tenant isolation enforcement**
  - **Validates: Requirements 3.5**

- [x] 3. Implement persona CRUD Lambda functions

- [x] 3.1 Create POST /personas Lambda function
  - Implement persona creation with validation
  - Generate unique persona IDs and timestamps
  - Store persona data in DynamoDB with proper tenant isolation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3.2 Write property test for opinion framework constraint validation
  - **Property 2: Opinion framework constraint validation**
  - **Validates: Requirements 1.4**

- [x] 3.3 Create GET /personas/{personaId} Lambda function
  - Implement persona retrieval by ID with tenant validation
  - Return complete persona data including inferred style
  - Handle not found cases with appropriate error responses
  - _Requirements: 3.1, 3.5_

- [x] 3.4 Create PUT /personas/{personaId} Lambda function
  - Implement persona updates with partial field modification
  - Preserve existing data and increment version numbers
  - Validate update data and maintain data integrity
  - _Requirements: 3.2_

- [x] 3.5 Write property test for partial update preservation
  - **Property 5: Partial update preservation**
  - **Validates: Requirements 3.2**

- [x] 3.6 Create DELETE /personas/{personaId} Lambda function
  - Implement soft deletion by setting isActive flag
  - Maintain data integrity and version history
  - Check for dependencies before deletion
  - _Requirements: 4.3_

- [x] 3.7 Write property test for soft deletion behavior
  - **Property 10: Soft deletion behavior**
  - **Validates: Requirements 4.3**

- [x] 3.8 Create GET /personas Lambda function
  - Implement persona listing with pagination and filtering
  - Support search across name, role, company, and audience fields
  - Implement query filtering by voice traits and preferences
  - _Requirements: 3.4, 5.1, 5.2, 5.3_

- [x] 3.9 Write property test for search result accuracy
  - **Property 11: Search result accuracy**
  - **Validates: Requirements 5.1**

- [x] 3.10 Write property test for query filtering accuracy
  - **Property 7: Query filtering accuracy**
  - **Validates: Requirements 3.4, 5.2**

- [x] 3.11 Write property test for pagination consistency
  - **Property 12: Pagination consistency**
  - **Validates: Requirements 5.3**

- [x] 4. Checkpoint - Ensure all persona CRUD tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement writing examples management

- [x] 5.1 Create POST /personas/{personaId}/examples Lambda function
  - Implement writing example upload with validation
  - Store examples in DynamoDB linked to persona
  - _Requirements: 2.1, 2.4_

- [x] 5.2 Write property test for writing sample count validation
  - **Property 3: Writing sample count validation**
  - **Validates: Requirements 2.1**

- [x] 5.3 Create GET /personas/{personaId}/examples Lambda function
  - Implement retrieval of all writing examples for a persona
  - Support pagination for large example collections
  - Include example metadata and analysis timestamps
  - _Requirements: 3.1_

- [x] 5.4 Create DELETE /personas/{personaId}/examples/{exampleId} Lambda function
  - Implement deletion of specific writing examples
  - Maintain data integrity and audit trails with TTL cleanup
  - _Requirements: 4.3_

- [x] 6. Implement style inference integration

- [x] 6.1 Create native JavaScript agent for style analysis
  - Set up native JavaScript agent using .mjs modules and Strands SDK
  - Create specialized agent for writing style analysis using Bedrock Converse API
  - Configure Amazon Bedrock integration for NLP processing with AWS SDK v3
  - Define structured output format for style metrics using Zod schemas
  - _Requirements: 2.2, 2.3, 2.4_

- [x] 6.2 Create POST /personas/{personaId}/analyze endpoint
  - Implement style analysis trigger endpoint with validation
  - Validate persona exists and has sufficient examples (5+ required)
  - Emit EventBridge events for async processing
  - _Requirements: 2.1, 2.5_

- [x] 6.3 Implement EventBridge-driven style analysis workflow
  - Create EventBridge event handlers for style analysis requests
  - Implement async style analysis completion notifications
  - Update persona records with analysis results and status
  - _Requirements: 2.4, 3.3_

- [x] 6.4 Write property test for style inference completeness
  - **Property 4: Style inference completeness**
  - **Validates: Requirements 2.2, 2.3, 2.4**

- [x] 6.5 Write property test for style re-inference trigger
  - **Property 6: Style re-inference trigger**
  - **Validates: Requirements 3.3**

- [x] 7. Set up flexible API Gateway authentication





- [x] 7.1 Add optional AuthorizerArn parameter to SAM template


  - Add AuthorizerArn parameter with empty string default to template.yaml
  - Create CloudFormation condition to check if external authorizer ARN is provided
  - Add parameter description explaining optional external authorizer usage
  - _Requirements: 3.5, 4.5_

- [x] 7.2 Implement conditional authorizer configuration


  - Update SAM template with conditional logic for authorizer selection
  - Configure API Gateway to use external authorizer when ARN provided
  - Set up fallback to internal authorizer when no external ARN specified
  - Ensure consistent tenant context extraction for both scenarios
  - _Requirements: 3.5, 4.5_

- [x] 7.3 Update internal Lambda authorizer


  - Enhance existing JWT token validation for API authentication
  - Ensure tenant context extraction matches external authorizer format
  - Implement proper error responses for authentication failures
  - Test authorizer with mock JWT tokens and tenant isolation
  - _Requirements: 3.5, 4.5_

- [x] 7.4 Configure API Gateway integration


  - Update API Gateway configuration to support both authorizer types
  - Configure proper CORS headers and error responses
  - Set up request/response transformations and validation
  - Test API endpoints with both internal and external authorization
  - _Requirements: 4.5_

- [x] 8. Final integration and testing





- [x] 8.1 Create integration test suite


  - Test complete API workflows from creation to retrieval
  - Verify style inference integration end-to-end
  - Test error scenarios and recovery mechanisms
  - _Requirements: All requirements_

- [x] 8.2 Write unit tests for Lambda functions


  - Create unit tests for each Lambda function endpoint
  - Test authentication and authorization flows
  - Validate error handling and edge cases
  - _Requirements: All requirements_

- [x] 9. Final Checkpoint - Ensure all tests pass




  - Ensure all tests pass, ask the user if questions arise.
