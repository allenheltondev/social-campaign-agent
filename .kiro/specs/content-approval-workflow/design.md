# Design Document: Content Approval Workflow

## Overview

The Content Approval Workflow extends the existing campaign system with comprehensive review and approval capabilities. The design supports campaign-level and post-level approvals, manual content editing, AI regeneration with feedback, approval history tracking, and notification webhooks. The system integrates with the existing EventBridge-based architecture for async processing.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway                              │
└────────┬────────────────────────────────────────────────────┘
         │
         ├─→ POST /campaigns/{id}/decisions (resumes durable execution)
         ├─→ POST /campaigns/{id}/posts/{postId}/decisions
         ├─→ PUT  /campaigns/{id}/posts/{postId}/content
         ├─→ POST /campaigns/{id}/posts/{postId}/regenerate
         ├─→ POST /campaigns/{id}/posts/decisions
         ├─→ GET  /campaigns/{id}/decisions
         └─→ GET  /campaigns/{id}/posts/{postId}/versions
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Lambda Functions                            │
├─────────────────────────────────────────────────────────────┤
│  • CampaignDecisionFunction (Step Functions callback)        │
│  • PostDecisionFunction                                      │
│  • EditPostContentFunction                                   │
│  • RegeneratePostFunction                                    │
│  • BulkPostDecisionsFunction                                 │
│  • GetDecisionHistoryFunction                                │
│  • GetPostVersionsFunction                                   │
│  • CheckApprovalDeadlinesFunction (scheduled)                │
└────────┬────────────────────────────────────────────────────┘
         │
         ├─→ DynamoDB (approval records, version history)
         ├─→ Step Functions (callback token for durable execution)
         ├─→ EventBridge (approval events, regeneration triggers)
         └─→ Bedrock (AI regeneration with feedback)
```

### Durable Execution Flow

```
BuildCampaignFunction (Durable)
  │
  ├─→ Generate campaign plan
  ├─→ Generate post content
  ├─→ Update status to "awaiting_review"
  ├─→ Store callbackId in campaign
  │
  └─→ waitForCallback() ──┐
                          │ (paused, waiting for user decision)
                          │
User Decision ───────────→│
  │                       │
  └─→ POST /campaigns/{id}/decisions
      │
      └─→ CampaignDecisionFunction
          │
          ├─→ Retrieve callbackId from campaign
          ├─→ Send decision to Step Functions
          └─→ Resume durable execution ──→ Complete campaign
```

### Event Flow

```
Approval Decision → EventBridge Event → Notification Handler (external)
                                     → Campaign Status Update
                                     → Metrics Collection

Regeneration Request → EventBridge Event → Content Generator Agent
                                        → Version History Update
