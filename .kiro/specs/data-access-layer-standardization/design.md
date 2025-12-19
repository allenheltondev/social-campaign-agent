# Data Access Layer Standardization Design

## Overview

This design establishes a consistent data access layer pattern across all entities in the social media campaign builder platform. The standardization ensures that all Lambda functions interact with data through model classes that handle DynamoDB operations, tenant isolation, and DTO transformation. This creates a clean separation between API handlers and data persistence while providing consistent response formats for all entities.

## Architecture

### Current State Analysis

The existing codebase shows inconsistent data access patterns:

- **Brand and Persona APIs**: Use model classes (`Brand.findById`, `Persona.findById`) with DTO transformation
- **Campaign API**: Direct DynamoDB operations in Lambda functions, exposing internal fields
- **Social Post API**: Mixed approach with some model usage but inconsistent DTO handling

### Target Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Handler   │    │   Model Layer   │    │   DynamoDB      │
│   (Lambda)      │───▶│   (DTO Trans)   │───▶│   (Raw Data)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
   Clean DTOs            Business Logic           Tenant Isolation
   No DB Keys            Validation               DDB Key Management
   No Tenant IDs         Error Handling          GSI Management
```

## Components and Interfaces

### Base Model Interface

All entity models will implement a consistent interface:

```javascript
class BaseModel {
  // Core CRUD operations - these handle DTO transformation internally
  static async findById(tenantId, entityId)      // Returns clean DTO
  static async save(tenantId, entity)            // Accepts and returns DTO
  static async update(tenantId, entityId, updateData)  // Returns DTO
  static async delete(tenantId, entityId)        // Returns success status

  // Internal transformation methods (used by CRUD operations)
  static _transformFromDynamoDB(rawEntity)       // Internal: DDB -> DTO
  static _transformToDynamoDB(tenantId, entity)  // Internal: DTO -> DDB

  // Validation and utilities
  static validateEntity(entity)
  static generateId()
}
```

### Entity-Specific Models

Each entity model extends the base pattern:

#### Campaign Model
- **Current Issues**: Direct DynamoDB access in handlers, exposes `tenantId` and DDB keys
- **Target**: Full model abstraction with `Campaign.findById()` returning clean DTOs

#### SocialPost Model
- **Current Issues**: Mixed model usage, inconsistent DTO transformation
- **Target**: Standardized model interface with clean post DTOs

#### Brand Model
- **Current State**: Good model usage but inconsistent DTO handling
- **Target**: Enhanced DTO transformation, remove tenant exposure

#### Persona Model
- **Current State**: Good model usage but needs DTO standardization
- **Target**: Consistent DTO format, enhanced transformation

### DTO Response Format

All entity DTOs will follow this structure:

```javascript
// Entity DTO (what APIs return)
{
  id: "entity_123",           // Clean entity identifier
  name: "Entity Name",        // Business properties only
  // ... other business fields
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z"
  // NO tenantId, NO pk/sk, NO GSI keys
}

