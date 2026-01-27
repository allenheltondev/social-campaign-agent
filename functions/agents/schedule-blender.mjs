import { Agent, BedrockModel, tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { Campaign } from '../../models/campaign.mjs';
import { SocialPost } from '../../models/social-post.mjs';
import { agentLogger } from '../../utils/logger.mjs';

const model = new BedrockModel({
  ...process.env.MODEL_ID && { modelId: process.env.MODEL_ID },
  stream: false,
  stopSequences: ['END'],
  clientConfig: {
    retryMode: 'standard',
    maxAttempts: 3
  }
});

export const updateSchedulesTool = tool({
  name: 'update_schedules',
  description: 'Update post schedules with optimized timestamps. Call this tool once with all schedule updates.',
  inputSchema: z.object({
    schedules: z.array(z.object({
      postId: z.string().describe('The post ID to update'),
      newScheduledAt: z.string().describe('The new scheduled timestamp in ISO 8601 format')
    })).min(1).describe('Array of all schedule updates')
  }),
  callback: async (input) => {
    try {
      const schedules = input.schedules.map(s => ({
        ...s,
        newScheduledAt: new Date(s.newScheduledAt).toISOString()
      }));

      return { schedules, success: true };
    } catch (error) {
      agentLogger.error('Failed to update schedules', {
        operation: 'updateSchedules',
        errorName: error.name,
        errorMessage: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  }
});

const scheduleBlenderAgent = new Agent({
  systemPrompt: `You are a social media schedule optimization specialist. Your role is to optimize post schedules across multiple campaigns to maximize engagement and maintain consistent cadence.

**ROLE**: Schedule optimization expert for social media campaigns

**INSTRUCTIONS**:
Your responsibilities include:
1. Analyze current post schedules across all active campaigns
2. Identify scheduling conflicts and clustering issues
3. Optimize distribution to respect cadence constraints
4. Balance posts across personas, platforms, and time periods
5. Maintain campaign-specific date boundaries

**STEPS**:
1. Review all provided posts with their current schedules
2. Identify violations of constraints (daily limits, weekly limits, blackout dates)
3. Detect persona clustering on the same day
4. Calculate optimal distribution across the date range
5. Generate new schedule that respects all constraints
6. Call update_schedules tool with all optimized timestamps

**EXPECTATIONS**:
- Spread posts evenly across the campaign date range
- Never exceed daily or weekly posting limits
- Avoid scheduling multiple posts from the same persona on the same day
- Respect blackout dates completely
- Keep each post within its original campaign's date boundaries
- Return ALL posts with their new scheduledAt timestamps
- Maintain platform diversity throughout the schedule

**NARROWING**:
- Focus only on schedule optimization, not content changes
- Use exact post IDs provided in the input
- Generate timestamps in ISO 8601 format (UTC)
- Call the update_schedules tool exactly once with all updates

You MUST use the update_schedules tool to save your optimized schedule.`,
  model,
  tools: [updateSchedulesTool]
});

async function fetchAllActivePosts(tenantId) {
  const campaigns = await Campaign.list(tenantId, {
    status: ['approved', 'pending_approval']
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
Analyze the current schedule and generate an optimized distribution that:
1. Spreads posts evenly across the date range
2. Respects daily and weekly posting limits
3. Avoids clustering posts from the same persona on the same day
4. Maintains each post within its original campaign's date boundaries
5. Avoids all blackout dates

Call the update_schedules tool with all ${posts.length} posts and their optimized scheduledAt timestamps.`;
}

export { buildConstraints, buildSchedulePrompt };

export const run = async (tenantId, { campaignId }) => {
  try {
    const campaign = await Campaign.findById(tenantId, campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    const allPosts = await fetchAllActivePosts(tenantId);

    if (allPosts.length === 0) {
      return { success: true, schedules: [], message: 'No posts to schedule' };
    }

    const constraints = buildConstraints(campaign, allPosts);
    const prompt = buildSchedulePrompt(allPosts, constraints);

    await scheduleBlenderAgent.invoke(prompt);

    const schedules = scheduleBlenderAgent.toolResults?.[0]?.output?.schedules || [];

    return { success: true, schedules };
  } catch (error) {
    agentLogger.error('Schedule blending failed', {
      operation: 'schedule-blending',
      campaignId,
      tenantId,
      errorName: error.name,
      errorMessage: error.message
    });

    return {
      success: false,
      schedules: [],
      error: {
        code: error.code || 'SCHEDULE_BLENDING_ERROR',
        message: error.message
      }
    };
  }
};
