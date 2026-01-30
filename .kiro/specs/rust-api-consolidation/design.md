# Design Document: Rust API Consolidation

## Overview

This design consolidates 32 separate Node.js Lambda functions into a single Rust Lambda function with request routing while maintaining API compatibility. JavaScript-based AI and async workflows remain unchanged to preserve existing Bedrock integrations and durable workflow patterns. The primary goals are simpler maintenance, fewer deployable units, and clearer separation between synchronous API work (Rust) and asynchronous workflows (JavaScript).

The design uses the `lambda-lw-http-router` crate for lightweight, type-safe routing with path parameter extraction. All synchronous CRUD operations move to Rust, while async workflows (style inference, campaign building) stay in JavaScript.

## Architecture

### High-Level Structure

```
API Gateway
    ↓
Lambda Authorizer (JavaScript - unchanged)
    ↓
API Router (Rust - NEW)
    ├─ Request Router (lambda-lw-http-router)
    ├─ Domain Routers (personas, brands, campaigns, assets)
    ├─ Inbound Ports (use cases)
    ├─ Use Cases (application layer)
    ├─ Outbound Ports (repositories, object storage, event publisher)
    └─ AWS Adapters (DynamoDB/S3/EventBridge implementations)

EventBridge
    ↓
Async Workflows (JavaScript - unchanged)
    ├─ StyleInferenceFunction
    ├─ BuildCampaignFunction
    └─ WorkflowCompletionFunction
```

### Architectural Style

The Rust API router follows a hexagonal (ports and adapters) architecture. HTTP routing is an inbound adapter. Business logic is implemented as domain services/use-cases behind inbound ports. DynamoDB/S3/EventBridge are outbound adapters behind repository and publisher ports. This keeps domain logic independent of AWS SDKs and Lambda event shapes, improves testability, and makes it easier to maintain as the API grows.

### Hexagonal Architecture Breakdown

**Layers**:

**Inbound Adapters**:
- HTTP router and request decoding (API Gateway event → request DTO)
- Auth context extraction (tenantId)

**Application (Use Cases)**:
- Orchestrates domain actions (create persona, list campaigns, generate upload URL)
- Enforces invariants (tenant isolation, required fields, status transitions)
- Calls outbound ports

**Domain**:
- Core entities and domain rules (Persona, Brand, Campaign)
- Pure logic, no AWS types, no Lambda event types

**Outbound Ports**:
- Repositories: PersonaRepository, BrandRepository, CampaignRepository, AssetRepository
- ObjectStorage for S3-like behavior
- EventPublisher for EventBridge-like behavior

**Outbound Adapters**:
- DynamoDB repository implementations
- S3 implementation for presigned uploads
- EventBridge implementation for workflow triggers

### Routing Behavior With Proxy Integration

With {proxy+} integration, API Gateway forwards all methods and paths to the Rust router. The router is responsible for returning:
- 404 Not Found for unknown paths
- 405 Method Not Allowed (or 404 if preferred for compatibility) for unsupported methods on known paths
- 200 OK for OPTIONS requests with appropriate CORS headers

This behavior must match the existing Node implementation to maintain API compatibility.

### CORS and OPTIONS Handling

The router must handle OPTIONS preflight requests for all routes:
- Return 200 OK status
- Include CORS headers: Access-Control-Allow-Origin, Access-Control-Allow-Methods, Access-Control-Allow-Headers
- No authorizer validation required for OPTIONS (API Gateway handles this)
- All other responses must include CORS headers for browser compatibility


### Request Flow

1. API Gateway receives HTTP request
2. Lambda Authorizer validates JWT and extracts tenant context
3. API Router receives enriched event with tenant ID
4. Request Router matches method + path to domain router
5. Domain router extracts path parameters and request body
6. Domain router calls use case via inbound port
7. Use case orchestrates domain logic and calls outbound ports
8. Outbound adapters interact with AWS services
9. Response flows back through layers to API Gateway

### Function Boundaries

**Rust Lambda (API Router)**:
- All synchronous REST endpoints
- Immediate response operations
- CRUD for personas, brands, campaigns, assets
- Presigned URL generation
- EventBridge event publishing

**JavaScript Lambdas (Unchanged)**:
- AuthorizerFunction: JWT validation, tenant extraction
- StyleInferenceFunction: Bedrock AI for persona analysis
- BuildCampaignFunction: Durable function with Bedrock for campaign generation
- WorkflowCompletionFunction: EventBridge completion handler
- AssetUploadCompleteFunction: S3 event handler

## Components and Interfaces

### 1. Main Entry Point

