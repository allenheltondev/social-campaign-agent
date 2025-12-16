# Campaign API Testing Guide

## Manual Testing Workflow

### Prerequisites

1. Deploy the application: `sam build && sam deploy`
2. Get API Gateway URL from outputs
3. Create a test user in Cognito
4. Obtain JWT token for authentication
5. Create at least one test persona

### Test Scenario 1: Basic Campaign Creation

#### Step 1: Create a Test Persona

```bash
export API_URL="https://your-api-gateway-url/dev"
export TOKEN="your-jwt-token"

curl -X POST "$API_URL/personas" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "role": "Product Manager",
    "company": "TestCo",
    "primaryAudience": "professionals",
    "voiceTraits": ["professional", "friendly"],
    "writingHabits": {
      "paragraphs": "short",
      "questions": "occasional",
      "emojis": "sparing",
      "structure": "mixed"
    },
    "opinions": {
      "strongBeliefs": ["Clear communication is key"],
      "avoidsTopics": []
    },
    "language": {
      "avoid": [],
      "prefer": []
    },
    "ctaStyle": {
      "aggressiveness": "medium",
      "patterns": ["Check it out", "Learn more"]
    }
  }'
```

Save the returned persona ID.

#### Step 2: Create a Campaign

```bash
export PERSONA_ID="persona_01HQRS9TPXJ4K3M2N1"

curl -X POST "$API_URL/campaigns" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Launch our new analytics platform with focus on ease of use and powerful insights",
    "personaIds": ["'$PERSONA_ID'"],
    "platforms": ["twitter", "linkedin"],
    "duration": {
      "numberOfDays": 7
    }
  }'
```

Expected response:
```json
{
  "id": "campaign_01HQRS9TPXJ4K3M2N1P0Q9R8S7",
  "status": "planning",
  "message": "Campaign creation initiated"
}
```

#### Step 3: Monitor Campaign Status

Wait 30-60 seconds, then check campaign status:

```bash
export CAMPAIGN_ID="campaign_01HQRS9TPXJ4K3M2N1P0Q9R8S7"

curl "$API_URL/campaigns/$CAMPAIGN_ID" \
  -H "Authorization: Bearer $TOKEN"
```

Expected statuses:
- `planning` - Planner agent is working
- `generating` - Posts created, content being generated
- `completed` - All content generated

#### Step 4: View Generated Posts

```bash
curl "$API_URL/campaigns/$CAMPAIGN_ID/posts" \
  -H "Authorization: Bearer $TOKEN"
```

Expected response includes posts array with generated content.

### Test Scenario 2: Multi-Persona Campaign

```bash
# Create campaign with 2 personas
curl -X POST "$API_URL/campaigns" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Product launch with diverse perspectives",
    "personaIds": ["'$PERSONA_ID_1'", "'$PERSONA_ID_2'"],
    "platforms": ["twitter", "linkedin", "instagram"],
    "duration": {
      "startDate": "2024-02-01T00:00:00Z",
      "endDate": "2024-02-14T23:59:59Z"
    }
  }'
```

Verify:
- Multiple personas assigned to different posts
- Balanced distribution across personas
- Different voice characteristics in content

### Test Scenario 3: Brand-Aligned Campaign

```bash
# Create a brand first
curl -X POST "$API_URL/brands" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Brand",
    "ethos": "We believe in simplicity and transparency",
    "coreValues": ["Trust", "Innovation"],
    "primaryAudience": "professionals",
    "voiceGuidelines": {
      "tone": ["professional", "warm"],
      "vocabulary": {
        "preferred": ["simple", "clear"],
        "avoided": ["complex jargon"]
      }
    },
    "contentStandards": {
      "guidelines": ["Always be transparent", "Focus on customer value"]
    }
  }'

# Save brand ID, then create campaign with brandId
export BRAND_ID="brand_01HQRS9TPXJ4K3M2N1P0"

curl -X POST "$API_URL/campaigns" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Brand-aligned product announcement",
    "personaIds": ["'$PERSONA_ID'"],
    "platforms": ["linkedin"],
    "brandId": "'$BRAND_ID'",
    "duration": { "numberOfDays": 5 }
  }'
```

Verify:
- Generated content aligns with brand voice
- Brand values reflected in messaging
- Avoided vocabulary not used

## CloudWatch Logs Inspection

### View Planner Agent Logs

```bash
aws logs tail /aws/lambda/YourStack-CampaignPlannerFunction-XXX --follow
```

Look for:
- Campaign details retrieval
- Post creation events
- Plan summary calculation
- Success/error messages

### View Content Generator Logs

```bash
aws logs tail /aws/lambda/YourStack-ContentGeneratorFunction-XXX --follow
```

Look for:
- Post detail loading
- Persona retrieval
- Content generation
- Save operations
- Any error messages

## Validation Checklist

### Campaign Creation Response
- [ ] Returns 202 Accepted
- [ ] Includes campaign ID
- [ ] Status is "planning"

### Campaign Status Progression
- [ ] Transitions from "planning" to "generating"
- [ ] Eventually reaches "completed"
- [ ] planSummary populated after planning

