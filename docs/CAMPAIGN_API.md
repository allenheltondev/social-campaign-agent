# Campaign API Documentation

## Overview

The Campaign API provides endpoints for creating and managing social media campaigns with automated content generation. When a campaign is created, an event-driven workflow orchestrates the planning and content generation process.

## Architecture

### Event-Driven Workflow

1. **Campaign Creation** → Triggers `Campaign Created` event
2. **Campaign Planner Agent** → Listens for campaign events, creates social post plan, emits `Social Post Created` events
3. **Content Generator Agent** → Listens for post events, generates content for each post

```
POST /campaigns
    ↓
[Campaign Created Event]
    ↓
Campaign Planner Agent
    ↓
[Social Post Created Events] (multiple)
    ↓
Content Generator Agent (parallel execution)
    ↓
Generated Content in Database
```

## Endpoints

### Create Campaign

Creates a new social media campaign and initiates the asynchronous content generation workflow.

**Endpoint:** `POST /campaigns`

**Request Body:**

```json
{
  "description": "Launch our new AI-powered analytics product with focus on enterprise use cases",
  "personaIds": [
    "persona_01HQRS9TPXJ4K3M2N1",
    "persona_01HQRS9TPXJ4K3M2N2"
  ],
  "platforms": ["twitter", "linkedin"],
  "brandId": "brand_01HQRS9TPXJ4K3M2N1P0",
  "duration": {
    "startDate": "2024-01-15T00:00:00Z",
    "endDate": "2024-02-15T00:00:00Z"
  }
}
```

**Alternative Duration Format:**

```json
{
  "duration": {
    "numberOfDays": 30
  }
}
```

**Response:** `202 Accepted`

```json
{
  "id": "campaign_01HQRS9TPXJ4K3M2N1P0Q9R8S7",
  "status": "planning",
  "message": "Campaign creation initiated"
}
```

### Get Campaign

Retrieves campaign details including status and plan summary.

**Endpoint:** `GET /campaigns/{campaignId}`

**Response:** `200 OK`

```json
{
  "id": "campaign_01HQRS9TPXJ4K3M2N1P0Q9R8S7",
  "description": "Launch our new AI-powered analytics product",
  "personaIds": ["persona_01HQRS9TPXJ4K3M2N1"],
  "platforms": ["twitter", "linkedin"],
  "brandId": "brand_01HQRS9TPXJ4K3M2N1P0",
  "duration": {
    "startDate": "2024-01-15T00:00:00Z",
    "endDate": "2024-02-15T00:00:00Z"
  },
  "status": "generating",
  "planSummary": {
    "totalPosts": 42,
    "postsPerPlatform": {
      "twitter": 21,
      "linkedin": 21
    },
    "postsPerPersona": {
      "persona_01HQRS9TPXJ4K3M2N1": 21,
      "persona_01HQRS9TPXJ4K3M2N2": 21
    }
  },
  "createdAt": "2024-01-10T10:00:00Z",
  "updatedAt": "2024-01-10T10:05:00Z",
  "version": 2
}
```

### List Campaign Posts

Retrieves all social media posts for a campaign.

**Endpoint:** `GET /campaigns/{campaignId}/posts`

**Response:** `200 OK`

```json
{
  "posts": [
    {
      "id": "post_01HQRS9TPXJ4K3M2N1P0Q9R8S7",
      "campaignId": "campaign_01HQRS9TPXJ4K3M2N1P0Q9R8S7",
      "personaId": "persona_01HQRS9TPXJ4K3M2N1",
      "platform": "twitter",
      "scheduledDate": "2024-01-15T10:00:00Z",
      "topic": "Introducing AI-powered analytics for enterprise teams",
      "assetRequirements": {
        "imageRequired": true,
        "imageDescription": "Product dashboard showing analytics in action"
      },
      "content": {
        "text": "Just launched our AI analytics platform! 🚀 Transform your data into actionable insights in seconds. Enterprise teams are already seeing 10x faster decision-making.",
        "hashtags": ["#AIAnalytics", "#EnterpriseAI", "#DataScience"],
        "mentions": ["@CompanyHandle"],
        "generatedAt": "2024-01-10T10:10:00Z"
      },
      "status": "completed",
      "createdAt": "2024-01-10T10:05:00Z",
      "updatedAt": "2024-01-10T10:10:00Z",
      "version": 2
    }
  ],
  "count": 1
}
```

## Campaign Status Lifecycle

1. **planning** - Campaign created, planner agent is generating the post schedule
2. **generating** - Post schedule created, content generator agents are creating content
3. **completed** - All posts have been generated successfully
4. **failed** - An error occurred during planning or generation

## Post Status Lifecycle