```rust
use lambda_lw_http_router::{define_router, route};
use lambda_runtime::{service_fn, Error, LambdaEvent};
use aws_lambda_events::apigw::ApiGatewayV2httpRequest;
use std::sync::Arc;

define_router!(event = ApiGatewayV2httpRequest, state = AppState);

#[tokio::main]
async fn main() -> Result<(), Error> {
    let state = Arc::new(AppState::new().await);
    let router = Arc::new(RouterBuilder::from_registry().build());

    let lambda = move |event: LambdaEvent<ApiGatewayV2httpRequest>| {
        let state = Arc::clone(&state);
        let router = Arc::clone(&router);
        async move { router.handle_request(event, state).await }
    };

    lambda_runtime::run(service_fn(lambda)).await
}
```

### 2. Application State

Shared state holds domain services (inbound ports), not raw AWS clients:

```rust
#[derive(Clone)]
struct AppState {
    personas_use_case: Arc<dyn PersonasUseCase>,
    brands_use_case: Arc<dyn BrandsUseCase>,
    campaigns_use_case: Arc<dyn CampaignsUseCase>,
    assets_use_case: Arc<dyn AssetsUseCase>,
}

impl AppState {
    async fn new() -> Self {
        let config = aws_config::load_from_env().await;

        let dynamo = aws_sdk_dynamodb::Client::new(&config);
        let s3 = aws_sdk_s3::Client::new(&config);
        let eb = aws_sdk_eventbridge::Client::new(&config);

        let table_name = std::env::var("TABLE_NAME").expect("TABLE_NAME required");
        let brand_assets_bucket = std::env::var("BRAND_ASSETS_BUCKET").expect("BRAND_ASSETS_BUCKET required");
        let assets_bucket = std::env::var("ASSETS_BUCKET").expect("ASSETS_BUCKET required");
        let event_bus_name = std::env::var("EVENT_BUS_NAME").expect("EVENT_BUS_NAME required");

        let persona_repo = Arc::new(DynamoPersonaRepository::new(dynamo.clone(), table_name.clone()));
        let brand_repo = Arc::new(DynamoBrandRepository::new(dynamo.clone(), table_name.clone()));
        let campaign_repo = Arc::new(DynamoCampaignRepository::new(dynamo.clone(), table_name.clone()));
        let asset_repo = Arc::new(DynamoAssetRepository::new(dynamo.clone(), table_name.clone()));

        let object_storage = Arc::new(S3ObjectStorage::new(s3.clone(), brand_assets_bucket, assets_bucket));
        let events = Arc::new(EventBridgePublisher::new(eb.clone(), event_bus_name));

        let personas_use_case = Arc::new(PersonasUseCaseImpl::new(persona_repo, events.clone()));
        let brands_use_case = Arc::new(BrandsUseCaseImpl::new(brand_repo, object_storage.clone()));
        let campaigns_use_case = Arc::new(CampaignsUseCaseImpl::new(campaign_repo, events.clone()));
        let assets_use_case = Arc::new(AssetsUseCaseImpl::new(asset_repo, object_storage.clone()));

        Self {
            personas_use_case,
            brands_use_case,
            campaigns_use_case,
            assets_use_case,
        }
    }
}
```

### 3. Domain Routers and Route Handlers

Routes are grouped by domain. Each route handler is a thin inbound adapter that (1) extracts auth context, (2) parses a request DTO, and (3) calls a domain use case via an inbound port. The handler does not perform AWS SDK calls directly.

All responses include CORS headers automatically via ApiResponse helper.

