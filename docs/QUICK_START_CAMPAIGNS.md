# Quick Start: Campaign API

## Creating Your First Campaign

### Prerequisites

1. Authentication token with valid tenantId
2. At least one persona created in the system
3. (Optional) Brand created for brand-aligned content

### Step 1: Create Personas

First, ensure you have personas in the system:

```bash
# Create a persona
POST /personas
{
  "name": "Sarah Chen",
  "role": "VP of Product",
  "company": "TechCorp",
  "primaryAudience": "professionals",
  "voiceTraits": ["professional", "data-driven", "optimistic"],
  "writingHabits": {
    "paragraphs": "short",
    "questions": "occasional",
    "emojis": "sparing",
    "structure": "mixed"
  },
  "opinions": {
    "strongBeliefs": ["AI should be accessible to all teams"],
    "avoidsTopics": ["politics", "controversial social issues"]
  },
  "language": {
    "avoid": ["utilize", "synergy", "paradigm"],
    "prefer": ["use", "collaboration", "approach"]
  },
  "ctaStyle": {
    "aggressiveness": "medium",
    "patterns": ["Learn more", "Check it out", "Explore"]
  }
}
```

### Step 2: Create a Campaign

```bash
POST /campaigns
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "description": "Launch campaign for our new AI analytics platform targeting enterprise customers. Focus on ease of use, powerful insights, and ROI.",
  "personaIds": [
    "persona_01HQRS9TPXJ4K3M2N1"
  ],
  "platforms": ["twitter", "linkedin"],
  "duration": {
    "numberOfDays": 14
  }
}
```

**Response:**
```json
{
  "id": "campaign_01HQRS9TPXJ4K3M2N1P0Q9R8S7",
  "status": "planning",
  "message": "Campaign creation initiated"
}
```

### Step 3: Monitor Campaign Progress

The campaign creation is asynchronous. Monitor progress:

```bash
GET /campaigns/campaign_01HQRS9TPXJ4K3M2N1P0Q9R8S7
Authorization: Bearer <your-token>
```

**Status Progression:**
- `planning` → Planner agent is creating the post schedule
- `generating` → Content generator agents are creating post content
- `completed` → All content generated
- `failed` → Something went wrong

### Step 4: View Generated Posts

Once status is `generating` or `completed`:

```bash
GET /campaigns/campaign_01HQRS9TPXJ4K3M2N1P0Q9R8S7/posts
Authorization: Bearer <your-token>
```

**Response includes all posts with generated content:**

```json
{
  "posts": [
    {
      "id": "post_01HQRS9TPXJ4K3M2N1P0Q9R8S7",
      "campaignId": "campaign_01HQRS9TPXJ4K3M2N1P0Q9R8S7",
      "personaId": "persona_01HQRS9TPXJ4K3M2N1",
      "platform": "twitter",
      "scheduledDate": "2024-01-15T10:00:00Z",
      "topic": "Introducing AI analytics platform",
      "content": {
        "text": "Data teams: tired of spending hours on analysis? Our new AI platform delivers insights in seconds. Early customers are seeing 10x faster decision-making. ⚡",
        "hashtags": ["#AIAnalytics", "#DataScience"],
        "generatedAt": "2024-01-10T10:15:00Z"
      },
      "status": "completed"
    }
  ],
  "count": 28
}
```

## Example Campaigns

### Product Launch (Multi-Platform)

```json
{
  "description": "Launch our mobile app highlighting ease of use, innovative features, and customer testimonials",
  "personaIds": ["ceo_persona", "product_manager_persona"],
  "platforms": ["twitter", "linkedin", "instagram"],
  "duration": {
    "startDate": "2024-02-01T00:00:00Z",
    "endDate": "2024-02-14T23:59:59Z"
  }
}
```

### Thought Leadership Campaign

```json
{
  "description": "Establish thought leadership on responsible AI development and ethics",
  "personaIds": ["cto_persona", "researcher_persona"],
  "platforms": ["linkedin"],
  "brandId": "brand_01HQRS9TPXJ4K3M2N1P0",
  "duration": {
    "numberOfDays": 30
  }
}
```

### Event Promotion

```json
{
  "description": "Promote our upcoming webinar on AI in healthcare with speaker highlights and key topics",
  "personaIds": ["marketing_director_persona"],
  "platforms": ["twitter", "linkedin", "facebook"],
  "duration": {
    "numberOfDays": 7
  }
}
```

## Campaign Planning Best Practices

### Duration Guidelines

- **Product Launch**: 14-30 days
- **Event Promotion**: 7-14 days leading up to event
- **Thought Leadership**: 30-60 days for sustained engagement
- **Brand Awareness**: 30-90 days

### Post Frequency

The planner agent automatically determines frequency based on:
- Number of platforms (more platforms = more posts)
- Duration length
- Number of personas
- Platform best practices

**Typical distribution:**
- Twitter: 1-2 posts per day
- LinkedIn: 3-5 posts per week
- Instagram: 4-7 posts per week
- Facebook: 3-5 posts per week

### Persona Selection

**Single Persona**: Consistent voice, cohesive narrative
```json
{
  "personaIds": ["ceo_persona"]
}
```

**Multiple Personas**: Diverse perspectives, broader reach
```json
{
  "personaIds": ["ceo_persona", "engineer_persona", "customer_success_persona"]
}
```

**Best Practice**: Use 1-3 personas per campaign for authenticity

### Platform Selection

**Professional Focus**: LinkedIn + Twitter
```json
{
  "platforms": ["linkedin", "twitter"]
}
```

**Visual Focus**: Instagram + Facebook
```json
{
  "platforms": ["instagram", "facebook"]
}
```

**Maximum Reach**: All platforms
```json
{
  "platforms": ["twitter", "linkedin", "instagram", "facebook"]
}
```

## Troubleshooting

### Campaign Stuck in "planning"

1. Check CloudWatch Logs for CampaignPlannerFunction
2. Verify personas exist and are active
3. Ensure duration is valid
4. Check EventBridge delivery

### Posts Stuck in "generating"

1. Check CloudWatch Logs for ContentGeneratorFunction
2. Verify persona has sufficient style information
3. Check Bedrock API permissions
4. Review individual post error logs

### Content Quality Issues

1. **Not matching persona voice**: Add more writing examples to persona
2. **Generic content**: Make campaign description more specific
3. **Missing hashtags**: Platform-specific, check agent logs
4. **Brand misalignment**: Ensure brand guidelines are comprehensive

## API Rate Limits

- Campaign creation: No specific limit (async processing)
- Campaign retrieval: Standard API Gateway limits
- Post listing: Standard API Gateway limits

## Cost Considerations

Each campaign incurs costs for:
- **Lambda execution**: Planner agent + content generator agents per post
- **Bedrock API calls**: Multiple calls per campaign (planning + content generation)
- **DynamoDB operations**: Write operations for campaign and posts
- **EventBridge events**: One per campaign + one per post

**Example cost for 30-post campaign**:
- Planner: 1 invocation (~60s)
- Content Generator: 30 invocations (~30s each)
- Bedrock: ~31 API calls
- DynamoDB: ~35 write operations
- EventBridge: 31 events

## Next Steps

1. **Review generated content** before publishing
2. **Create visual assets** based on assetRequirements
3. **Schedule posts** using your social media management tool
4. **Track performance** and iterate on future campaigns
5. **Update personas** based on what content performs best

## Support

For issues or questions:
1. Check CloudWatch Logs for detailed error messages
2. Review campaign and post status fields
3. Consult API documentation: `docs/CAMPAIGN_API.md`
4. Review existing personas and their writing examples