```

## Data Models

### ApprovalRecord Schema

```javascript
{
  id: string,                    // ULID
  tenantId: string,
  entityType: 'campaign' | 'post',
  entityId: string,              // campaignId or postId
  campaignId: string,            // for posts
  decision: 'approved' | 'rejected' | 'needs_revision',
  reviewerId: string,            // from JWT token
  reviewerName: string,
  comments: string | null,       // optional rich text
  feedback: {                    // for needs_revision
    changes: string[],
    priority: 'low' | 'medium' | 'high'
  } | null,
  metadata: {
    ipAddress: string,
    userAgent: string,
    source: 'web' | 'api' | 'mobile'
  },
  createdAt: ISO8601,
  expiresAt: ISO8601 | null      // TTL for cleanup
}
```

### PostVersion Schema

```javascript
{
  id: string,                    // ULID
  tenantId: string,
  campaignId: string,
  postId: string,
  versionNumber: number,         // 1, 2, 3...
  content: {
    text: string,
    hashtags: string[],
    mentions: string[]
  },
  source: 'ai_generated' | 'manually_edited' | 'ai_regenerated',
  generationMetadata: {
    modelId: string,
    feedback: string | null,     // for regenerations
    temperature: number,
    tokensUsed: number
  } | null,
  editMetadata: {
    editorId: string,
    editorName: string,
    changesDescription: string
  } | null,
  createdAt: ISO8601,
  expiresAt: ISO8601             // TTL for old versions
}
```

### Updated Campaign Schema

```javascript
// Add to existing Campaign model
{
  ...existingFields,
  approval: {
    status: 'pending' | 'awaiting_review' | 'approved' | 'rejected' | 'needs_revision' | 'approval_timeout',
    deadline: ISO8601 | null,
    deadlineExtensions: number,
    submittedAt: ISO8601 | null,
    reviewedAt: ISO8601 | null,
    reviewerId: string | null,
    approvedPostCount: number,
    totalPostCount: number
  } | null
}
```

### Updated SocialPost Schema

```javascript
// Add to existing SocialPost model
{
  ...existingFields,
  approval: {
    status: 'pending' | 'needs_review' | 'approved' | 'rejected' | 'manually_edited',
    reviewedAt: ISO8601 | null,
    reviewerId: string | null,
    comments: string | null
  } | null,
  versions: {
    current: number,             // current version number
    total: number,               // total versions
    regenerationCount: number,   // AI regeneration attempts
    maxRegenerations: number     // limit (default: 3)
  }
}
```

## API Endpoints

### Campaign Decision Endpoint

#### POST /campaigns/{campaignId}/decisions
Make an approval decision for an entire campaign and resume the durable execution workflow.

**Request:**
```json
{
  "decision": "approved",
  "comments": "Looks great! Ready to publish.",
  "approveAllPosts": true
}
```

**Response:** 200 OK
```json
{
  "campaignId": "campaign_123",
  "decision": "approved",
  "status": "approved",
  "decidedAt": "2024-01-20T10:30:00Z",
  "approvedPostCount": 15,
  "totalPostCount": 15
}
```

**Implementation Notes:**
- Retrieves the campaign's `callbackId` from DynamoDB
- Uses Step Functions SDK to send task success/failure back to the durable execution
- The durable execution workflow in `build-campaign.mjs` resumes with the decision
- If no `callbackId` exists, the campaign is not in a waiting state (returns 409 Conflict)

**Request (Rejection):**
```json
{
  "decision": "rejected",
  "reason": "Content doesn't align with brand voice",
  "comments": "Please review brand guidelines and regenerate"
}
```

**Request (Revision):**
```json
{
  "decision": "needs_revision",
  "feedback": {
    "changes": [
      "Make tone more professional",
      "Add more data-driven examples",
      "Reduce emoji usage"
    ],
    "priority": "high"
  },
  "comments": "Good start but needs refinement"
}
```

**Response:** 202 Accepted (for needs_revision)

### Post Decision Endpoint

#### POST /campaigns/{campaignId}/posts/{postId}/decisions
Make an approval decision for an individual post.

**Request (Approval):**
```json
{
  "decision": "approved",
  "comments": "Perfect for LinkedIn audience"
}
```

**Response:** 200 OK
```json
{
  "postId": "post_456",
  "decision": "approved",
  "status": "approved",
  "decidedAt": "2024-01-20T10:30:00Z"
}
```

**Request (Rejection):**
```json
{
  "decision": "rejected",
  "reason": "Tone doesn't match persona",
  "comments": "Too casual for this executive persona"
}
```

**Response:** 200 OK

### Post Content Editing

#### PUT /campaigns/{campaignId}/posts/{postId}/content
Manually edit post content.

**Request:**
```json
{
  "content": {
    "text": "Edited post content...",
    "hashtags": ["#AI", "#Innovation"],
    "mentions": ["@company"]
  },
  "changesDescription": "Refined opening paragraph and added CTA"
}
```

**Response:** 200 OK
```json
{
  "postId": "post_456",
  "versionNumber": 2,
  "source": "manually_edited",
  "previousVersion": 1
}
```

### Post Regeneration

#### POST /campaigns/{campaignId}/posts/{postId}/regenerate
Request AI regeneration with feedback.

**Request:**
```json
{
  "feedback": "Make it more engaging and add a question at the end",
  "preserveHashtags": true
}
```

**Response:** 202 Accepted
```json
{
  "postId": "post_456",
  "status": "generating",
  "regenerationNumber": 2
}
```

### Bulk Post Decisions

#### POST /campaigns/{campaignId}/posts/decisions
Make decisions for multiple posts at once (bulk operation).

**Request:**
```json
{
  "decisions": [
    {
      "postId": "post_1",
      "decision": "approved",
      "comments": "Great content"
    },
    {
      "postId": "post_2",
      "decision": "approved"
    },
    {
      "postId": "post_3",
      "decision": "rejected",
      "reason": "Off-brand tone"
    }
  ]
}
```

**Response:** 200 OK
```json
{
  "successCount": 3,
  "failureCount": 0,
  "results": [
    { "postId": "post_1", "decision": "approved", "status": "success" },
    { "postId": "post_2", "decision": "approved", "status": "success" },
    { "postId": "post_3", "decision": "rejected", "status": "success" }
  ]
}
```

### Decision History

#### GET /campaigns/{campaignId}/decisions
Get complete decision history for a campaign.

**Response:** 200 OK
```json
{
  "campaignId": "campaign_123",
  "decisions": [
    {
      "id": "decision_789",
      "entityType": "campaign",
      "decision": "needs_revision",
      "reviewerId": "user_123",
      "reviewerName": "Jane Smith",
      "comments": "Good start, needs refinement",
      "createdAt": "2024-01-20T09:00:00Z"
    },
    {
      "id": "decision_790",
      "entityType": "post",
      "entityId": "post_456",
      "decision": "approved",
      "reviewerId": "user_123",
      "createdAt": "2024-01-20T10:30:00Z"
    }
  ]
}
```

### Post Version History

#### GET /campaigns/{campaignId}/posts/{postId}/versions
Get version history for a post.

**Response:** 200 OK
```json
{
  "postId": "post_456",
  "currentVersion": 3,
  "versions": [
    {
      "versionNumber": 1,
      "source": "ai_generated",
      "content": { "text": "Original AI content..." },
      "createdAt": "2024-01-20T08:00:00Z"
    },
    {
      "versionNumber": 2,
      "source": "ai_regenerated",
      "content": { "text": "Regenerated with feedback..." },
      "generationMetadata": {
        "feedback": "Make more engaging"
      },
      "createdAt": "2024-01-20T09:30:00Z"
    },
    {
      "versionNumber": 3,
      "source": "manually_edited",
      "content": { "text": "Manually refined content..." },
      "editMetadata": {
        "editorId": "user_123",
        "changesDescription": "Added CTA"
      },
      "createdAt": "2024-01-20T10:00:00Z"
    }
  ]
}
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Campaign Status Transitions
*For any* campaign that completes AI generation, the system should automatically transition to "awaiting_review" status.
**Validates: Requirements 1.1**