```rust
#[route(path = "/personas", method = "GET")]
async fn list_personas(ctx: RouteContext) -> Result<ApiResponse, ApiError> {
    let rctx = RequestCtx::from_route(&ctx)?;
    let svc = ctx.state.personas_use_case.clone();

    let personas = svc.list_personas(&rctx.tenant_id).await?;
    Ok(ApiResponse::json(StatusCode::OK, json!({ "personas": personas })))
}

#[route(path = "/{proxy+}", method = "OPTIONS")]
async fn handle_options(_ctx: RouteContext) -> Result<ApiResponse, ApiError> {
    Ok(ApiResponse::options())
}

#[route(path = "/personas/{id}", method = "GET")]
async fn get_persona(ctx: RouteContext) -> Result<ApiResponse, ApiError> {
    let rctx = RequestCtx::from_route(&ctx)?;
    let persona_id = ctx.params.get("id")
        .ok_or_else(|| ApiError::bad_request("Missing persona ID"))?;
    let svc = ctx.state.personas_use_case.clone();

    let persona = svc.get_persona(&rctx.tenant_id, persona_id).await?;
    Ok(ApiResponse::json(StatusCode::OK, json!(persona)))
}

#[route(path = "/personas", method = "POST")]
async fn create_persona(ctx: RouteContext) -> Result<ApiResponse, ApiError> {
    let rctx = RequestCtx::from_route(&ctx)?;
    let req: CreatePersonaRequest = serde_json::from_value(ctx.body.clone())?;
    let svc = ctx.state.personas_use_case.clone();

    let persona_id = svc.create_persona(&rctx.tenant_id, &rctx.actor_id, req).await?;
    Ok(ApiResponse::json(StatusCode::CREATED, json!({ "personaId": persona_id })))
}

#[route(path = "/personas/{id}/analyze", method = "POST")]
async fn analyze_persona_style(ctx: RouteContext) -> Result<ApiResponse, ApiError> {
    let rctx = RequestCtx::from_route(&ctx)?;
    let persona_id = ctx.params.get("id")
        .ok_or_else(|| ApiError::bad_request("Missing persona ID"))?;
    let svc = ctx.state.personas_use_case.clone();

    svc.trigger_style_analysis(&rctx.tenant_id, persona_id, &rctx.actor_id).await?;
    Ok(ApiResponse::json(StatusCode::ACCEPTED, json!({
        "message": "Style analysis started",
        "personaId": persona_id
    })))
}
```

### 4. Request Context Extraction

Extract tenant and actor IDs from authorizer context:

```rust
pub struct RequestCtx {
    pub tenant_id: String,
    pub actor_id: String,
}

impl RequestCtx {
    pub fn from_route(ctx: &RouteContext) -> Result<Self, ApiError> {
        let tenant_id = ctx.event
            .request_context
            .authorizer
            .as_ref()
            .and_then(|auth| auth.lambda.as_ref())
            .and_then(|lambda| lambda.get("tenantId"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| ApiError::unauthorized("Missing tenant ID"))?;

        let actor_id = ctx.event
            .request_context
            .authorizer

            .ok_or_else(|| ApiError::unauthorized("Missing actor ID"))?;

        Ok(Self { tenant_id, actor_id })
    }
}
```


### 5. Inbound Ports (Use Cases)

Define trait interfaces for domain services:

```rust
#[async_trait::async_trait]
pub trait PersonasUseCase: Send + Sync {
    async fn list_personas(&self, tenant_id: &str) -> Result<Vec<Persona>, ApiError>;
    async fn get_persona(&self, tenant_id: &str, persona_id: &str) -> Result<Persona, ApiError>;
    async fn create_persona(&self, tenant_id: &str, actor_id: &str, req: CreatePersonaRequest) -> Result<String, ApiError>;
    async fn update_persona(&self, tenant_id: &str, persona_id: &str, req: UpdatePersonaRequest) -> Result<(), ApiError>;
    async fn delete_persona(&self, tenant_id: &str, persona_id: &str) -> Result<(), ApiError>;
    async fn trigger_style_analysis(&self, tenant_id: &str, persona_id: &str, actor_id: &str) -> Result<(), ApiError>;
}

#[async_trait::async_trait]
pub trait BrandsUseCase: Send + Sync {
    async fn list_brands(&self, tenant_id: &str) -> Result<Vec<Brand>, ApiError>;
    async fn get_brand(&self, tenant_id: &str, brand_id: &str) -> Result<Brand, ApiError>;
    async fn create_brand(&self, tenant_id: &str, actor_id: &str, req: CreateBrandRequest) -> Result<String, ApiError>;
    async fn update_brand(&self, tenant_id: &str, brand_id: &str, req: UpdateBrandRequest) -> Result<(), ApiError>;
    async fn delete_brand(&self, tenant_id: &str, brand_id: &str) -> Result<(), ApiError>;
}
```

### 6. Use Case Implementation

Application layer orchestrates domain logic:

```rust
pub struct PersonasUseCaseImpl {
    repo: Arc<dyn PersonaRepository>,
    events: Arc<dyn EventPublisher>,
}
sona_id).await
    }

    async fn create_persona(&self, tenant_id: &str, actor_id: &str, req: CreatePersonaRequest) -> Result<String, ApiError> {
        let persona_id = generate_id();
        let now = chrono::Utc::now().to_rfc3339();

        let persona = Persona {
            id: persona_id.clone(),
            tenant_id: tenant_id.to_string(),
            name: req.name,
            role: req.role,
            audience: req.audience,
            created_at: now.clone(),
            updated_at: now,
            guardrails: req.guardrails,
            opinions: req.opinions,
            communication_preferences: req.communication_preferences,
        };

        self.repo.create(persona).await?;
        Ok(persona_id)
    }

    async fn trigger_style_analysis(&self, tenant_id: &str, persona_id: &str, actor_id: &str) -> Result<(), ApiError> {
        self.events.publish(Event {
            source: "api.personas".to_string(),
            detail_type: "StyleAnalysisRequested".to_string(),
            detail: json!({
                "tenantId": tenant_id,
                "personaId": persona_id,
            }),
        }).await
    }
}
```

