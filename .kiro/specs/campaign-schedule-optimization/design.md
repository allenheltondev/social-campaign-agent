# Campaign Schedule Blending Design

## Overview

Schedule blending is a simple post-processing step that happens after campaign planning. When enabled, an LLM agent receives all posts (new + existing) and returns optimized scheduledAt timestamps. The system then batch-updates all posts.

## Architecture

### Flow

```
Campaign Creation (blendSchedule=true)
  ↓
Campaign Planning (existing flow)
  ↓
Schedule Blending Agent
  ↓
Batch Update Posts
  ↓
Complete
```

### Components

1. **build-campaign.mjs** - Add schedule blending step after content generation
2. **schedule-blender.mjs** - New agent that optimizes schedules
3. **SocialPost.batchUpdateSchedules()** - New model method for efficient updates

## Data Structures

### Agent Input

```javascript
{
  posts: [
    {
      id: "post_123",
      campaignId: "campaign_abc",
      personaId: "persona_xyz",
      platform: "linkedin",
      scheduledAt: "2024-03-15T10:00:00Z",
      topic: "Product launch announcement"
    }
  ],
  constraints: {
    maxPostsPerDay: 2,
    maxPostsPerWeek: 7,
    dateRange: {
      start: "2024-03-01T00:00:00Z",
      end: "2024-03-31T23:59:59Z"
    },
    blackoutDates: ["2024-03-25T00:00:00Z"]
  }
}
```

### Agent Output

```javascript
{
  schedules: [
    {
      postId: "post_123",
      newScheduledAt: "2024-03-15T14:00:00Z"
    }
  ]
}
```

## Implementation Details

### 1. Campaign Creation Schema Update

Add optional `blendSchedule` field to `CreateCampaignRequestSchema`:

```javascript
blendSchedule: z.boolean().optional().default(false)
```

### 2. Build Campaign Integration

In `build-campaign.mjs`, after content generation completes:

```javascript
if (campaign.blendSchedule) {
  await context.step('Blend schedules', async () => {
    const { schedules } = await scheduleBlenderRun(tenantId, {
      campaignId: campaign.id
    });

    await SocialPost.batchUpdateSchedules(tenantId, schedules);
  });
}
```

### 3. Schedule Blender Agent

Create `functions/agents/schedule-blender.mjs`:

```javascript
import { Agent, BedrockModel } from '@strands-agents/sdk';
import { Campaign } from '../../models/campaign.mjs';
import { SocialPost } from '../../models/social-post.mj
odel,
  tools: [updateSchedulesTool]
});

export const run = async (tenantId, { campaignId }) => {
  // Get new campaign
  const campaign = await Campaign.findById(tenantId, campaignId);

  // Get all active posts (new campaign + existing campaigns)
  const allPosts = await fetchAllActivePosts(tenantId);

  // Build constraints
  const constraints = buildConstraints(campaign, allPosts);

  // Build prompt
  const prompt = buildSchedulePrompt(allPosts, constraints);

  // Invoke agent
  await agent.invoke(prompt);

  // Agent calls updateSchedulesTool which returns schedules
  return { success: true };
};
```

### 4. Batch Update Method

Add to `models/social-post.mjs`:

```javascript
static async batchUpdateSchedules(tenantId, schedules) {
  const batchSize = 25;

  for (let i = 0; i < schedules.length; i += batchSize) {
    const batch = schedules.slice(i, i + batchSize);

    await Promise.all(
      batch.map(({ postId, campaignId, newScheduledAt }) =>
        this.update(tenantId, campaignId, postId, {
          scheduledAt: newScheduledAt
        })
      )
    );
  }
}
```

### 5. Helper Functions

```javascript
async function fetchAllActivePosts(tenantId) {
  const campaigns = await Campaign.list(tenantId, {
    status: ['approved', 'awaiting_review']
  });

  const allPosts = [];
  for (const campaign of campaigns.items) {
    const { items: posts } = await SocialPost.findByCampaign(
      tenantId,
      campaign.id
    );
    allPosts.push(...posts);
  }

  return allPosts;
}

function buildConstraints(campaign, allPosts) {
  const dates = allPosts.map(p => new Date(p.scheduledAt));
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));

  return {
    maxPostsPerDay: campaign.cadenceOverrides?.maxPostsPerDay || 2,
    maxPostsPerWeek: campaign.cadenceOverrides?.maxPostsPerWeek || 7,
    dateRange: {
      start: minDate.toISOString(),
      end: maxDate.toISOString()
    },
    blackoutDates: campaign.schedule?.blackoutDates || []
  };
}

function buildSchedulePrompt(posts, constraints) {
  return `Optimize the schedule for ${posts.length} social media posts.

**CURRENT POSTS**:
${posts.map((p, i) => `${i + 1}. ${p.id} | ${p.platform} | ${p.personaId} | ${p.scheduledAt} | "${p.topic}"`).join('\n')}

**CONSTRAINTS**:
- Max ${constraints.maxPostsPerDay} posts per day
- Max ${constraints.maxPostsPerWeek} posts per week
- Date range: ${constraints.dateRange.start} to ${constraints.dateRange.end}
${constraints.blackoutDates.length > 0 ? `- Blackout dates: ${constraints.blackoutDates.join(', ')}` : ''}

**YOUR TASK**:
1. Spread posts evenly across the date range
2. Avoid exceeding daily/weekly limits
3. Don't cluster posts from the same persona on the same day
4. Maintain each post within its original campaign's date boundaries
5. Call update_schedules tool with the optimized schedule

IMPORTANT: Return ALL posts with their new scheduledAt timestamps.`;
}
```

### 6. Update Schedules Tool

```javascript
import { z } from 'zod';

export const updateSchedulesTool = {
  name: 'update_schedules',
  description: 'Update post schedules with optimized timestamps',
  schema: z.object({
    schedules: z.array(z.object({
      postId: z.string(),
      newScheduledAt: z.string().datetime()
    }))
  }),
  handler: async (tenantId, input) => {
    // Validate timestamps
    const schedules = input.schedules.map(s => ({
      ...s,
      newScheduledAt: new Date(s.newScheduledAt).toISOString()
    }));

    // Store in context for return
    return { schedules, success: true };
  }
};
```

## Error Handling

### Validation Failures

If agent returns invalid data:
1. Log error with details
2. Keep original schedules
3. Mark campaign as completed (don't fail the whole campaign)

### Update Failures

If batch update fails:
1. Log which posts failed
2. Continue with successful updates
3. Return partial success status

## Testing Strategy

### Unit Tests

1. Test `buildConstraints()` with various campaign configurations
2. Test `fetchAllActivePosts()` with multiple campaigns
3. Test `batchUpdateSchedules()` with various batch sizes
4. Test validation of agent output

### Integration Tests

1. Create campaign with `blendSchedule: true`
2. Verify posts are rescheduled
3. Verify cadence limits are respected
4. Verify existing campaign posts are updated

## Performance Considerations

- Fetch posts in parallel where possible
- Use batch updates (25 posts per batch)
- Agent timeout: 60 seconds
- Lambda memory: 1024 MB

## Monitoring

Log the following:
- Number of posts analyzed
- Number of posts rescheduled
- Time taken for blending
- Any validation errors
- Cadence violations detected

## Future Enhancements (Not in Scope)

- Preview mode before applying
- Campaign locking to exclude from blending
- Priority-based scheduling
- Manual re-blend endpoint