### Property 2: Regeneration Blocking
*For any* campaign in "awaiting_review" status, attempts to trigger AI regeneration should be rejected until review is complete.
**Validates: Requirements 1.2**

### Property 3: Approval Status Update
*For any* campaign, when a reviewer approves it, the status should transition to "approved" and the approval timestamp should be recorded.
**Validates: Requirements 1.3**

### Property 4: Rejection with Reason
*For any* campaign, when a reviewer rejects it, the status should transition to "rejected" and the rejection reason should be stored in the approval record.
**Validates: Requirements 1.4**

### Property 5: Revision Enables Regeneration
*For any* campaign, when a reviewer requests revision, the status should transition to "needs_revision" and AI regeneration should become available.
**Validates: Requirements 1.5**

### Property 6: Decision Event Emission
*For any* decision (approved, rejected, needs_revision), the system should emit a corresponding event to EventBridge.
**Validates: Requirements 1.6, 6.1, 6.2, 6.3**

### Property 7: Post Review Actions Availability
*For any* post with status "completed", the system should allow approve, reject, and edit operations.
**Validates: Requirements 2.1**

### Property 8: Post Approval Metadata
*For any* post, when approved, the system should transition status to "approved" and record reviewer ID, timestamp, and optional comments.
**Validates: Requirements 2.2**

### Property 9: Post Rejection Recording
*For any* post, when rejected, the system should transition status to "rejected" and store the rejection reason in the approval record.
**Validates: Requirements 2.3**

### Property 10: Manual Edit Preservation
*For any* post that is manually edited, the system should save the new content, mark status as "manually_edited", and preserve the original version in version history.
**Validates: Requirements 2.4, 2.5**

### Property 11: Content Validation
*For any* manually edited post content, the system should validate against platform constraints (character limits, format rules) and reject invalid content.
**Validates: Requirements 2.6**

### Property 12: Decision History Recording
*For any* decision, the system should create an approval record containing reviewer identity, timestamp, decision, and comments.
**Validates: Requirements 3.1**

### Property 13: Revision Feedback Storage
*For any* revision request, the system should store the structured feedback with the post for use in regeneration.
**Validates: Requirements 3.2, 5.2**

### Property 14: Version History Preservation
*For any* post that undergoes regeneration or editing, the system should maintain all previous versions in queryable version history.
**Validates: Requirements 3.3, 5.4**

### Property 15: Decision History Queryability
*For any* campaign, the system should provide queryable decision history including all decisions for the campaign and its posts.
**Validates: Requirements 3.4**