### 7. Outbound Ports (Repository and Service Interfaces)

Define trait interfaces for external dependencies:

```rust
#[async_trait::async_trait]
pub trait PersonaRepository: Send + Sync {
    async fn list_by_tenant(&self, tenant_id: &str) -> Result<Vec<Persona>, ApiError>;
    async fn get(&self, tenant_id: &str, persona_id: &str) -> Result<Persona, ApiError>;
    async fn create(&self, persona: Persona) -> Result<(), ApiError>;
    async fn update(&self, persona: Persona) -> Result<(), ApiError>;
    async fn delete(&self, tenant_id: &str, persona_id: &str) -> Result<(), ApiError>;
}

#[async_trait::async_trait]
pub trait EventPublisher: Send + Sync {
    async fn publish(&self, event: Event) -> Result<(), ApiError>;
}

#[async_trait::async_trait]
pub trait ObjectStorage: Send + Sync {
    async fn generate_upload_url(&self, tenant_id: &str, file_name: &str, content_type: &str, bucket_type: BucketType) -> Result<PresignedUploadUrl, ApiError>;
}
```

### 8. Outbound Adapters (DynamoDB Implementation)

Implement repository using DynamoDB:

```rust
pub struct DynamoPersonaRepository {
    client: aws_sdk_dynamodb::Client,
    table_name: String,
}

impl DynamoPersonaRepository {
    pub fn new(client: aws_sdk_dynamodb::Client, table_name: String) -> Self {
        Self { client, table_name }
    }
}

#[async_trait::async_trait]
impl PersonaRepository for DynamoPersonaRepository {
    async fn list_by_tenant(&self, tenant_id: &str) -> Result<Vec<Persona>, ApiError> {
        let result = self.client
            .query()
            .table_name(&self.table_name)
            .index_name("GSI1")
            .key_condition_expression("GSI1PK = :pk AND begins_with(GSI1SK, :sk)")
            .expression_attribute_values(":pk", AttributeValue::S(tenant_id.to_string()))
            .expression_attribute_values(":sk", AttributeValue::S("PERSONA#".to_string()))
            .send()
            .await
            .map_err(map_dynamo_err)?;

        result.items()
            .iter()
            .map(|item| deserialize_persona(item))
            .collect()
    }

    async fn get(&self, tenant_id: &str, persona_id: &str) -> Result<Persona, ApiError> {
        let result = self.client
            .get_item()
            .table_name(&self.table_name)
            .key("pk", AttributeValue::S(format!("{}#{}", tenant_id, persona_id)))
            .key("sk", AttributeValue::S("metadata".to_string()))
            .send()
            .await
            .map_err(map_dynamo_err)?;

        result.item()
            .ok_or_else(|| ApiError::not_found("Persona not found"))
            .and_then(|item| deserialize_persona(item))
    }

    async fn create(&self, persona: Persona) -> Result<(), ApiError> {
        let item = serialize_persona(&persona)?;

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .condition_expression("attribute_not_exists(pk) AND attribute_not_exists(sk)")
            .send()
            .await
            .map_err(map_dynamo_err)?;

        Ok(())
    }
}

pub fn map_dynamo_err(e: impl std::fmt::Display) -> ApiError {
    let msg = e.to_string();
    if msg.contains("ConditionalCheckFailedException") {
        ApiError::conflict("Resource already exists")
    } else {
        eprintln!("DynamoDB error: {}", msg);
        ApiError::internal("DynamoDB operation failed")
    }
}

fn serialize_persona(persona: &Persona) -> Result<HashMap<String, AttributeValue>, ApiError> {
    let mut item = HashMap::new();

    item.insert("pk".to_string(), AttributeValue::S(format!("{}#{}", persona.tenant_id, persona.id)));
    item.insert("sk".to_string(), AttributeValue::S("metadata".to_string()));
    item.insert("GSI1PK".to_string(), AttributeValue::S(persona.tenant_id.clone()));
    item.insert("GSI1SK".to_string(), AttributeValue::S(format!("PERSONA#{}", persona.created_at)));
    item.insert("id".to_string(), AttributeValue::S(persona.id.clone()));
    item.insert("name".to_string(), AttributeValue::S(persona.name.clone()));
    item.insert("role".to_string(), AttributeValue::S(persona.role.clone()));
    item.insert("createdAt".to_string(), AttributeValue::S(persona.created_at.clone()));
    item.insert("updatedAt".to_string(), AttributeValue::S(persona.updated_at.clone()));

    if let Some(ref audience) = persona.audience {
        item.insert("audience".to_string(), AttributeValue::S(audience.clone()));
    }

    Ok(item)
}

fn deserialize_persona(item: &HashMap<String, AttributeValue>) -> Result<Persona, ApiError> {
    Ok(Persona {
        id: get_string(item, "id")?,
        tenant_id: extract_tenant_from_pk(get_string(item, "pk")?)?,
        name: get_string(item, "name")?,
        role: get_string(item, "role")?,
        created_at: get_string(item, "createdAt")?,
        updated_at: get_string(item, "updatedAt")?,
        audience: get_optional_string(item, "audience"),
        guardrails: None,
        opinions: None,
        communication_preferences: None,
    })
}
```


