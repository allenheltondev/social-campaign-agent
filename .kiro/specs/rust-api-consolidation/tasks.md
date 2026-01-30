# Implementation Plan: Rust API Consolidation

## Overview

This plan breaks down the migration from 32 Node.js Lambda functions to a single Rust Lambda with hexagonal architecture. The implementation follows a domain-driven approach with clear port/adapter boundaries, enabling independent testing and maintainability.

## Tasks

- [x] 1. PREREQUISITE TASK: Set up Rust workspace and build tooling
  - Initialize cargo-lambda project
  - Create module layout directories (inbound, application, domain, ports, ou
r (contract inventory)
  - Enumerate all endpoints from OpenAPI specification and existing Node handlers
  - Record status codes, error message strings, 404 vs 405 behavior, special cases
  - Document any endpoint-specific quirks or edge cases
  - Create contract.md with complete endpoint inventory
  - Create golden request/response fixtures for integration tests
  - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - _Dependencies: None_
  - _Outputs: contract.md, golden test fixtures_

- [x] 3. Implement domain entities and shared types
  - [x] 3.1 Create domain entity structs (Persona, Brand, Campaign, Asset)
    - Define Rust structs with serde serialization matching existing JSON schemas
    - Implement CampaignStatus enum and other domain enums
    - Add camelCase serde rename attributes
    - _Requirements: 5.5, 7.1_

  - [x] 3.2 Create shared error types (ApiError)
    - Implement ApiError enum with variants for each HTTP status category
    - Add constructor methods (bad_request, unauthorized, not_found, conflict, internal)
    - Implement status_code and message methods
    - Implement to_response method for API Gateway responses
    - _Requirements: 10.2, 10.3, 10.4_

  - [x] 3.3 Create shared response types (ApiResponse)
    - Implement ApiResponse struct for HTTP responses
    - Add json constructor method
    - Implement conversion to Lambda response format
    - _Requirements: 5.2_

  - [x] 3.4 Create request context types (RequestCtx)
    - Implement RequestCtx struct with tenant_id and actor_id
    - Add from_route method to extract from authorizer context
    - Handle missing tenant/actor with appropriate errors
    - _Requirements: 1.5, 6.1, 6.3, 6.4_

  - _Dependencies: Task 1_
  - _Outputs: Domain entities, error types, response types, request context_

- [x] 4. Implement outbound ports (repository and service interfaces)
  - [x] 4.1 Define PersonaRepository trait
    - Add methods: list_by_tenant, get, create, update, delete
    - Use async_trait for async methods
    - Return Result<T, ApiError> for all methods
    - _Requirements: 7.1, 7.2_

  - [x] 4.2 Define BrandRepository, CampaignRepository, AssetRepository traits with CRUD and list_by_tenant
    - Start with minimal CRUD operations
    - Add additional query methods only when a handler requires them
    - Follow same pattern as PersonaRepository
    - _Requirements: 7.1, 7.2_

  - [x] 4.3 Define EventPublisher trait
    - Add publish method accepting Event struct
    - Define Event struct with source, detail_type, detail fields
    - _Requirements: 2.6, 8.1, 8.2_

  - [x] 4.4 Define ObjectStorage trait
    - Add generate_upload_url method
    - Define PresignedUploadUrl struct with method, url, key fields
    - Define BucketType enum (BrandAssets, Assets)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - _Dependencies: Task 3_
  - _Outputs: Repository traits, EventPublisher trait, ObjectStorage trait_

- [x] 5. Implement DynamoDB outbound adapter
  - [x] 5.1 Create DynamoDB error mapper
    - Implement map_dynamo_err function in outbound/dynamodb/errors.rs
    - Map ConditionalCheckFailedException to ApiError::conflict
    - Map other errors to ApiError::internal with logging
    - _Requirements: 7.5, 10.1, 10.2_

  - [x] 5.2 Create DynamoDB serialization utilities
    - Implement serialize_persona, deserialize_persona functions
    - Implement serialize/deserialize for Brand, Campaign, Asset
    - Use existing pk/sk key patterns ({tenantId}#{resourceId}, metadata)
    - Use existing GSI patterns (GSI1PK: {tenantId}, GSI1SK: {TYPE}#{createdAt})
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 5.3 Implement DynamoPersonaRepository
    - Create struct with DynamoDB client and table_name
    - Implement PersonaRepository trait methods
    - Use query for list_by_tenant with GSI1
    - Use get_item for get with pk/sk
    - Use put_item with conditional expression for create
    - Use map_dynamo_err for all error handling
    - _Requirements: 3.1, 7.1, 7.2, 7.3, 7.5_

  - [x] 5.4 Implement DynamoBrandRepository, DynamoCampaignRepository, DynamoAssetRepository
    - Follow same pattern as DynamoPersonaRepository
    - Implement domain-specific query patterns as needed by handlers
    - _Requirements: 3.2, 7.1, 7.2, 7.3, 7.5_

  - _Dependencies: Task 3, Task 4_
  - _Outputs: DynamoDB adapters for all repositories_

- [x] 6. Implement S3 and EventBridge outbound adapters
  - [x] 6.1 Implement S3ObjectStorage adapter
    - Create struct with S3 client and bucket names
    - Implement ObjectStorage trait
    - Generate presigned PUT URLs with 1-hour expiration
    - Use tenant-specific key prefixes ({tenantId}/{id}/{filename})
    - Return PresignedUploadUrl with method, url, key
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 6.2 Implement EventBridgePublisher adapter
    - Create struct with EventBridge client and event_bus_name
    - Implement EventPublisher trait
    - Build PutEventsRequestEntry with source, detail_type, detail
    - Log errors and return ApiError::internal on failure
    - _Requirements: 2.6, 8.1, 8.2, 8.4_

  - _Dependencies: Task 3, Task 4_
  - _Outputs: S3 adapter, EventBridge adapter_

- [x] 7. Implement inbound ports (use case interfaces)
  - [x] 7.1 Define PersonasUseCase trait
    - Add methods: list_personas, get_persona, create_persona, update_persona, delete_persona, trigger_style_analysis
    - All methods accept tenant_id as first parameter
    - Create/update methods accept actor_id for audit
    - _Requirements: 3.1, 3.3_

  - [x] 7.2 Define BrandsUseCase, CampaignsUseCase, AssetsUseCase traits
    - Follow same pattern as PersonasUseCase
    - Include domain-specific methods
    - _Requirements: 3.2, 3.4, 3.5, 3.6, 3.7, 3.8_

  - _Dependencies: Task 3_
  - _Outputs: Use case trait definitions_

- [x] 8. Implement application layer (use cases)
  - [x] 8.1 Implement PersonasUseCaseImpl
    - Create struct with PersonaRepository and EventPublisher dependencies
    - Implement PersonasUseCase trait
    - list_personas: call repo.list_by_tenant
    - get_persona: call repo.get
    - create_persona: generate ID, create Persona entity, call repo.create
    - trigger_style_analysis: publish StyleAnalysisRequested event with tenantId, personaId
    - _Requirements: 3.1, 8.1, 8.2_

  - [x] 8.2 Implement BrandsUseCaseImpl
    - Follow same pattern as PersonasUseCaseImpl
    - Wire BrandRepository dependency
    - _Requirements: 3.4_

  - [x] 8.3 Implement CampaignsUseCaseImpl
    - Follow same pattern as PersonasUseCaseImpl
    - Wire CampaignRepository and EventPublisher dependencies
    - _Requirements: 3.6_

  - [x] 8.4 Implement AssetsUseCaseImpl
    - Follow same pattern as PersonasUseCaseImpl
    - Wire AssetRepository and ObjectStorage dependencies
    - _Requirements: 3.8_

  - _Dependencies: Task 4, Task 5, Task 6, Task 7_
  - _Outputs: Use case implementations for all domains_

- [x] 9. Implement inbound HTTP adapters (route handlers)
  - [x] 9.1 Create personas route handlers
    - Implement list_personas route (GET /personas)
    - Implement get_persona route (GET /personas/{id})
    - Implement create_persona route (POST /personas)
    - Implement update_persona route (PUT /personas/{id})
    - Implement delete_persona route (DELETE /personas/{id})
    - Implement analyze_persona_style route (POST /personas/{id}/analyze)
    - Each handler: extract RequestCtx, call use case, return ApiResponse
    - _Requirements: 1.2, 3.1_

  - [x] 9.2 Create brands route handlers
    - Implement list_brands, get_brand, create_brand, update_brand, delete_brand routes
    - Follow same pattern as personas routes
    - _Requirements: 1.2, 3.4_

  - [x] 9.3 Create campaigns route handlers
    - Implement list_campaigns, get_campaign, create_campaign, update_campaign, delete_campaign routes
    - Implement list_campaign_posts route (GET /campaigns/{id}/posts)
    - _Requirements: 1.2, 3.6, 3.7_

  - [x] 9.4 Create assets route handlers
    - Implement list_assets, get_asset, create_asset, update_asset, delete_asset, approve_asset routes
    - _Requirements: 1.2, 3.8_

  - [x] 9.5 Create writing examples route handlers
    - Implement list_writing_examples (GET /personas/{id}/examples)
    - Implement create_writing_example (POST /personas/{id}/examples)
    - Implement delete_writing_example (DELETE /personas/{id}/examples/{exampleId})
    - _Requirements: 1.2, 3.3_

  - [x] 9.6 Create brand assets route handlers
    - Implement list_brand_assets (GET /brands/{id}/assets)
    - Implement upload_brand_asset (POST /brands/{id}/assets/upload)
    - Implement delete_brand_asset (DELETE /brands/{id}/assets/{assetId})
    - _Requirements: 1.2, 3.5_

  - _Dependencies: Task 3, Task 7, Task 8_
  - _Outputs: HTTP route handlers for all endpoints_

- [x] 10. Implement router registry and fallback behavior
  - Register all domain routers and handlers in one place
  - Implement fallback for unknown routes (404 Not Found)
  - Implement unsupported method behavior to match existing Node implementation
  - Verify behavior matches contract.md from Task 2
  - _Requirements: 1.2, 5.3_
  - _Dependencies: Task 2, Task 9_
  - _Outputs: Router registry, 404/405 handling_

- [x] 11. Implement application state and main entry point
  - [x] 11.1 Create AppState struct
    - Add fields for all use case trait objects (Arc<dyn PersonasUseCase>, etc.)
    - Implement new() method to wire dependencies
    - Initialize AWS SDK clients (DynamoDB, S3, EventBridge)
    - Load environment variables (TABLE_NAME, BRAND_ASSETS_BUCKET, ASSETS_BUCKET, EVENT_BUS_NAME)
    - Create repository adapters
    - Create use case implementations
    - _Requirements: 1.4, 1.5_

  - [x] 11.2 Implement main entry point
    - Use lambda-lw-http-router define_router macro
    - Initialize AppState
    - Build router from registry
    - Set up Lambda runtime with service_fn
    - _Requirements: 1.1, 1.2_

  - _Dependencies: Task 8, Task 10_
  - _Outputs: Application state, main entry point_

- [x] 12. Update SAM template
  - [x] 12.1 Replace 32 Node.js function definitions with single Rust function
    - Define ApiRouterFunction with provided.al2023 runtime
    - Set Handler to bootstrap
    - Configure ARM64 architecture
    - Set CodeUri to rust-api/target/lambda/api-router/
    - Set MemorySize to 512, Timeout to 25
    - Add environment variables (TABLE_NAME, BRAND_ASSETS_BUCKET, ASSETS_BUCKET, EVENT_BUS_NAME)
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 12.2 Configure API Gateway proxy integration
    - Add single ApiProxy event with Path: /{proxy+}, Method: ANY
    - Remove individual route event definitions
    - Keep authorizer configuration unchanged
    - _Requirements: 11.2_

  - [x] 12.3 Keep JavaScript Lambda functions unchanged
    - Preserve AuthorizerFunction, StyleInferenceFunction, BuildCampaignFunction, WorkflowCompletionFunction, AssetUploadCompleteFunction
    - Keep EventBridge rules pointing to JavaScript functions
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - _Dependencies: Task 11_
  - _Outputs: Updated SAM template_

- [x] 13. Write unit tests with fake repositories
  - [x] 13.1 Create fake repository implementations
    - Implement FakePersonaRepository using HashMap for in-memory storage
    - Implement FakeBrandRepository, FakeCampaignRepository, FakeAssetRepository
    - Implement FakeEventPublisher that records published events
    - Implement FakeObjectStorage that returns mock presigned URLs
    - _Dependencies: Task 4_

  - [x] 13.2 Write PersonasUseCaseImpl unit tests
    - Test list_personas returns all personas for tenant
    - Test get_persona returns correct persona
    - Test create_persona generates ID and stores persona
    - Test trigger_style_analysis publishes correct event
    - Use fake repositories to avoid AWS SDK dependencies
    - _Requirements: 12.1_

  - [x] 13.3 Write BrandsUseCaseImpl, CampaignsUseCaseImpl, AssetsUseCaseImpl unit tests
    - Follow same pattern as PersonasUseCaseImpl tests
    - Test domain-specific logic
    - _Requirements: 12.2, 12.3, 12.4_

  - [x] 13.4 Write serialization/deserialization unit tests
    - Test serialize_persona creates correct DynamoDB item with pk/sk
    - Test deserialize_persona extracts correct Persona from item
    - Test round-trip serialization preserves data
    - Test for Brand, Campaign, Asset entities
    - _Requirements: 7.1, 7.4_

  - [x] 13.5 Write RequestCtx extraction unit tests
    - Test from_route extracts tenant_id and actor_id from authorizer
    - Test from_route returns error when tenant_id missing
    - Test from_route returns error when actor_id missing
    - _Requirements: 6.1, 6.3, 6.4_

  - _Dependencies: Task 3, Task 4, Task 8_
  - _Outputs: Unit test suite with >80% coverage_

- [ ] 14. Run integration tests
  - [ ] 14.1 Build Rust Lambda
    - Run cargo lambda build --release --arm64
    - Verify build succeeds without errors
    - _Requirements: 11.1_

  - [ ] 14.2 Deploy to development environment
    - Run sam build
    - Run sam deploy to dev environment
    - Verify deployment succeeds
    - _Requirements: 11.4_

  - [ ] 14.3 Run existing Node.js integration test suite
    - Execute existing integration tests against Rust Lambda
    - Verify all tests pass
    - Fix any compatibility issues
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ] 14.4 Smoke test all endpoints manually
    - Test personas CRUD operations
    - Test brands CRUD operations
    - Test campaigns CRUD operations
    - Test assets CRUD operations
    - Test async workflow triggers (style analysis)
    - Test presigned URL generation
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - _Dependencies: Task 12, Task 13_
  - _Outputs: Passing integration tests, verified deployment_

- [ ] 15. Deploy to staging and production
  - [ ] 15.1 Deploy to staging environment
    - Run sam deploy to staging
    - Run full integration test suite
    - Monitor CloudWatch metrics and logs
    - Verify error rates and latency
    - _Requirements: 11.4_

  - [ ] 15.2 Production cutover
    - Schedule maintenance window
    - Deploy to production
    - Smoke test critical endpoints
    - Monitor CloudWatch alarms
    - Keep Node.js functions deployed for rollback
    - _Requirements: 11.4, 11.5_

  - [ ] 15.3 Post-deployment validation
    - Monitor error rates for 24 hours
    - Verify tenant isolation working correctly
    - Verify async workflows triggering correctly
    - Remove Node.js functions after validation period
    - _Requirements: 6.2, 8.1_

  - _Dependencies: Task 14_
  - _Outputs: Production deployment, validated migration_

## Notes

- Task 1 is a prerequisite that must complete before other tasks
- Task 2 (contract inventory) should complete early to guide implementation
- Tasks 3-8 can be developed in parallel by domain (personas, brands, campaigns, assets) after prerequisites complete
- Unit tests (Task 13) should be written alongside implementation tasks
- Integration tests (Task 14) require all implementation tasks to complete
- The hexagonal architecture enables testing use cases without AWS SDK dependencies
- Handlers are thin adapters that delegate to use cases, minimizing HTTP-layer testing needs
- Extend repository interfaces only when needed by an endpoint to avoid premature abstraction
