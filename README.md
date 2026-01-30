# Social Media Campaign Builder API

REST API for managing personas, brands, campaigns, and assets in the Social Media Campaign Builder.

## Project Structure

```
functions/                 # Lambda function handlers (grouped by resource)
├── auth/                 # Authentication
│   └── authorizer.mjs   # JWT token validation
├── persona/             # Persona management
│   ├── create-persona.mjs
│   ├── get-persona.mjs
│   ├── update-persona.mjs
│   ├── delete-persona.mjs
│   ├── list-personas.mjs
│   ├── start-style-analysis.mjs
│   ├── examples/        # Writing examples
│   │   ├── create-example.mjs
│   │   ├── list-examples.mjs
│   │   └── delete-example.mjs
│   └── events/
│       └── style-analysis-complete.mjs
├── brand/               # Brand management
│   ├── create-brand.mjs
│   ├── get-brand.mjs
│   ├── update-brand.mjs
│   ├── delete-brand.mjs
│   ├── list-brands.mjs
│   └── assets/          # Brand assets
│       ├── upload-asset.mjs
│       ├── list-assets.mjs
│       └── delete-asset.mjs
├── campaign/            # Campaign management
│   ├── create-campaign.mjs
│   ├── get-campaign.mjs
│   ├── update-campaign.mjs
│   ├── delete-campaign.mjs
│   ├── list-campaigns.mjs
│   ├── list-posts.mjs
│   ├── update-status.mjs
│   ├── update-post-status.mjs
│   ├── build-campaign.mjs
│   └── events/
│       └── workflow-completion.mjs
├── assets/              # Asset management
│   ├── create-asset.mjs
│   ├── get-asset.mjs
│   ├── update-asset.mjs
│   ├── delete-asset.mjs
│   ├── list-assets.mjs
│   ├── approve-asset.mjs
│   └── upload-complete.mjs
└── agents/              # AI agent orchestration
    ├── campaign-planner.mjs
    ├── content-generator.mjs
    ├── persona-inference.mjs
    ├── schedule-blender.mjs
    └── tools.mjs

models/                  # Data models (DynamoDB operations)
├── persona.mjs
├── brand.mjs
├── campaign.mjs
├── asset.mjs
└── social-post.mjs

utils/                   # Shared utilities
├── logger.mjs          # Single logger instance
├── defaults.mjs        # Default configurations
├── asset-pool-builder.mjs
├── asset-resolver.mjs
├── asset-security.mjs
├── campaign-status.mjs
├── platform-constraints.mjs
└── style-inference.mjs
```

## API Endpoints

### Personas
- `POST /personas` - Create new persona
- `GET /personas/{personaId}` - Get persona by ID
- `PUT /personas/{personaId}` - Update persona
- `DELETE /personas/{personaId}` - Soft delete persona
- `GET /personas` - List/search personas
- `POST /personas/{personaId}/start-style-analysis` - Start AI style analysis
- `POST /personas/{personaId}/examples` - Add writing examples
- `GET /personas/{personaId}/examples` - Get writing examples
- `DELETE /personas/{personaId}/examples/{exampleId}` - Delete example

### Brands
- `POST /brands` - Create new brand
- `GET /brands/{brandId}` - Get brand by ID
- `PUT /brands/{brandId}` - Update brand
- `DELETE /brands/{brandId}` - Soft delete brand
- `GET /brands` - List/search brands
- `POST /brands/{brandId}/assets/upload` - Upload brand asset
- `GET /brands/{brandId}/assets` - List brand assets
- `DELETE /brands/{brandId}/assets/{assetId}` - Delete brand asset

### Campaigns
- `POST /campaigns` - Create new campaign
- `GET /campaigns/{campaignId}` - Get campaign by ID
- `PUT /campaigns/{campaignId}` - Update campaign
- `DELETE /campaigns/{campaignId}` - Delete campaign
- `GET /campaigns` - List/search campaigns
- `GET /campaigns/{campaignId}/posts` - List campaign posts
- `POST /campaigns/{campaignId}/build` - Build campaign content
- `PUT /campaigns/{campaignId}/status` - Update campaign status
- `PUT /campaigns/{campaignId}/posts/{postId}/status` - Update post status

### Assets
- `POST /assets` - Create new asset
- `GET /assets/{assetId}` - Get asset by ID
- `PUT /assets/{assetId}` - Update asset
- `DELETE /assets/{assetId}` - Delete asset
- `GET /assets` - List/search assets
- `POST /assets/{assetId}/approve` - Approve asset
- `POST /assets/{assetId}/upload-complete` - Mark upload complete

## Architecture

### Simplified Design Principles

The codebase follows these core principles:

1. **Direct over Indirect** - Use Zod schemas directly in handlers instead of wrapper functions
2. **Inline over Abstraction** - Inline simple operations instead of utility wrappers
3. **Single Responsibility** - Models handle data access, handlers handle business logic
4. **Self-Documenting** - Clear variable names eliminate need for comments

### Key Patterns

**Validation**: Zod schemas used directly in Lambda handlers
```javascript
const requestData = PersonaSchema
  .omit({ personaId: true, createdAt: true, updatedAt: true })
  .parse(JSON.parse(event.body));
```

**Error Handling**: Simple try-catch with inline responses
```javascript
try {
  // operation
} catch (error) {
  logger.error('Operation failed', { error: error.message });
  if (error instanceof z.ZodError) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Validation failed', errors: error.errors }) };
  }
  return { statusCode: 500, body: JSON.stringify({ message: 'Internal server error' }) };
}
```

**Response Formatting**: Inline response objects
```javascript
return {
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify(data)
};
```

**Logging**: Single logger instance with context
```javascript
import { logger } from '../utils/logger.mjs';
logger.error('Operation failed', { tenantId, error: error.message });
```

## Development

### Prerequisites
- Node.js 22+
- AWS SAM CLI
- AWS CLI configured

### Setup
```bash
npm install
```

### Local Development
```bash
sam build
sam local start-api
```

### Testing
```bash
npm test
```

For watch mode during development:
```bash
npm run test:watch
```

### Deployment
```bash
sam build
sam deploy --guided
```

## Environment Variables

- `TABLE_NAME` - DynamoDB table name
- `ASSETS_BUCKET` - S3 bucket for asset storage
- `LOG_LEVEL` - Logging level (default: ERROR)

## DynamoDB Schema

### Primary Table
- **PK**: `{tenantId}#{entityId}`
- **SK**: `{entityType}` | `{subEntityType}#{subEntityId}`
- **GSI1PK**: `{tenantId}`
- **GSI1SK**: `{ENTITY_TYPE}#{timestamp}`

### Entity Types
- Personas: `persona`, `example#{exampleId}`
- Brands: `brand`, `brand-asset#{assetId}`
- Campaigns: `campaign`, `post#{postId}`
- Assets: `asset`

## Testing

Run the full test suite:
```bash
npm test
```

Run tests in watch mode during development:
```bash
npm run test:watch
```

Run specific test file:
```bash
npm test tests/unit/persona-crud.test.mjs
```

## Documentation

- [Campaign API Documentation](docs/CAMPAIGN_API.md) - Detailed campaign API guide
- [Quick Start: Campaigns](docs/QUICK_START_CAMPAIGNS.md) - Getting started with campaigns
- [Testing Campaigns](docs/TESTING_CAMPAIGNS.md) - Campaign testing guide