### 9. EventBridge Adapter

Implement event publisher using EventBridge:

```rust
pub struct EventBridgePublisher {
    client: aws_sdk_eventbridge::Client,
    event_bus_name: String,
}

impl EventBridgePublisher {
    pub fn new(client: aws_sdk_eventbridge::Client, event_bus_name: String) -> Self {
        Self { client, event_bus_name }
    }
}

#[async_trait::async_trait]
impl EventPublisher for EventBridgePublisher {
    async fn publish(&self, event: Event) -> Result<(), ApiError> {
        let entry = PutEventsRequestEntry::builder()
            .source(event.source)
            .detail_type(event.detail_type)
            .detail(event.detail.to_string())
            .event_bus_name(&self.event_bus_name)
            .build();

        self.client
            .put_events()
            .entries(entry)
            .send()
            .await
            .map_err(|e| {
                eprintln!("EventBridge publish failed: {}", e);
                ApiError::internal("Event publishing failed")
            })?;

        Ok(())
    }
}
```

### 10. S3 Adapter

Implement object storage using S3:

```rust
pub struct S3ObjectStorage {
    client: aws_sdk_s3::Client,
    brand_assets_bucket: String,
    assets_bucket: String,
}

impl S3ObjectStorage {
    pub fn new(client: aws_sdk_s3::Client, brand_assets_bucket: String, assets_bucket: String) -> Self {
        Self { client, brand_assets_bucket, assets_bucket }
    }
}

#[async_trait::async_trait]
impl ObjectStorage for S3ObjectStorage {
    async fn generate_upload_url(&self, tenant_id: &str, file_name: &str, content_type: &str, bucket_type: BucketType) -> Result<PresignedUploadUrl, ApiError> {
        let bucket = match bucket_type {
            BucketType::BrandAssets => &self.brand_assets_bucket,
            BucketType::Assets => &self.assets_bucket,
        };

        let key = format!("{}/{}/{}", tenant_id, generate_id(), file_name);

        let presigned = self.client
            .put_object()
            .bucket(bucket)
            .key(&key)
            .content_type(content_type)
            .presigned(PresigningConfig::expires_in(Duration::from_secs(3600))
                .map_err(|e| {
                    eprintln!("Presigning config failed: {}", e);
                    ApiError::internal("Presigning configuration failed")
                })?)
            .await
            .map_err(|e| {
                eprintln!("Presigning failed: {}", e);
                ApiError::internal("Presigning failed")
            })?;

        Ok(PresignedUploadUrl {
            method: "PUT".to_string(),
            url: presigned.uri().to_string(),
            key,
        })
    }
}

pub struct PresignedUploadUrl {
    pub method: String,
    pub url: String,
    pub key: String,
}
```

## Data Models

### Domain Entities