1. **planned** - Post created by planner, waiting for content generation
2. **generating** - Content generator agent is creating the post content
3. **completed** - Content generated and saved
4. **failed** - Content generation failed

## Data Model

### Campaign Entity

Stored in DynamoDB with the following structure:

- **pk:** `{tenantId}#{campaignId}`
- **sk:** `campaign`
- **GSI1PK:** `{tenantId}`
- **GSI1SK:** `campaign#{createdAt}`

### Social Post Entity

Stored in DynamoDB with the following structure:

- **pk:** `{tenantId}#{campaignId}#{postId}`
- **sk:** `post`
- **GSI1PK:** `{tenantId}#{campaignId}`
- **GSI1SK:** `post#{scheduledDate}`

## Agent Implementations

### Campaign Planner Agent

**Location:** `functions/agents/campaign-planner.mjs`

**Responsibilities:**
- Retrieves campaign details
- Creates a balanced distribution of posts across personas, platforms, and dates
- Determines topics for each post based on campaign description
- Identifies asset requirements (images/videos) for each post
- Saves posts to DynamoDB
- Emits `Social Post Created` events for each post
- Updates campaign status and plan summary

**Tools:**
- `get_campaign_details` - Load campaign configuration
- `create_social_posts` - Batch create posts in DynamoDB
- `update_campaign_status` - Update campaign with plan summary

### Content Generator Agent

**Location:** `functions/agents/content-generator.mjs`

**Responsibilities:**
- Retrieves post requirements (topic, platform, scheduled date)
- Loads persona voice characteristics and style
- Loads brand guidelines (if applicable)
- Generates authentic, platform-specific content
- Matches persona voice traits exactly
- Respects persona guardrails
- Adheres to brand guidelines
- Saves generated content to the post

**Tools:**
- `get_post_details` - Load post requirements
- `get_campaign_details` - Load campaign context
- `get_persona_details` - Load persona voice and style
- `get_brand_details` - Load brand guidelines (optional)
- `save_generated_content` - Save generated content to post

## Platform-Specific Guidelines

### Twitter
- Max 280 characters
- Punchy, conversational tone
- Hashtags at end (2-3 max)
- Emoji usage based on persona

### LinkedIn
- Longer-form content (up to 3000 chars)
- Professional, thought leadership
- Minimal hashtags (1-2)
- Focus on insights and value

### Instagram
- Visual-first captions
- Emoji-friendly
- 3-5 hashtags integrated naturally
- Engaging, authentic voice

### Facebook
- Community-focused
- Medium length
- Engaging questions
- 1-2 hashtags

## Error Handling

All agents implement robust error handling:

1. **Planning Failures:** Campaign status set to `failed`
2. **Content Generation Failures:** Individual post status set to `failed`
3. **Partial Failures:** Campaign can have some posts completed and others failed
4. **Retry Logic:** EventBridge provides automatic retries with exponential backoff

## Monitoring

Monitor campaign progress by:

1. Checking campaign status via `GET /campaigns/{campaignId}`
2. Viewing individual post statuses via `GET /campaigns/{campaignId}/posts`
3. CloudWatch Logs for agent execution details
4. EventBridge metrics for event processing

## Best Practices

1. **Persona Selection:** Choose personas with complementary voices for variety
2. **Duration Planning:** Allow 3-7 posts per week per platform
3. **Platform Mix:** Combine professional (LinkedIn) with casual (Twitter/Instagram)
4. **Brand Alignment:** Always provide brandId for consistent brand voice
5. **Content Review:** Review generated content before scheduling actual publication
6. **Asset Planning:** Note asset requirements and prepare visuals accordingly

## Example Use Cases

### Product Launch Campaign

```json
{
  "description": "Launch our new mobile app with focus on ease of use and innovative features",
  "personaIds": ["founder", "product_manager", "developer_advocate"],
  "platforms": ["twitter", "linkedin", "instagram"],
  "duration": { "numberOfDays": 14 }
}
```

### Thought Leadership Campaign

```json
{
  "description": "Establish thought leadership on AI ethics and responsible AI development",
  "personaIds": ["cto", "ml_researcher"],
  "platforms": ["linkedin", "twitter"],
  "duration": {
    "startDate": "2024-02-01T00:00:00Z",
    "endDate": "2024-03-01T00:00:00Z"
  }
}
```

### Brand Awareness Campaign

```json
{
  "description": "Increase brand awareness with behind-the-scenes content and company culture highlights",
  "personaIds": ["ceo", "hr_manager", "designer"],
  "platforms": ["instagram", "facebook", "linkedin"],
  "brandId": "brand_abc123",
  "duration": { "numberOfDays": 30 }
}
```