### Generated Posts
- [ ] Correct number of posts based on duration
- [ ] Posts distributed across platforms
- [ ] Each post has scheduled date
- [ ] Content matches persona voice
- [ ] Platform-appropriate length and format
- [ ] Hashtags included where appropriate

### Error Handling
- [ ] Invalid persona ID returns 400
- [ ] Missing required fields returns 400
- [ ] Unauthorized requests return 401
- [ ] Failed planning sets campaign status to "failed"
- [ ] Failed content generation sets post status to "failed"

## Performance Testing

### Single Campaign Load Test

```bash
# Create 10 campaigns simultaneously
for i in {1..10}; do
  curl -X POST "$API_URL/campaigns" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "description": "Load test campaign '$i'",
      "personaIds": ["'$PERSONA_ID'"],
      "platforms": ["twitter"],
      "duration": { "numberOfDays": 3 }
    }' &
done
wait
```

Monitor:
- All campaigns created successfully
- No throttling errors
- EventBridge processing all events
- Lambda concurrency metrics

### Large Campaign Test

```bash
# Create campaign with longer duration (more posts)
curl -X POST "$API_URL/campaigns" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Large campaign test",
    "personaIds": ["'$PERSONA_ID'"],
    "platforms": ["twitter", "linkedin", "instagram"],
    "duration": { "numberOfDays": 30 }
  }'
```

Verify:
- Planner completes within timeout (300s)
- All posts created successfully
- Content generation completes for all posts
- No DynamoDB throttling

## Common Issues and Solutions

### Issue: Campaign Stuck in "planning"

**Diagnosis:**
```bash
# Check planner logs
aws logs tail /aws/lambda/YourStack-CampaignPlannerFunction-XXX --since 5m
```

**Common Causes:**
- Lambda timeout (increase to 300s)
- Bedrock API throttling
- Invalid persona IDs

### Issue: Posts Not Generating Content

**Diagnosis:**
```bash
# Check content generator logs
aws logs tail /aws/lambda/YourStack-ContentGeneratorFunction-XXX --since 5m

# Check EventBridge delivery
aws events list-rule-names-by-target \
  --target-arn $(aws lambda get-function --function-name ContentGeneratorFunction --query 'Configuration.FunctionArn' --output text)
```

**Common Causes:**
- EventBridge rule not triggering
- Persona missing inferred style
- Bedrock API errors

### Issue: Content Quality Problems

**Diagnosis:**
Review generated content quality:
- Does it match persona voice?
- Is it appropriate for platform?
- Does it follow brand guidelines?

**Solutions:**
- Add more writing examples to persona
- Run style analysis on persona
- Make campaign description more specific
- Review and update persona traits

## Automated Testing

### Unit Tests

```javascript
// Example: Test campaign schema validation
import { CreateCampaignRequestSchema } from './schemas/campaign.mjs';

describe('Campaign Schema', () => {
  it('validates correct campaign request', () => {
    const valid = {
      description: "Test campaign",
      personaIds: ["persona_123"],
      platforms: ["twitter"],
      duration: { numberOfDays: 7 }
    };
    expect(() => CreateCampaignRequestSchema.parse(valid)).not.toThrow();
  });

  it('rejects invalid platforms', () => {
    const invalid = {
      description: "Test",
      personaIds: ["persona_123"],
      platforms: ["invalid_platform"],
      duration: { numberOfDays: 7 }
    };
    expect(() => CreateCampaignRequestSchema.parse(invalid)).toThrow();
  });
});
```

### Integration Tests

```javascript
// Example: Test campaign creation flow
import { handler } from './functions/campaign/create-campaign.mjs';

describe('Create Campaign', () => {
  it('creates campaign and returns 202', async () => {
    const event = {
      requestContext: {
        authorizer: { tenantId: 'test-tenant' }
      },
      body: JSON.stringify({
        description: "Test campaign",
        personaIds: ["persona_123"],
        platforms: ["twitter"],
        duration: { numberOfDays: 7 }
      })
    };
    
    const response = await handler(event);
    expect(response.statusCode).toBe(202);
    expect(JSON.parse(response.body)).toHaveProperty('id');
  });
});
```

## Metrics to Monitor

### Application Metrics
- Campaign creation rate
- Average planning time
- Average content generation time per post
- Success rate (completed vs failed)

### AWS Metrics
- Lambda invocations
- Lambda errors
- Lambda duration
- EventBridge events published
- EventBridge failed invocations
- DynamoDB consumed capacity
- Bedrock API calls
- Bedrock throttling

### Business Metrics
- Posts generated per day
- Personas used per campaign
- Platforms per campaign
- Average campaign duration

## Success Criteria

A successful test should demonstrate:

✅ Campaign creation returns immediately (< 500ms)
✅ Planning completes within 90 seconds
✅ Content generation completes for all posts
✅ Generated content matches persona voice
✅ Platform-specific formatting applied
✅ Error handling gracefully manages failures
✅ Status tracking reflects actual progress
✅ Multiple concurrent campaigns process correctly
