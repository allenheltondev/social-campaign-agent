import { Agent, BedrockModel } from '@strands-agents/sdk';
import { Campaign } from '../../models/campaign.mjs';
import { SocialPost } from '../../models/social-post.mjs';
import { createSocialPostsTool } from './tools.mjs';
import crypto from 'crypto';

const buildCampaignPrompt = (campaignId, tenantId, campaign, brandConfig, personaConfigs) => {
  const startDate = new Date(campaign.schedule.startDate);
  const endDate = new Date(campaign.schedule.endDate);
  const durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const totalWeeks = Math.ceil(durationDays / 7);

  const cadence = {
    minPostsPerWeek: campaign.cadenceOverrides?.minPostsPerWeek || brandConfig?.cadenceDefaults?.minPostsPerWeek || 3,
    maxPostsPerWeek: campaign.cadenceOverrides?.maxPostsPerWeek || brandConfig?.cadenceDefaults?.maxPostsPerWeek || 7,
    maxPostsPerDay: campaign.cadenceOverrides?.maxPostsPerDay || brandConfig?.cadenceDefaults?.maxPostsPerDay || 2
  };

  const messagingPillars = campaign.messaging?.pillars || brandConfig?.pillars || [
    { name: 'Brand Awareness', weight: 0.4 },
    { name: 'Education', weight: 0.3 },
    { name: 'Engagement', weight: 0.3 }
  ];

  const assetDefaults = brandConfig?.assetDefaults || {};
  const assetOverrides = campaign.assetOverrides?.forceVisuals || {};
  const assetRequirements = {
    twitter: assetOverrides.twitter ?? assetDefaults.twitter ?? false,
    linkedin: assetOverrides.linkedin ?? assetDefaults.linkedin ?? true,
    instagram: assetOverrides.instagram ?? assetDefaults.instagram ?? true,
    facebook: assetOverrides.facebook ?? assetDefaults.facebook ?? true
  };



  return `Plan and create social media posts for Campaign ${campaignId}

**CAMPAIGN OBJECTIVE**: ${campaign.brief.objective}
**DESCRIPTION**: ${campaign.brief.description}
${campaign.brandId ? `**BRAND ID**: ${campaign.brandId}` : '**BRAND**: No brand specified'}

**TIMELINE**:
- Start: ${campaign.schedule.startDate}
- End: ${campaign.schedule.endDate}
- Duration: ${durationDays} days (${totalWeeks} weeks)
- Timezone: ${campaign.schedule.timezone}
- Allowed Days: ${campaign.schedule.allowedDaysOfWeek.join(', ')}
${campaign.schedule.blackoutDates?.length > 0 ? `- Blackout Dates: ${campaign.schedule.blackoutDates.join(', ')}` : ''}

**PLATFORMS**: ${campaign.participants.platforms.join(', ')}

**CADENCE REQUIREMENTS**:
- ${cadence.minPostsPerWeek}-${cadence.maxPostsPerWeek} posts per week
- Maximum ${cadence.maxPostsPerDay} posts per day
- Distribute evenly across the campaign timeline

**MESSAGING PILLARS** (distribute posts according to these weights):
${messagingPillars.map(p => `- ${p.name}: ${Math.round(p.weight * 100)}% of posts`).join('\n')}

**CONTENT RESTRICTIONS**:
${campaign.messaging?.campaignAvoidTopics?.length > 0 ? `Campaign-specific: ${campaign.messaging.campaignAvoidTopics.join(', ')}` : ''}
${brandConfig?.contentRestrictions?.avoidTopics?.length > 0 ? `Brand-level: ${brandConfig.contentRestrictions.avoidTopics.join(', ')}` : ''}

**BRAND VOICE**: ${Array.isArray(brandConfig?.voiceGuidelines?.tone) ? brandConfig.voiceGuidelines.tone.join(', ') : brandConfig?.voiceGuidelines?.tone || 'professional'}

**PERSONAS** (${personaConfigs.length} - distribute posts across all personas):
${personaConfigs.map(p => `- ID: ${p.personaId} | Name: ${p.name} (${p.role}) | Company: ${p.company} | Audience: ${p.primaryAudience}`).join('\n')}

**ASSET REQUIREMENTS** (per platform):
${Object.entries(assetRequirements).map(([platform, required]) => `- ${platform}: ${required ? 'Image REQUIRED' : 'Image optional'}`).join('\n')}

**PRIMARY CTA**: ${campaign.brief.primaryCTA ? `"${campaign.brief.primaryCTA.text}" → ${campaign.brief.primaryCTA.url}` : 'None specified'}

**YOUR TASK**:
1. Calculate the optimal number of posts based on timeline and cadence requirements
2. Create a balanced distribution across:
   - All ${personaConfigs.length} personas
   - All ${campaign.participants.platforms.length} platforms
   - All ${messagingPillars.length} messaging pillars (respecting weights)
3. Schedule posts strategically:
   - Respect allowed days of week
   - Avoid blackout dates
   - Don't exceed max posts per day
   - Spread evenly across campaign duration
4. For each post, define:
   - personaId: MUST use exact persona ID from the list above (${personaConfigs.map(p => p.personaId).join(', ')})
   - platform: Which platform it's for
   - scheduledDate: When to publish (ISO 8601 format in UTC)
   - topic: Specific topic aligned with messaging pillar
   - intent: Choose from [announce, educate, opinion, invite_discussion, social_proof, reminder]
   - assetRequirements: Object with imageRequired (boolean), imageDescription (string or null), videoRequired (boolean), videoDescription (string or null)
   - references: Array of reference objects or null (each reference has type and value)
   - messagingPillar: Which pillar this post supports (optional string)
5. Call create_social_posts tool ONCE with all posts:
   - campaignId: "${campaignId}"
   - tenantId: "${tenantId}"
   - posts: Array of all post objects you created

CRITICAL: Use ONLY the exact persona IDs listed above. Do not make up or generate new persona IDs.
IMPORTANT: Call the tool exactly once with all posts in a single array. Do not call it multiple times.`;
};

