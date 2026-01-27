# Brand Asset UX Integration Design Document

## Overview

The Brand Asset UX Integration system bridges the gap between existing brand management, asset management, and campaign creation capabilities by establishing simple workflows for associating assets with brands and automatically including them in campaigns. This design focuses on the core v1 functionality: brands can have asset libraries, and those assets automatically flow into campaigns.

The design leverages existing infrastructure including DynamoDB for metadata storage, S3 for internal asset storage, and the campaign planner agent for asset selection. New capabilities include brand-asset associations stored within brand entities and automatic asset pool construction during campaign creation.

## Architecture

### System Architecture

The Brand Asset UX Integration extends existing components with simple workflows:

**Brand Management Extensions**
- Brand entities extended to store asset associations
- Brand API endpoints enhanced to accept asset arrays
- Brand service validates asset references and external URLs

**Campaign Creation Enhancements**
- Campaign creation automatically constructs asset pools from brand associations
- Asset pool builder merges brand assets with campaign-specific additions
- Campaign API provides asset pool to campaign planner

**Campaign Planner Integration**
- Planner receives asset pool with descriptions
- Asset selection based on descriptions and content alignment
- Posts generated without assets when no suitable match exists

### Data Flow

**Brand Asset Association Flow**
1. User creates/updates brand with asset associations
2. Brand service validates internal asset references
3. Brand service validates external asset URLs
4. Brand entity stores asset associations
5. Brand retrieval includes complete asset metadata

**Campaign Asset Pool Construction Flow**
1. User creates campaign with brand ID
2. Campaign service retrieves brand entity
3. Asset pool builder extracts brand-associated assets
4. Asset pool builder merges with campaign-specific assets
5. Complete asset pool provided to campaign planner

**Asset Selection During Planning Flow**
1. Campaign planner receives asset pool with descriptions
2. For each post, planner evaluates asset suitability based on descriptions
3. Best-match asset assigned to post
4. Posts without suitable assets generated without forced matches

## Components and Interfaces

### Core Components

#### 1. Brand Asset Association Manager
- **Purpose**: Manages relationships between brands and assets
- **Responsibilities**: Validate asset references, store associations, retrieve asset metadata
- **Interface**: Extended brand API endpoints
- **Dependencies**: Brand Service, Asset Service, DynamoDB

#### 2. Asset Pool Builder
- **Purpose**: Constructs complete asset pools for campaigns
- **Responsibilities**: Merge brand assets with campaign additions, validate asset availability
- **Interface**: Internal service called during campaign creation
- **Dependencies**: Brand Service, Asset Service

#### 3. Asset Selection Logic
- **Purpose**: Matches assets to posts during planning
- **Responsibilities**: Evaluate asset suitability based on descriptions
- **Interface**: Enhanced campaign planner component
- **Dependencies**: Brand Service, Asset Service

### API Enhancements

**Brand API Extensions**

```javascript
// Extended brand creation/update payload
PUT /brands/{brandId}
{
  // ... existing brand fields
  assets: [
    {
      type: 'internal',
      assetId: 'asset_123'
    },
    {
      type: 'external',
      url: 'https://example.com/hero.jpg',
      description: 'Product hero image for campaigns',
      contentType: 'image/jpeg'
    }
  ]
}
```

**Campaign API Extensions**

```javascript
// Campaign creation with assets
POST /campaigns
{
  // ... existing campaign fields
  brandId: 'brand_123',
  assets: [
    {
      type: 'internal',
      assetId: 'asset_456'
    },
    {
      type: 'external',
      url: 'https://example.com/campaign-specific.jpg',
      description: 'One-off campaign image',
      contentType: 'image/jpeg'
    }
  ]
}
```

## Data Models

### Extended Brand Entity