### Property 16: Bulk Decision Processing
*For any* set of post decisions submitted in bulk, the system should process each decision and return success/failure status for each.
**Validates: Requirements 4.1, 4.3**

### Property 17: Bulk Decision Validation
*For any* bulk decision request, the system should validate that all posts exist and are in valid states before processing.
**Validates: Requirements 4.2**

### Property 18: Partial Bulk Success
*For any* bulk decision operation where some posts fail validation, the system should process valid decisions and report failures without rolling back successful decisions.
**Validates: Requirements 4.4**

### Property 19: Bulk Decision Metadata
*For any* post decision made in a bulk operation, the system should record individual decision metadata including reviewer and timestamp.
**Validates: Requirements 4.5**

### Property 20: Regeneration Feedback Inclusion
*For any* post regeneration request, the system should include the reviewer feedback in the AI generation prompt.
**Validates: Requirements 5.3**

### Property 21: Regeneration Counter Tracking
*For any* post, the system should track the regeneration iteration count and increment it with each regeneration.
**Validates: Requirements 5.5**

### Property 22: Regeneration Limit Enforcement
*For any* post that has reached maximum regeneration attempts, the system should reject further regeneration requests.
**Validates: Requirements 5.6**

### Property 23: Campaign Approval Aggregation
*For any* campaign, when all posts are approved, the system should automatically update the campaign status to "approved".
**Validates: Requirements 6.4**

### Property 24: Notification Event Emission
*For any* campaign ready for review event, the system should emit a "Notification" EventBridge event with the proper payload structure.
**Validates: Requirements 6.5**

### Property 25: Deadline Acceptance
*For any* campaign approval submission, the system should accept and store an optional deadline timestamp.
**Validates: Requirements 7.1**

### Property 26: Deadline Timeout
*For any* campaign with a deadline in the past and status still "awaiting_review", the system should transition status to "approval_timeout".
**Validates: Requirements 7.2**

### Property 27: Deadline Warning Events
*For any* campaign with a deadline approaching within 24 hours, the system should emit warning events.
**Validates: Requirements 7.3**

### Property 28: Comment Storage
*For any* decision with comments, the system should store the comments with the approval record and make them retrievable.
**Validates: Requirements 8.1, 8.2, 8.4**

### Property 29: Comment History Preservation
*For any* post with multiple decision iterations, the system should preserve all comments from previous iterations in the decision history.
**Validates: Requirements 8.5**

## Error Handling

### Validation Errors
- Invalid post status for decision operations → 400 Bad Request
- Exceeded maximum regeneration attempts → 429 Too Many Requests
- Content exceeds platform character limits → 400 Bad Request
- Missing required fields in decision request → 400 Bad Request
- Invalid decision value → 400 Bad Request

### Authorization Errors
- Unauthorized reviewer → 401 Unauthorized
- Tenant isolation violation → 403 Forbidden

### State Errors
- Campaign not found → 404 Not Found
- Post not found → 404 Not Found
- Invalid state transition → 409 Conflict

### System Errors
- DynamoDB write failure → 500 Internal Server Error
- EventBridge publish failure → 500 Internal Server Error
- AI regeneration failure → 500 Internal Server Error

## Testing Strategy

### Unit Tests
- Approval record creation and validation
- Version history management
- Status transition logic
- Platform constraint validation
- Bulk operation processing
- Deadline calculation and timeout detection
- Decision validation (approved, rejected, needs_revision)

### Property-Based Tests
Each correctness property will be implemented as a property-based test with minimum 100 iterations. Tests will use random generation of:
- Campaign states and statuses
- Post content and metadata
- Decision types and feedback
- Reviewer identities
- Timestamps and deadlines

### Integration Tests
- End-to-end decision workflows
- EventBridge event delivery
- Webhook notification delivery
- AI regeneration with feedback
- Version history retrieval

## Performance Considerations

### Database Access Patterns
- Decision history: Query by campaignId using GSI
- Version history: Query by postId using GSI
- Bulk operations: BatchWriteItem for parallel processing
- TTL: Automatic cleanup of old approval records and versions

### Caching Strategy
- Cache campaign approval status in memory during bulk operations
- Cache platform constraints for content validation
- No caching of decisions (always fresh data)

### Scalability
- Bulk decision operations process up to 25 posts per batch
- Version history limited to last 10 versions per post
- Approval records expire after 90 days (configurable TTL)
- EventBridge handles async notification delivery at scale
