import { Agent } from '@strands-agents/sdk';
import { Campaign } from '../../models/campaign.mjs';
import { createSocialPostsTool, updateCampaignStatusTool } from './tools.mjs';

const plannerAgent = new Agent({
  systemPrompt: `**ROLE**: Act as an expert social media campaign strategist and content planner with deep expertise in multi-persona campaign orchestration, brand alignment, and platform-specific content optimization.

**INSTRUCTIONS**: Create comprehensive social media campaign plans that transform campaign objectives into executable post schedules. You must analyze campaign requirements, brand guidelines, and persona configurations to generate strategic content plans that maintain authenticity while achieving business goals.

**STEPS**:
1. **Data Analysis Phase**:
   - Parse campaign details, brand configuration, and persona configurations from the provided data
   - Identify campaign objectives, target audiences, and success metrics
   - Map brand guidelines to content requirements and restrictions
   - Catalog persona constraints, voice traits, and platform preferences

2. **Strategic Planning Phase**:
   - Distribute content across messaging pillars with strategic weighting
   - Assign post intents (announce, educate, opinion, invite_discussion, social_proof, reminder)
   - Balance content distribution across personas and platforms
   - Apply schedule constraints (blackout dates, posting windows, cadence limits)
   - Integrate brand asset requirements and CTA strategies

3. **Execution Phase**:
   - Create all posts with enhanced metadata using create_social_posts tool
   - Include proper intent classification and asset requirements for each post
   - Update campaign status to 'generating' with comprehensive plan summary using update_campaign_status tool

**EXPECTATIONS**: Deliver a complete, executable campaign plan as structured data that includes:
- Detailed post schedule with specific topics, platforms, and personas
- Strategic intent classification for each post
- Asset requirements (images, videos) with descriptions
- Brand asset references and CTA integration
- Persona constraint validation and compliance confirmation

**NARROWING**:
- Prioritize persona authenticity over campaign preferences when conflicts arise
- Ensure strict tenant isolation throughout all operations
- Apply platform-specific content requirements (Twitter: 280 chars, LinkedIn: professional tone, Instagram: visual-first, Facebook: community-focused)
- Maintain consistency with merged configuration and brand voice guidelines
- Generate topics that authentically align with each persona's expertise and opinion framework`,
  model: process.env.MODEL_ID,
  tools: [
    createSocialPostsTool,
    updateCampaignStatusTool
  ]
});

export const handler = async (event) => {
  try {
    const detail = event.detail;
    const { campaignId, tenantId } = detail;

    if (!campaignId || !tenantId) {
      throw new Error('Missing required parameters: campaignId and tenantId');
    }

    const { campaign, brandConfig, personaConfigs, mergedConfig } = await Campaign.loadFullConfiguration(tenantId, campaignId);
    const postPlan = Campaign.generatePostPlan(campaignId, tenantId, campaign, mergedConfig);

    const result = await plannerAgent.run(`Create a comprehensive social media campaign plan for campaign ${campaignId}.

CAMPAIGN DETAILS:
${JSON.stringify(campaign, null, 2)}

BRAND CONFIGURATION:
${JSON.stringify(brandConfig, null, 2)}

PERSONA CONFIGURATIONS:
${JSON.stringify(personaConfigs, null, 2)}

MERGED CONFIGURATION:
${JSON.stringify(mergedConfig, null, 2)}

POST PLAN:
${JSON.stringify(postPlan, null, 2)}

REQUIRED WORKFLOW:
1. Create all posts with enhanced metadata using create_social_posts with the provided post plan
2. Update the campaign status to 'generating' with the provided plan summary and version using update_campaign_status

QUALITY REQUIREMENTS:
- Use the exact post plan provided above
- Ensure proper tenant isolation throughout
- Include proper intent classification and asset requirements for each post
- Maintain consistency with the merged configuration and brand guidelines

Please execute this workflow completely and report the final results.`);

    console.log('Campaign planning completed:', result);

    return {
      statusCode: 200,
      body: JSON.stringify({
        campaignId,
        tenantId,
        message: 'Campaign planning completed successfully',
        result
      })
    };
  } catch (error) {
    console.error('Campaign planning error:', error);

    if (event.detail?.campaignId && event.detail?.tenantId) {
      try {
        await Campaign.markAsFailed(event.detail.campaignId, event.detail.tenantId, error);
      } catch (updateError) {
        console.error('Failed to update campaign status after planning error:', updateError);
      }
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Campaign planning failed',
        error: error.message
      })
    };
  }
};
