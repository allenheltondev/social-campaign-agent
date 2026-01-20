import { Agent, BedrockModel } from '@strands-agents/sdk';
import { Campaign } from '../../models/campaign.mjs';
import { SocialPost } from '../../models/social-post.mjs';
import { Brand } from '../../models/brand.mjs';
import { createSocialPostsTool } from './tools.mjs';
import { AssetResolver } from '../../utils/asset-resolver.mjs';
import { agentLogger } from '../../utils/logger.mjs';

const buildCampaignPrompt = (campaignId, tenantId, campaign, brandConfig, personaConfigs, assetAnalysis) => {
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

  const assetDefaults = Brand.extractAssetRequirements(brandConfig);
  const assetOverrides = campaign.assetOverrides?.forceVisuals || {};
  const assetRequirements = {
    twitter: assetOverrides.twitter ?? assetDefaults.twitter ?? false,
    linkedin: assetOverrides.linkedin ?? assetDefaults.linkedin ?? true,
    instagram: assetOverrides.instagram ?? assetDefaults.instagram ?? true,
    facebook: assetOverrides.facebook ?? assetDefaults.facebook ?? true
  };

  let assetSection = '';
  if (assetAnalysis.hasAssets) {
    assetSection = `
**AVAILABLE CONTENT ASSETS** (${assetAnalysis.totalAssets} assets available - use strategically, not required for all posts):
${assetAnalysis.availableAssets.map((asset, index) =>
    `- Asset ${index + 1}: ${asset.contentType} | "${asset.description}" | Type: ${asset.type}`
  ).join('\n')}

**ASSET UTILIZATION APPROACH**:
- Assets are OPTIONAL content - use them when they enhance the post
- Each asset should be used AT MOST once across the entire campaign
- Match assets to posts based on content relevance and platform suitability
- Posts do NOT require assets - create posts without assets when appropriate
- Consider asset descriptions as inspiration for topics and content themes
- Include asset references in post metadata only when using an asset`;
  } else {
    assetSection = `
**CONTENT ASSETS**: No assets provided. Generate creative asset ideas and descriptions for posts that would benefit from visual content.`;
  }

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
${brandConfig?.contentStandards?.restrictions?.length > 0 ? `Brand-level: ${brandConfig.contentStandards.restrictions.join(', ')}` : ''}

**BRAND VOICE**: ${Array.isArray(brandConfig?.voiceGuidelines?.tone) ? brandConfig.voiceGuidelines.tone.join(', ') : brandConfig?.voiceGuidelines?.tone || 'professional'}

**PERSONAS** (${personaConfigs.length} - distribute posts across all personas):
${personaConfigs.map(p => `- ID: ${p.personaId} | Name: ${p.name} (${p.role}) | Company: ${p.company} | Audience: ${p.primaryAudience}`).join('\n')}

**ASSET REQUIREMENTS** (per platform):
${Object.entries(assetRequirements).map(([platform, required]) => `- ${platform}: ${required ? 'Image REQUIRED' : 'Image optional'}`).join('\n')}
${assetSection}

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
   - scheduledAt: When to publish (ISO 8601 format in UTC)
   - topic: Specific topic aligned with messaging pillar${assetAnalysis.hasAssets ? ' and available asset descriptions' : ''}
   - intent: Choose from [announce, educate, opinion, invite_discussion, social_proof, reminder]
   - assetRequirements: Object with imageRequired (boolean), imageDescription (string or null), videoRequired (boolean), videoDescription (string or null)
   - references: Array of reference objects or null - include asset references ONLY when using available assets
   - messagingPillar: Which pillar this post supports (optional string)
${assetAnalysis.hasAssets ? `5. ASSET ASSIGNMENT APPROACH:
   - Available assets are OPTIONAL content - use them to enhance posts when relevant
   - Each asset can be used AT MOST once across the entire campaign
   - Match assets to posts based on topic relevance and platform suitability
   - Many posts should NOT use assets - create engaging content without forced asset usage
   - When using an asset, add reference: { type: "assetId", value: "asset_id_here" }
   - Generate creative asset ideas for posts that would benefit from visuals but don't have matching assets` : `5. ASSET IDEA GENERATION:
   - Create compelling asset descriptions for posts that would benefit from visual content
   - Generate creative concepts for images, graphics, or videos that would enhance the message
   - Consider platform-specific visual requirements and best practices
   - Provide detailed asset descriptions in assetRequirements.imageDescription or videoDescription`}
6. Call create_social_posts tool ONCE with all posts:
   - campaignId: "${campaignId}"
   - tenantId: "${tenantId}"
   - posts: Array of all post objects you created

CRITICAL: Use ONLY the exact persona IDs listed above. Do not make up or generate new persona IDs.
IMPORTANT: Call the tool exactly once with all posts in a single array. Do not call it multiple times.
${assetAnalysis.hasAssets ? 'ASSET APPROACH: Assets are optional content to enhance posts - use strategically when relevant, not for every post.' : 'ASSET CREATIVITY: Generate compelling visual concepts and descriptions for posts that would benefit from assets.'}`;
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
  systemPrompt: `You are a social media campaign planner. Create structured social media post plans based on campaign requirements.

Your responsibilities:
1. Calculate optimal post count based on timeline and cadence
2. Distribute posts across personas, platforms, and messaging pillars
3. Schedule posts respecting allowed days and avoiding blackout dates
4. Handle assets flexibly - use when relevant, not required for every post
5. Generate asset ideas when none are provided

You MUST use the create_social_posts tool once with all posts in the posts array.

CRITICAL: Only use persona IDs explicitly provided in the campaign prompt. Never create or generate persona IDs.`,
  model,
  tools: [createSocialPostsTool]
});

const analyzeAssets = async (tenantId, assets) => {
  if (!assets || assets.length === 0) {
    return {
      hasAssets: false,
      totalAssets: 0,
      availableAssets: [],
      unavailableAssets: []
    };
  }

  try {
    const resolvedAssets = await AssetResolver.resolveMultipleAssets(tenantId, assets);

    const availableAssets = resolvedAssets.filter(asset => asset.available);

    return {
      hasAssets: availableAssets.length > 0,
      totalAssets: availableAssets.length,
      availableAssets: availableAssets.map(asset => ({
        assetId: asset.assetId,
        type: asset.type,
        description: asset.description,
        contentType: asset.contentType,
        accessUrl: asset.accessUrl
      })),
      unavailableAssets: []
    };
  } catch (error) {
    agentLogger.error('Asset analysis failed', {
      operation: 'analyze-assets',
      tenantId,
      assetCount: assets.length,
      errorName: error.name,
      errorMessage: error.message
    });

    return {
      hasAssets: false,
      totalAssets: 0,
      availableAssets: [],
      unavailableAssets: []
    };
  }
};

export const run = async (tenantId, campaignData) => {
  try {
    const { campaignId, campaign } = campaignData;

    if (!campaignId || !tenantId) {
      throw new Error('Missing required parameters: campaignId and tenantId');
    }

    const { campaign: fullCampaign, brandConfig, personaConfigs } = await Campaign.loadFullConfiguration(tenantId, campaignId);

    const assetAnalysis = await analyzeAssets(tenantId, fullCampaign?.assets || campaign?.assets);

    const prompt = buildCampaignPrompt(campaignId, tenantId, fullCampaign || campaign, brandConfig, personaConfigs, assetAnalysis);

    await plannerAgent.invoke(prompt);

    const { items: posts } = await SocialPost.findByCampaign(tenantId, campaignId);

    if (!posts || posts.length === 0) {
      agentLogger.error('No posts found after agent execution', {
        operation: 'campaign-planning',
        campaignId,
        tenantId
      });
      throw new Error('No posts were created by the campaign planner');
    }

    const now = new Date().toISOString();
    await Campaign.update(tenantId, campaignId, {
      status: 'awaiting_review',
      approval: {
        status: 'awaiting_review',
        submittedAt: now,
        reviewedAt: null,
        approvedPostCount: 0,
        totalPostCount: posts.length
      }
    });

    return { posts, success: true };
  } catch (error) {
    agentLogger.error('Campaign planning failed', {
      operation: 'campaign-planning',
      campaignId: campaignData?.campaignId,
      tenantId,
      errorName: error.name,
      errorMessage: error.message
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
        agentLogger.error('Failed to update campaign status after planning error', {
          operation: 'update-campaign-status',
          campaignId: campaignData.campaignId,
          tenantId,
          errorName: updateError.name,
          errorMessage: updateError.message
        });
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
    const {detail} = event;
    const { campaignId, tenantId } = detail;

    const campaignPlanningResult = await run(tenantId, { campaignId, campaign: detail.campaign });

    if (campaignPlanningResult.success) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          campaignId,
          tenantId,
          postsCreated: campaignPlanningResult.posts.length,
          posts: campaignPlanningResult.posts,
          message: 'Campaign planning completed successfully'
        })
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Campaign planning failed',
          error: campaignPlanningResult.error.message
        })
      };
    }
  } catch (error) {
    agentLogger.error('Campaign planning handler failed', {
      operation: 'campaign-planning-handler',
      campaignId: event.detail?.campaignId,
      tenantId: event.detail?.tenantId,
      errorName: error.name,
      errorMessage: error.message
    });
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Campaign planning failed',
        error: error.message
      })
    };
  }
};