// Collection Response Format
{
  items: [/* array of DTOs */],
  pagination: {
    nextToken: "...",
    limit: 50,
    total: 150
  }
}
```

## Data Models

### DynamoDB Key Structure (Internal)

```javascript
// Internal DynamoDB structure (never exposed)
{
  pk: "tenant123#entity456",     // Partition key with tenant isolation
  sk: "metadata",                // Sort key for entity type
  GSI1PK: "tenant123",          // Global secondary index for tenant queries
  GSI1SK: "ENTITY#2024-01-01",  // GSI sort key for time-based queries
  // ... business data fields
  // Note: tenantId is parsed from pk, not stored separately
  entityId: "entity456"         // Internal entity reference
}
```

### DTO Structure (External)

```javascript
// Clean DTO structure (what APIs return)
{
  id: "entity456",              // Clean identifier without tenant prefix
  // ... business fields only
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z"
  // NO internal fields (pk, sk, GSI keys, tenantId)
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Property 1: Model-based data access consistency
*For any* entity retrieval operation, the system should use the entity's model class methods rather than direct DynamoDB operations
**Validates: Requirements 1.1, 2.1, 5.1**

Property 2: DTO tenant isolation
*For any* entity DTO transformation, the resulting DTO should not contain tenant identifiers or internal tenant references
**Validates: Requirements 1.2, 2.3**

Property 3: DTO database key exclusion
*For any* entity DTO transformation, the resulting DTO should not contain DynamoDB keys (pk, sk, GSI keys)
**Validates: Requirements 1.3**

Property 4: DTO identifier consistency
*For any* entity DTO transformation, the resulting DTO should contain an "id" property with the clean entity identifier
**Validates: Requirements 1.4**

Property 5: DTO clean structure
*For any* entity DTO transformation, the resulting DTO should contain only business-relevant properties without internal database artifacts
**Validates: Requirements 1.5**

Property 6: Model DTO return consistency
*For any* entity loading operation, the model's CRUD methods should return clean DTOs without requiring external transformation
**Validates: Requirements 2.2, 3.3**

Property 7: Model error handling consistency
*For any* entity operation error across different models, the error response format should be consistent
**Validates: Requirements 2.4, 3.5, 4.3**

Property 8: Model validation consistency
*For any* entity validation operation, the system should use the model's validation logic rather than external validation
**Validates: Requirements 2.5**

Property 9: Model interface consistency
*For any* entity model implementation, the model should provide consistent method signatures for CRUD operations that return DTOs directly
**Validates: Requirements 3.1**

Property 10: Model key generation encapsulation
*For any* entity model operation, DynamoDB key generation should be handled internally without requiring external key construction
**Validates: Requirements 3.2**

Property 11: Model tenant isolation enforcement
*For any* entity access attempt with incorrect tenant context, the model should prevent cross-tenant data access
**Validates: Requirements 3.4**

Property 12: DTO structure consistency across entities
*For any* entity type, the DTO structure should follow consistent patterns (id field, business properties, timestamps)
**Validates: Requirements 4.1**

Property 13: Collection response format consistency
*For any* entity collection query, the response format should include consistent pagination and metadata structure
**Validates: Requirements 4.2**

Property 14: Validation error format consistency
*For any* entity validation failure across different entity types, the validation error format should be consistent
**Validates: Requirements 4.4**

Property 15: Not found response consistency
*For any* entity not found scenario across different entity types, the 404 response format should be consistent
**Validates: Requirements 4.5**

Property 16: Business logic DTO usage
*For any* business logic operation, the system should work with DTO objects rather than raw database records
**Validates: Requirements 5.2**

Property 17: Model mockability for testing
*For any* model method, the method should be mockable independently for unit testing without requiring actual DynamoDB access
**Validates: Requirements 5.3**

Property 18: Layer separation enforcement
*For any* API handler implementation, the handler should delegate data access to model methods and maintain clear separation from data access logic
**Validates: Requirements 5.4**

<function_calls>
<invoke name="prework">
<parameter name="featureName">data-access-layer-standardization


## Error Handling

### Model-Level Error Handling

All models will implement consistent error handling:

```javascript
class EntityModel {
  static async findById(tenantId, entityId) {
    try {
      // DynamoDB operation
      const response = await ddb.send(new GetItemCommand({...}));

      if (!response.Item) {
        return null;  // Consistent null return for not found
      }

      // Transform internally and return clean DTO
      return this._transformFromDynamoDB(unmarshall(response.Item));
    } catch (error) {
      // Log with context but don't expose internal details
      console.error('Entity retrieval failed', {
        entityId,
        errorName: error.name,
        errorMessage: error.message
      });
      throw new EntityError('Failed to retrieve entity', error);
    }
  }
}
```

### API Handler Error Handling

Lambda functions will handle model errors consistently:

```javascript
export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { entityId } = event.pathParameters;

    const entity = await EntityModel.findById(tenantId, entityId);

    if (!entity) {
      return formatResponse(404, { message: 'Entity not found' });
    }

    return formatResponse(200, entity);  // entity is already a clean DTO
  } catch (error) {
    console.error('Handler error:', error);
    return formatResponse(500, { message: 'Internal server error' });
  }
};
```

### Internal Transformation Methods

Models will handle DTO transformation internally:

```javascript
class EntityModel {
  static _transformFromDynamoDB(rawEntity) {
    const cleanEntity = { ...rawEntity };

    // Remove all internal DynamoDB fields
    delete cleanEntity.pk;
    delete cleanEntity.sk;
    delete cleanEntity.GSI1PK;
    delete cleanEntity.GSI1SK;
    delete cleanEntity.GSI2PK;
    delete cleanEntity.GSI2SK;

    // Extract clean ID from entityId field (tenant is parsed from pk when needed)
    cleanEntity.id = cleanEntity.entityId;
    delete cleanEntity.entityId;

    return cleanEntity;
  }

  static _transformToDynamoDB(tenantId, entity) {
    const now = new Date().toISOString();

    return {
      pk: `${tenantId}#${entity.id}`,
      sk: 'metadata',
      GSI1PK: tenantId,
      GSI1SK: `ENTITY#${now}`,
      entityId: entity.id,
      ...entity,
      updatedAt: now
    };
  }
