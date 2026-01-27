# Campaign Schedule Blending - Implementation Tasks

## Task List

- [ ] 1. Add blendSchedule parameter to campaign creation
  - [x] 1.1 Update CreateCampaignRequestSchema with blendSchedule field
  - [x] 1.2 Pass blendSchedule to build-campaign function
  - [x] 1.3 Update API documentation

- [ ] 2. Create schedule blending agent
  - [x] 2.1 Create functions/agents/schedule-blender.mjs with agent setup
  - [x] 2.2 Implement fetchAllActivePosts helper function
  - [x] 2.3 Implement buildConstraints helper function
  - [x] 2.4 Implement buildSchedulePrompt helper function
  - [x] 2.5 Create update_schedules tool definition
  - [x] 2.6 Implement run function with agent invocation

- [ ] 3. Add batch update capability to SocialPost model
  - [x] 3.1 Implement SocialPost.batchUpdateSchedules method
  - [x] 3.2 Add error handling for partial failures
  - [x] 3.3 Add logging for update operations

- [ ] 4. Integrate schedule blending into build-campaign workflow
  - [x] 4.1 Add schedule blending step after content generation
  - [x] 4.2 Add conditional logic for blendSchedule flag
  - [x] 4.3 Add error handling to prevent campaign failure
  - [x] 4.4 Add logging for blending operations

- [ ] 5. Update Campaign.list to support multiple status filters
  - [x] 5.1 Modify Campaign.list to accept status array
  - [x] 5.2 Update query logic to handle multiple statuses
  - [x] 5.3 Test with approved and awaiting_review statuses

- [ ] 6. Write tests for schedule blending
  - [x] 6.1 Unit test: buildConstraints with various configurations
  - [x] 6.2 Unit test: fetchAllActivePosts with multiple campaigns
  - [x] 6.3 Unit test: batchUpdateSchedules with various batch sizes
  - [x] 6.4 Integration test: Create campaign with blendSchedule=true
  - [x] 6.5 Integration test: Verify cadence limits are respected

- [ ] 7. Add monitoring and logging
  - [x] 7.1 Log number of posts analyzed
  - [x] 7.2 Log number of posts rescheduled
  - [x] 7.3 Log blending duration
  - [x] 7.4 Log any validation errors

## Task Details

### 1. Add blendSchedule parameter to campaign creation

**Dependencies**: None

**Description**: Update the campaign creation schema and API to accept an optional `blendSchedule` boolean parameter.

**Files to modify**:
- `models/campaign.mjs` - Add field to CreateCampaignRequestSchema
- `functions/campaign/create-campaign.mjs` - Pass parameter to build function
- `openapi.yaml` - Document new parameter

**Acceptance Criteria**:
- Campaign creation accepts `blendSchedule: true/false`
- Parameter defaults to `false`
- Parameter is passed to build-campaign function

---

### 2. Create schedule blending agent

**Dependencies**: None

**Description**: Create a new agent that analyzes all posts and returns optimized schedules.

**Files to create**:
- `functions/agents/schedule-blender.mjs`

**Acceptance Criteria**:
- Agent receives all posts and constraints
- Agent returns array of {postId, newScheduledAt} objects
- Agent respects cadence limits
- Agent avoids persona clustering
- Agent maintains campaign date boundaries

---

### 3. Add batch update capability to SocialPost model

**Dependencies**: None

**Description**: Add a method to efficiently update multiple post schedules.

**Files to modify**:
- `models/social-post.mjs`

**Acceptance Criteria**:
- Method updates posts in batches of 25
- Method handles partial failures gracefully
- Method logs update operations
- Method returns success/failure status

---

### 4. Integrate schedule blending into build-campaign workflow

**Dependencies**: Tasks 1, 2, 3

**Description**: Add schedule blending as a step in the durable function workflow.

**Files to modify**:
- `functions/campaign/build-campaign.mjs`

**Acceptance Criteria**:
- Blending runs after content generation when blendSchedule=true
- Blending failures don't fail the entire campaign
- Blending is logged with appropriate context
- Campaign completes successfully with or without blending

---

### 5. Update Campaign.list to support multiple status filters

**Dependencies**: None

**Description**: Allow filtering campaigns by multiple statuses to fetch active campaigns.

**Files to modify**:
- `models/campaign.mjs`

**Acceptance Criteria**:
- Campaign.list accepts status as string or array
- Query correctly filters by multiple statuses
- Existing single-status queries still work

---

### 6. Write tests for schedule blending

**Dependencies**: Tasks 1, 2, 3, 4, 5

**Description**: Create comprehensive tests for schedule blending functionality.

**Files to create**:
- `tests/unit/schedule-blending.test.mjs`
- `tests/unit/schedule-blending-integration.test.mjs`

**Acceptance Criteria**:
- All helper functions have unit tests
- Integration test creates campaign with blending
- Tests verify cadence limits are respected
- Tests verify posts are actually rescheduled

---

### 7. Add monitoring and logging

**Dependencies**: Tasks 2, 4

**Description**: Add comprehensive logging for schedule blending operations.

**Files to modify**:
- `functions/agents/schedule-blender.mjs`
- `functions/campaign/build-campaign.mjs`

**Acceptance Criteria**:
- Log posts analyzed count
- Log posts rescheduled count
- Log blending duration
- Log validation errors
- Use agentLogger for consistency

## Implementation Notes

### Order of Implementation

1. Start with Task 1 (API changes) - enables testing
2. Implement Task 3 (batch updates) - needed by agent
3. Implement Task 5 (list filtering) - needed by agent
4. Implement Task 2 (agent) - core logic
5. Implement Task 4 (integration) - wire it all together
6. Implement Task 7 (logging) - observability
7. Implement Task 6 (tests) - validation

### Testing Strategy

- Test each component independently first
- Use mock data for agent testing
- Create test campaigns with known schedules
- Verify cadence limits with edge cases
- Test with 0, 1, 10, 50, 100+ posts

### Rollout Strategy

- Deploy with `blendSchedule` defaulting to `false`
- Test manually with internal campaigns first
- Enable for external integrations after validation
- Monitor logs for errors and performance issues
