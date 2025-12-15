# Persona Management API

REST API for managing personas and writing examples in the Social Media Campaign Builder.

## Project Structure

```
src/
├── functions/              # Lambda function handlers (grouped by resource)
│   ├── auth/              # Authentication
│   │   └── authorizer.mjs # JWT token validation
│   ├── persona/           # Persona management
│   │   ├── create-persona.mjs
│   │   ├── get-persona.mjs
│   │   ├── update-persona.mjs
│   │   ├── delete-persona.mjs
│   │   └── list-personas.mjs
│   └── examples/          # Writing examples management
│       ├── create-example.mjs
│       ├── list-examples.mjs
│       └── delete-example.mjs
├── schemas/               # Zod schemas (validation + types)
│   └── persona.mjs       # Persona and WritingExample schemas
└── utils/                # Shared utilities
    └── api-response.mjs  # API response formatting
```

## API Endpoints

### Personas
- `POST /personas` - Create new persona
- `GET /personas/{personaId}` - Get persona by ID
- `PUT /personas/{personaId}` - Update persona
- `DELETE /personas/{personaId}` - Soft delete persona
- `GET /personas` - List/search personas

### Writing Examples
- `POST /personas/{personaId}/examples` - Add writing examples
- `GET /personas/{personaId}/examples` - Get writing examples
- `DELETE /personas/{personaId}/examples/{exampleId}` - Delete example

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
- `JWT_SECRET` - JWT secret for token validation

## DynamoDB Schema

### Primary Table: PersonaData
- **PK**: `{tenantId}#{personaId}`
- **SK**: `persona` | `example#{exampleId}`
- **GSI1PK**: `{tenantId}` | `{tenantId}#{personaId}`
- **GSI1SK**: `persona#{createdAt}` | `example#{createdAt}`