const model = new BedrockModel({
  ...process.env.MODEL_ID && { modelId: process.env.MODEL_ID },
  stream: false,
  stopSequences: ['END'],
  clientConfig: {
    retryMode: 'standard',
    maxAttempts: 3
  }
});

const plannerAgent = new Agent({
  systemPrompt: `You are a social media campaign planner. Your job is to create a structured plan of social media posts.

When given campaign details, you must:
1. Calculate how many posts to create based on the timeline and cadence
2. Distribute posts across all personas and platforms
3. Schedule posts on allowed days, avoiding blackout dates
4. Assign topics and intents that match the campaign objective
5. Specify asset requirements for each post

You MUST use the create_social_posts tool to save your plan. Call it once with all posts in the posts array.

For each post, provide:
- personaId: MUST be an exact persona ID from the provided list - never make up or generate persona IDs
- platform: one of twitter, linkedin, instagram, facebook
- scheduledDate: ISO 8601 date string
- topic: string describing the post topic
- intent: one of announce, educate, opinion, invite_discussion, social_proof, reminder
- assetRequirements: object with imageRequired (boolean), imageDescription (string or null), videoRequired (boolean), videoDescription (string or null)
- references: array of objects with type and value, or null
- messagingPillar: optional string

CRITICAL: Only use persona IDs that are explicitly provided in the campaign prompt. Do not create, generate, or make up persona IDs.
Make sure all dates are valid ISO 8601 format and all required fields are present.`,
  model,
  tools: [createSocialPostsTool]
});

export const run = async (tenantId, campaignData) => {
  try {
    const { campaignId, campaign } = campaignData;

    if (!campaignId || !tenantId) {
      throw new Error('Missing required parameters: campaignId and tenantId');
    }

    const { campaign: fullCampaign, brandConfig, personaConfigs } = await Campaign.loadFullConfiguration(tenantId, campaignId);

    const prompt = buildCampaignPrompt(campaignId, tenantId, fullCampaign || campaign, brandConfig, personaConfigs);

    const agentResponse = await plannerAgent.invoke(prompt);
    console.log('Agent response:', JSON.stringify(agentResponse, null, 2));

    const { posts } = await SocialPost.findByCampaign(tenantId, campaignId);

    if (!posts || posts.length === 0) {
      throw new Error('No posts were created by the campaign planner');
    }

    return { posts, success: true };
  } catch (error) {
    console.error('Campaign planning error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    if (campaignData?.campaignId && tenantId) {
      try {
        const now = new Date().toISOString();
        await Campaign.update(tenantId, campaignData.campaignId, {
          status: 'failed',
          lastError: {
            code: 'CAMPAIGN_PLANNING_FAILED',
            message: error.message || 'Campaign planning workflow failed',
            at: now,
            retryable: false
          }
        });
      } catch (updateError) {
        console.error('Failed to update campaign status after planning error:', updateError);
      }
    }

    return {
      success: false,
      posts: [],
      error: {
        code: error.code || 'PLANNING_ERROR',
        message: error.message
      }
    };
  }
};

export const handler = async (event) => {
  try {
    const detail = event.detail;
    const { campaignId, tenantId } = detail;

    const result = await run(tenantId, { campaignId, campaign: detail.campaign });

    if (result.success) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          campaignId,
          tenantId,
          postsCreated: result.posts.length,
          posts: result.posts,
          message: 'Campaign planning completed successfully'
        })
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Campaign planning failed',
          error: result.error.message
        })
      };
    }
  } catch (error) {
    console.error('Campaign planning handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Campaign planning failed',
        error: error.message
      })
    };
  }
};