```

### Error Response Format

All error responses will follow this structure:

```javascript
{
  message: "User-friendly error message",
  code: "ERROR_CODE",  // Optional error code for client handling
  details: {}          // Optional additional context (never internal details)
}
```

## Testing Strategy

### Unit Testing

Unit tests will focus on model methods and DTO transformations:

- **Model CRUD Operations**: Test each model's findById, save, update, delete methods
- **DTO Transformation**: Test internal transformation methods ensure clean DTO output
- **Validation Logic**: Test model validation methods with valid and invalid data
- **Error Handling**: Test error scenarios and ensure consistent error formats
- **Tenant Isolation**: Test that models properly isolate data by tenant

### Property-Based Testing

Property-based tests will verify universal properties across all entity types:

- **DTO Cleanliness**: Generate random entities and verify DTOs never contain internal fields
- **Model Interface Consistency**: Verify all models implement the same interface
- **Error Format Consistency**: Trigger errors across different models and verify consistent formats
- **Tenant Isolation**: Generate random tenant contexts and verify cross-tenant access is prevented
- **Key Generation**: Verify models generate proper DynamoDB keys without external input

Property-based testing will use the `fast-check` library for JavaScript, configured to run a minimum of 100 iterations per property test.

Each property-based test will be tagged with a comment explicitly referencing the correctness property in this design document using the format: `**Feature: data-access-layer-standardization, Property {number}: {property_text}**`

### Integration Testing

Integration tests will verify end-to-end workflows:

- **API to Database**: Test complete request/response cycles through Lambda handlers
- **Multi-Entity Operations**: Test operations that involve multiple entity types
- **Error Propagation**: Test that errors propagate correctly through all layers
- **Performance**: Test that model abstraction doesn't introduce significant overhead

## Implementation Approach

### Phase 1: Standardize Existing Models

1. **Enhance internal transformation in all models**: Ensure CRUD methods return clean DTOs
2. **Standardize method signatures**: Ensure all models have findById, save, update, delete
3. **Enhance error handling**: Add consistent error handling to all model methods
4. **Add validation methods**: Centralize validation logic in models

### Phase 2: Refactor Lambda Functions

1. **Campaign Functions**: Replace direct DynamoDB calls with Campaign model methods
2. **Social Post Functions**: Standardize to use SocialPost model consistently
3. **Brand Functions**: Enhance to return clean DTOs without tenant/DDB keys
4. **Persona Functions**: Enhance to return clean DTOs without tenant/DDB keys

### Phase 3: Testing and Validation

1. **Add unit tests**: Test all model methods and DTO transformations
2. **Add property tests**: Verify universal properties across all entities
3. **Integration testing**: Verify end-to-end workflows
4. **Performance testing**: Ensure no significant performance degradation

## Migration Strategy

### Backward Compatibility

During migration, we'll maintain backward compatibility:

- Existing API responses will continue to work
- Internal changes won't affect external contracts
- Gradual rollout per entity type

### Rollout Sequence

1. **Campaign Model**: Highest priority due to current inconsistencies
2. **Social Post Model**: Second priority for consistency
3. **Brand Model**: Enhance existing good patterns
4. **Persona Model**: Enhance existing good patterns

### Validation Checkpoints

After each entity migration:
- Run full test suite
- Verify API responses match expected DTO format
- Check performance metrics
- Validate tenant isolation

## Performance Considerations

### Model Abstraction Overhead

The model layer adds minimal overhead:
- DTO transformation is simple object manipulation
- Key generation is lightweight (ULID)
- No additional database calls

### Optimization Strategies

- **Connection Reuse**: DynamoDB client reused across invocations
- **Batch Operations**: Models support batch operations where applicable
- **Caching**: Models can implement caching for frequently accessed data
- **Lazy Loading**: Only load related entities when needed

## Security Considerations

### Tenant Isolation

Models enforce tenant isolation at the data access layer:
- All queries include tenant context in partition keys
- Cross-tenant access attempts are prevented
- Tenant IDs never exposed in API responses

### Data Sanitization

Models handle data sanitization:
- Remove internal fields before returning DTOs
- Validate input data before persistence
- Prevent injection attacks through parameterized queries

### Audit Logging

Models provide consistent audit logging:
- Log all data access operations with context
- Include tenant and entity identifiers
- Never log sensitive data or credentials

## Dependencies

### External Libraries

- **AWS SDK v3**: DynamoDB client for data access
- **Zod**: Schema validation for entity data
- **ULID**: Unique identifier generation
- **fast-check**: Property-based testing library

### Internal Dependencies

- **utils/api-response.mjs**: Consistent API response formatting
- **utils/error-handler.mjs**: Standardized error handling
- **utils/validation.mjs**: Shared validation utilities

## Future Enhancements

### Potential Improvements

1. **Base Model Class**: Create abstract base class with common functionality
2. **Query Builder**: Add fluent query builder for complex queries
3. **Caching Layer**: Add optional caching for frequently accessed entities
4. **Audit Trail**: Automatic audit trail for all entity changes
5. **Soft Delete**: Standardized soft delete across all entities
6. **Versioning**: Entity versioning for change tracking

### Extensibility

The design supports future extensions:
- New entity types can follow the same pattern
- Additional transformation methods can be added
- Custom validation rules can be implemented per entity
- Query methods can be extended for specific use cases