Define structs matching the existing DynamoDB schema:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Persona {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub role: String,
    pub audience: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub guardrails: Option<Guardrails>,
    pub opinions: Option<Opinions>,
    pub communication_preferences: Option<CommunicationPreferences>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Brand {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub ethos: String,
    pub created_at: String,
    pub updated_at: String,
    pub visual_motifs: Option<Vec<String>>,
    pub narrative_arc: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Campaign {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub brand_id: String,
    pub persona_ids: Vec<String>,
    pub status: CampaignStatus,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CampaignStatus {
    Draft,
    Building,
    Ready,
    Published,
}
```

### DynamoDB Key Patterns

Maintain existing single-table design:

```
Personas:
  pk: {tenantId}#{personaId}
  sk: metadata
  GSI1PK: {tenantId}
  GSI1SK: PERSONA#{createdAt}

Writing Examples:
  pk: {tenantId}#{personaId}
  sk: EXAMPLE#{exampleId}

Brands:
  pk: {tenantId}#{brandId}
  sk: metadata
  GSI1PK: {tenantId}
  GSI1SK: BRAND#{createdAt}

Brand Assets:
  pk: {tenantId}#{brandId}
  sk: ASSET#{assetId}

Campaigns:
  pk: {tenantId}#{campaignId}
  sk: metadata
  GSI1PK: {tenantId}
  GSI1SK: CAMPAIGN#{createdAt}

Campaign Posts:
  pk: {tenantId}#{campaignId}
  sk: POST#{postId}

Assets:
  pk: {tenantId}#{assetId}
  sk: metadata
  GSI1PK: {tenantId}
  GSI1SK: ASSET#{createdAt}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Route Matching Correctness
*For any* valid HTTP method and path combination defined in the OpenAPI specification, the request router should invoke the correct handler function for that endpoint.
**Validates: Requirements 1.2**

### Property 2: Tenant Context Extraction
*For any* request with authorizer context containing a tenantId, the API router should successfully extract the tenant ID and make it available to handler functions.
**Validates: Requirements 1.5**

### Property 3: EventBridge Event Publishing
*For any* request to trigger an async workflow, the API router should publish an event to EventBridge with the correct event type and detail structure.
**Validates: Requirements 2.6**

### Property 4: OpenAPI Contract Compliance
*For any* endpoint operation, the router should accept requests matching the OpenAPI contract and return responses that conform to the specified schema including correct status codes and response structure.
**Validates: Requirements 5.1, 5.2**

### Property 5: Tenant Isolation in DynamoDB Operations
*For any* DynamoDB operation, the partition key should include the tenant ID extracted from the authorizer context, ensuring tenant data isolation.
**Validates: Requirements 6.2**

### Property 6: Tenant Validation
*For any* request without a tenant ID in the authorizer context, the API router should reject the request before processing any operations.
**Validates: Requirements 6.3**

### Property 7: DynamoDB Key Structure Preservation
*For any* DynamoDB operation, the API router should use the existing pk/sk key structure matching the current implementation.
**Validates: Requirements 7.1**

### Property 8: GSI Query Pattern Consistency
*For any* list operation, the API router should query the correct GSI (GSI1) with the appropriate key condition expression matching the existing pattern.
**Validates: Requirements 7.2**

### Property 9: Conditional Create Expressions
*For any* create operation, the API router should use conditional expressions to prevent overwriting existing resources.
**Validates: Requirements 7.3**

### Property 10: DynamoDB Error Handling Consistency
*For any* DynamoDB error condition, the API router should return error responses matching the existing implementation's error handling behavior.
**Validates: Requirements 7.5**

### Property 11: EventBridge Payload Structure
*For any* EventBridge event published by the API router, the event payload should contain all required fields (tenantId, resource identifiers).
**Validates: Requirements 8.2**

### Property 12: EventBridge Error Handling
*For any* EventBridge publish failure, the API router should return an appropriate error response to the client.
**Validates: Requirements 8.4**

### Property 13: S3 Tenant Isolation
*For any* presigned URL generated for S3 uploads, the object key should include a tenant-specific prefix to ensure tenant data isolation.
**Validates: Requirements 9.3**

### Property 14: Presigned URL Expiration
*For any* presigned URL generated by the API router, the URL should have an appropriate expiration time configured.
**Validates: Requirements 9.4**

### Property 15: Presigned URL Response Structure
*For any* upload request, the response should contain the presigned URL with method and key information.
**Validates: Requirements 9.5**

### Property 16: Error Message Format
*For any* error response, the response body should contain a "message" property with a user-friendly error description.
**Validates: Requirements 10.2**

### Property 17: Error Message Security
*For any* error response, the error message should not expose sensitive information such as internal tenant IDs, database details, or stack traces.
**Validates: Requirements 10.4**

### Property 18: Unexpected Failure Handling
*For any* unexpected failure, the API router returns a 500 with a generic message and logs the internal error with request context.
**Validates: Requirements 10.5**


## Error Handling

### ApiResponse Helper

All responses include CORS headers automatically:

```rust
pub struct ApiResponse {
    status_code: StatusCode,
    body: Option<String>,
}

impl ApiResponse {
    pub fn json(status: StatusCode, data: serde_json::Value) -> Self {
        Self {
            status_code: status,
            body: Some(data.to_string()),
        }
    }

    pub fn options() -> Self {
        Self {
            status_code: StatusCode::OK,
            body: None,
        }
    }

    pub fn to_lambda_response(self) -> ApiGatewayProxyResponse {
        let mut headers = HashMap::new();
        headers.insert("Content-Type".to_string(), "application/json".to_string());
        headers.insert("Access-Control-Allow-Origin".to_string(), "*".to_string());
        headers.insert("Access-Control-Allow-Methods".to_string(), "GET,POST,PUT,DELETE,OPTIONS".to_string());
        headers.insert("Access-Control-Allow-Headers".to_string(), "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token".to_string());

        ApiGatewayProxyResponse {
            status_code: self.status_code.as_u16() as i64,
            headers,
            body: self.body,
            is_base64_encoded: false,
            multi_value_headers: HashMap::new(),
        }
    }
}
```

### Error Categories

**Client Errors (4xx)**:
- 400 Bad Request: Invalid request body, missing required fields
- 401 Unauthorized: Missing or invalid tenant ID from authorizer
- 404 Not Found: Resource does not exist
- 409 Conflict: Resource already exists (ConditionalCheckFailedException)

**Server Errors (5xx)**:
- 500 Internal Server Error: Unexpected errors, AWS service failures
- 503 Service Unavailable: Temporary AWS service issues

### Error Response Format

All error responses follow this structure:

```json
{
  "message": "User-friendly error description"
}
```

### Error Type Definition

```rust
#[derive(Debug)]
pub enum ApiError {
    BadRequest(String),
    Unauthorized(String),
    NotFound(String),
    Conflict(String),
    Internal(String),
}

impl ApiError {
    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self::BadRequest(msg.into())
    }

    pub fn unauthorized(msg: impl Into<String>) -> Self {
        Self::Unauthorized(msg.into())
    }

    pub fn not_found(msg: impl Into<String>) -> Self {
        Self::NotFound(msg.into())
    }

    pub fn conflict(msg: impl Into<String>) -> Self {
        Self::Conflict(msg.into())
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(msg.into())
    }

    pub fn status_code(&self) -> StatusCode {
        match self {
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            Self::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::Conflict(_) => StatusCode::CONFLICT,
            Self::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    pub fn message(&self) -> &str {
        match self {
            Self::BadRequest(msg) => msg,
            Self::Unauthorized(msg) => msg,
            Self::NotFound(msg) => msg,
            Self::Conflict(msg) => msg,
            Self::Internal(_) => "Something went wrong",
        }
    }

    pub fn to_response(&self) -> ApiResponse {
        ApiResponse::json(self.status_code(), json!({ "message": self.message() }))
    }
}
```

### Error Logging

Log errors with structured context:

```rust
eprintln!("Operation failed: operation={}, tenantId={}, resourceId={}, error={:?}",
    operation, tenant_id, resource_id, error);
```

## Testing Strategy

### Dual Testing Approach

The migration requires both unit tests and integration tests to ensure correctness:

**Unit Tests** (Rust):
- Unit test use cases by swapping outbound ports with in-memory fakes (no AWS SDK in unit tests)
- Test serialization/deserialization functions
- Test tenant extraction logic
- Test error handling paths
- Test path parameter extraction
- Focus on specific examples and edge cases

**Integration Tests** (Existing test suite):
- Integration test adapters separately (Dynamo repository tests can run against DynamoDB Local or a dedicated test table)
- Run existing Node.js integration tests against the Rust Lambda
- Verify API contract compatibility
- Test end-to-end request/response flows
- Validate tenant isolation
- Test async workflow triggers
- Ensure all existing tests pass with minimal changes

**Testing Boundaries**:
- The primary unit-test seam is the port boundary, not the handler
- Handlers are kept thin and can be covered with a small number of routing/serialization tests

### OpenAPI Contract Validation

OpenAPI is used to validate documentation and client expectations, but infrastructure routing is driven by {proxy+}. Integration tests should validate that router behavior matches the OpenAPI contract.

### Property-Based Testing

Property-based tests are optional and deferred unless we see repeated edge-case bugs in key formatting or serialization. Integration tests are the primary compatibility gate.

### Migration Testing Strategy

**Phase 1: Unit Test Development**
- Write unit tests for use cases with fake repositories
- Test serialization/deserialization
- Test error handling
- Achieve >80% code coverage

**Phase 2: Integration Test Compatibility**
- Run existing integration tests against Rust Lambda
- Fix any compatibility issues
- Ensure all tests pass

### Test Organization

```
rust-api/
├── src/
│   ├── main.rs
│   ├── inbound/
│   │   ├── http/
│   │   │   ├── router.rs
│   │   │   ├── personas_routes.rs
│   │   │   ├── brands_routes.rs
│   │   │   ├── campaigns_routes.rs
│   │   │   └── assets_routes.rs
│   │   └── request_ctx.rs
│   ├── application/
│   │   ├── personas_use_case.rs
│   │   ├── brands_use_case.rs
│   │   ├── campaigns_use_case.rs
│   │   └── assets_use_case.rs
│   ├── domain/
│   │   ├── persona.rs
│   │   ├── brand.rs
│   │   └── campaign.rs
│   ├── ports/
│   │   ├── persona_repository.rs
│   │   ├── object_storage.rs
│   │   └── event_publisher.rs
│   ├── outbound/
│   │   ├── dynamodb/
│   │   │   ├── persona_repository.rs
│   │   │   ├── mapper.rs
│   │   │   └── errors.rs
│   │   ├── s3/
│   │   │   └── object_storage.rs
│   │   └── eventbridge/
│   │       └── publisher.rs
│   └── shared/
│       ├── api_error.rs
│       └── api_response.rs
└── tests/
    ├── unit/
    │   ├── personas_use_case_test.rs
    │   └── key_format_test.rs
    └── integration/
        └── api_contract_test.rs
```

## Deployment Strategy

### Build Process

Use Cargo Lambda for building and deploying:

```bash
cargo install cargo-lambda

cargo lambda build --release --arm64

cargo lambda deploy --iam-role arn:aws:iam::ACCOUNT:role/lambda-role
```

### SAM Template Changes

API Gateway routing is configured using a single {proxy+} integration to the Rust router Lambda. OpenAPI is maintained for documentation and client generation only and is not used as the infrastructure routing definition. This avoids duplicating dozens of per-route SAM event entries while keeping the API contract explicit.

**Before (32 functions)**:
```yaml
Resources:
  ListPersonasFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: list-personas.handler
      Runtime: nodejs22.x

  CreatePersonaFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: create-persona.handler
      Runtime: nodejs22.x
```

**After (1 function)**:
```yaml
Resources:
  ApiRouterFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: bootstrap
      Runtime: provided.al2023
      Architectures:
        - arm64
      CodeUri: rust-api/target/lambda/api-router/
      MemorySize: 512
      Timeout: 25
      Environment:
        Variables:
          TABLE_NAME: !Ref MainTable
          BRAND_ASSETS_BUCKET: !Ref BrandAssetsBucket
          ASSETS_BUCKET: !Ref AssetsBucket
          EVENT_BUS_NAME: !Ref EventBus
      Events:
        ApiProxy:
          Type: HttpApi
          Properties:
            Path: /{proxy+}
            Method: ANY
```

### Rollback Plan

Deploy the Rust router behind the existing API Gateway integration in a controlled environment first (dev, then staging). Once staging passes the full integration suite, perform a production cutover during a planned maintenance window. Keep the Node.js functions deployed for immediate rollback by reverting the API Gateway integration to the prior configuration. Rollback is a configuration revert, not a progressive traffic shift.

### Monitoring

**CloudWatch Metrics**:
- Lambda invocation count
- Error rate
- Duration (p50, p99)
- Throttles

**CloudWatch Logs**:
- Structured error logs
- Request/response logging (in development)

**Alarms**:
- Error rate > 1%

## Migration Checklist

### Pre-Migration
- [ ] Audit all 32 Node.js functions
- [ ] Document current API behavior
- [ ] Review OpenAPI specification
- [ ] Identify any custom error handling

### Development
- [ ] Set up Rust project with Cargo Lambda
- [ ] Implement hexagonal architecture structure
- [ ] Implement domain entities and use cases
- [ ] Implement outbound adapters (DynamoDB, S3, EventBridge)
- [ ] Implement inbound adapters (HTTP routes)
- [ ] Write unit tests with fake repositories

### Testing
- [ ] Run unit tests (>80% coverage)
- [ ] Run existing integration tests
- [ ] Load testing
- [ ] Security testing (tenant isolation)

### Deployment
- [ ] Update SAM template
- [ ] Deploy to development environment
- [ ] Smoke test all endpoints
- [ ] Deploy to staging environment
- [ ] Run full test suite
- [ ] Production cutover during maintenance window
- [ ] Monitor metrics and logs
- [ ] Remove Node.js functions after validation

### Post-Migration
- [ ] Update documentation
- [ ] Train team on Rust codebase
- [ ] Establish Rust development workflow
- [ ] Archive Node.js function code