```javascript
{
  // ... existing brand fields

  // Brand Asset Library
  assets: [
    {
      type: 'internal',
      assetId: 'string',
      addedAt: 'string',
      addedBy: 'string'
    },
    {
      type: 'external',
      url: 'string',             // HTTPS URL
      description: 'string',
      contentType: 'string',
      addedAt: 'string',
      addedBy: 'string'
    }
  ] | null
}
```

### Extended Campaign Entity

```javascript
{
  // ... existing campaign fields

  // Asset Pool
  assetPool: {
    brandAssets: [
      {
        type: 'internal' | 'external',
        assetId: 'string' | null,
        url: 'string' | null,
        description: 'string',
        contentType: 'string',
        source: 'brand'
      }
    ],
    campaignAssets: [
      {
        type: 'internal' | 'external',
        assetId: 'string' | null,
        url: 'string' | null,
        description: 'string',
        contentType: 'string',
        source: 'campaign'
      }
    ]
  } | null
}
```

### Extended Social Post Entity

```javascript
{
  // ... existing post fields

  // Asset Assignment
  assignedAsset: {
    type: 'internal' | 'external',
    assetId: 'string' | null,
    url: 'string',
    description: 'string',
    contentType: 'string',
    source: 'brand' | 'campaign',
    assignedAt: 'string'
  } | null
}
```

### DynamoDB Access Patterns

**Brand Asset Queries**
```
# Get Brand with Assets
PK: {tenantId}#{brandId}
SK: 'brand'

# List Brands (existing GSI, now includes asset metadata)
GSI1PK: {tenantId}
GSI1SK: 'BRAND#{createdAt}'
```

## Correctness Properties

**Property 1: Brand-Asset Association Management**
*For any* brand update with asset associations, the system should accept both internal asset IDs and external asset definitions, validate internal asset existence and tenant ownership, validate external HTTPS URLs and metadata, store both types within the brand entity, include them in brand retrieval, and allow disassociation without deleting underlying assets
**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**

**Property 2: Campaign Asset Pool Construction**
*For any* campaign creation, the system should automatically include brand assets when a brand ID is provided, merge campaign-specific assets (both internal and external) with brand assets, ensure campaigns without brand IDs use only campaign assets, and ensure brand asset updates affect new campaigns but not existing ones
**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

**Property 3: Planning Context Completeness**
*For any* campaign planning operation, the system should provide asset descriptions to the planner and ensure all required context is available
**Validates: Requirements 3.1, 3.2, 3.3**

## Error Handling

### API Error Responses

**Validation Errors (400)**
```javascript
{
  statusCode: 400,
  body: JSON.stringify({
    message: 'Invalid brand asset association',
    details: {
      field: 'assets[0].assetId',
      issue: 'Referenced asset does not exist or does not belong to tenant'
    }
  })
}
```

**External Asset Validation Errors (400)**
```javascript
{
  statusCode: 400,
  body: JSON.stringify({
    message: 'Invalid external asset definition',
    details: {
      field: 'assets[1].url',
      issue: 'External asset URLs must use HTTPS protocol'
    }
  })
}
```

**Asset Not Found (404)**
```javascript
{
  statusCode: 404,
  body: JSON.stringify({
    message: 'Asset not found',
    assetId: 'asset_123'
  })
}
```

### Error Handling Strategy

- **Graceful Degradation**: If brand assets cannot be loaded, proceed with campaign-specific assets only
- **Clear User Feedback**: Provide actionable error messages explaining what went wrong and how to fix it
- **Validation Early**: Validate asset references and external URLs during brand/campaign creation, not during planning
- **Fallback Behavior**: If assets cannot be used, document the issue but allow campaign generation to proceed

## Testing Strategy

### Dual Testing Approach

The Brand Asset UX Integration system requires both unit testing and property-based testing to ensure comprehensive coverage and correctness validation.

#### Unit Testing Requirements

Unit tests will verify specific examples, integration points, and error conditions:

- **Brand-Asset Association**: Test brand creation/update with various asset configurations
- **Asset Validation**: Test internal asset existence checks and external URL validation
- **Asset Pool Construction**: Test merging of brand assets with campaign-specific assets

#### Property-Based Testing Requirements

Property-based tests will verify universal properties across all valid inputs using **fast-check** as the testing library. Each property-based test will run a minimum of 100 iterations to ensure comprehensive coverage.

Property-based tests must be tagged with comments explicitly referencing the correctness property:
- Format: `**Feature: brand-asset-ux-integration, Property {number}: {property_text}**`
- Each correctness property will be implemented by a single property-based test
- Tests will generate random brand configurations, asset associations, and campaign setups
- Generators will create realistic data within valid constraints (asset types, URLs)

#### Integration Testing

- **End-to-End Workflows**: Test complete flows from brand creation through campaign generation
- **Asset Pool Construction**: Verify correct merging of brand and campaign assets
- **Campaign Planner Integration**: Test that planner receives complete asset context

### Testing Infrastructure

- **Test Data Generation**: Create realistic brand and asset data generators for consistent testing
- **Mock Services**: Mock external asset URL validation for isolated unit testing
- **Asset Pool Verification**: Validate asset pool composition and metadata tagging

## Performance Considerations

### Data Access Optimization

#### Brand Asset Retrieval
- **Denormalization**: Store asset metadata within brand entities to avoid multiple lookups
- **Lazy Loading**: Load full asset details only when needed, not during brand listing
- **Caching**: Cache brand asset associations in campaign creation flow to reduce DynamoDB reads

#### Asset Pool Construction
- **Batch Operations**: Retrieve multiple assets in parallel when constructing campaign pools
- **Metadata Projection**: Include only necessary asset fields in campaign planning context
- **Early Validation**: Validate asset references during brand/campaign creation to fail fast

### Memory and Timeout Configuration

```yaml
# Brand service with asset associations
BrandServiceFunction:
  Timeout: 30
  MemorySize: 512

# Asset pool builder
AssetPoolBuilderFunction:
  Timeout: 15
  MemorySize: 256

# Enhanced campaign planner with asset selection
EnhancedCampaignPlannerFunction:
  Timeout: 300
  MemorySize: 2048
```

### Scalability Considerations

- **Asset Association Limits**: Recommend maximum 50 assets per brand to maintain performance
- **Batch Operations**: Support efficient bulk operations for asset management

## Security Considerations

### Data Protection

#### Asset Access Control
- **Tenant Isolation**: Validate tenant ownership for all asset references
- **Permission Validation**: Verify user permissions before allowing asset associations
- **Audit Logging**: Log all brand-asset association changes for compliance

### Content Security

#### External Asset Validation
- **HTTPS Enforcement**: Reject non-HTTPS external asset URLs
- **URL Accessibility**: Validate external URLs are accessible before accepting
- **Content Type Verification**: Validate declared content types match actual resources

## Deployment and Operations

### Infrastructure Changes

The Brand Asset UX Integration requires minimal infrastructure changes as it primarily extends existing components.

### Monitoring and Alerting

#### CloudWatch Metrics
- **Asset Association Operations**: Track brand-asset association success/failure rates
- **Asset Pool Construction**: Monitor asset pool construction time and size

#### Alerting Thresholds
- **Association Failures**: Alert when asset association failure rate exceeds 5%
- **Pool Construction Latency**: Alert when asset pool construction exceeds 2 seconds

### Migration Strategy

#### Existing Data Migration
- **Brand Entities**: Add empty assets array to existing brands
- **Campaign Entities**: Add assetPool structure to existing campaigns (optional)
- **Gradual Rollout**: Enable features incrementally to minimize disruption

#### Backward Compatibility
- **Optional Asset Associations**: Brands without asset associations continue to work
- **Existing Campaign Flow**: Campaigns without brand IDs continue to work as before
- **Graceful Degradation**: Missing asset metadata handled gracefully
