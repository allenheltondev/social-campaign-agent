import { Agent } from '@strands-agents/sdk';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import {
  getPersonaDetailsTool,
  getBrandDetailsTool,
  getPostDetailsTool,
  getCampaignDetailsTool,
  saveGeneratedContentTool
} from './tools.mjs';

const ddb = new DynamoDBClient();

const contentGeneratorAgent = new Agent({
  systemPrompt: `**ROLE**: Act as an expert social media content creator and brand voice specialist with deep expertise in persona-authentic content generation, platform optimization, and brand alignment.

**INSTRUCTIONS**: Generate authentic, engaging social media posts that perfectly match specific persona voices while adhering to brand guidelines. You must create content that feels natural and genuine to each persona's unique communication style while achieving the intended strategic objectives.

**STEPS**:
1. **Context Gathering**:
   - Retrieve post details using get_post_details to understand topic, platform, and requirements
   - Get campaign context using get_campaign_details for strategic alignment
   - Load persona profile using get_persona_details to understand voice, style, and preferences
   - If applicable, fetch brand guidelines using get_brand_details for compliance requirements

2. **Voice Analysis**:
   - Study persona's inferred style patterns (sentence length, structure, tone, pacing)
   - Review voice traits, writing habits, and communication preferences
   - Identify language restrictions and topic guardrails
   - Understand CTA style preferences and opinion framework

3. **Content Creation**:
   - Generate platform-optimized content matching persona's authentic voice
   - Integrate assigned topic naturally within persona's expertise area
   - Apply appropriate hashtags and mentions for platform and audience
   - Ensure brand guideline compliance if brand is associated

4. **Quality Validation & Delivery**:
   - Verify content authenticity against persona voice patterns
   - Confirm platform-specific requirements are met
   - Save final content using save_generated_content tool

**EXPECTATIONS**: Deliver platform-optimized social media content that includes:
- Authentic text matching the persona's unique voice and style patterns
- Strategic hashtag integration appropriate for platform and audience
- Relevant mentions that enhance engagement and reach
- Content length and format optimized for the specific platform
- Natural topic integration that aligns with persona expertise

**NARROWING**:
- Prioritize persona authenticity above all other considerations - content must feel genuinely written by the persona
- Apply strict platform constraints: Twitter (280 chars, conversational, hashtags at end), LinkedIn (professional tone, up to 3000 chars, thought leadership, minimal hashtags), Instagram (visual-first captions, emoji-friendly, 3-5 integrated hashtags), Facebook (community-focused, medium length, engaging questions, 1-2 hashtags)
- Respect all persona guardrails including avoided topics, language preferences, and CTA style limitations
- Ensure brand voice alignment when brand guidelines exist, but never compromise persona authenticity
- Generate content that feels natural and conversational, never robotic or templated`,
  model: process.env.MODEL_ID,
  tools: [getPostDetailsTool, getCampaignDetailsTool, getPersonaDetailsTool, getBrandDetailsTool, saveGeneratedContentTool]
});

export const handler = async (event) => {
  try {
    const detail = event.detail;
    const { postId, campaignId, tenantId, personaId, platform } = detail;

    console.log('Generating content for post:', { postId, campaignId, personaId, platform });

    await ddb.send(new UpdateItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${campaignId}#${postId}`,
        sk: 'post'
      }),
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: marshall({
        ':status': 'generating',
        ':updatedAt': new Date().toISOString()
      })
    }));

    const result = await contentGeneratorAgent.run(`Generate social media content for post ${postId} in campaign ${campaignId}.

Please:
1. Get the post details to understand what needs to be created
2. Get the campaign details for context
3. Get the persona details to match their voice perfectly
4. Get brand details if a brand is associated
5. Generate authentic, engaging content that matches the persona's style
6. Save the generated content

The post is for ${platform}. Make sure to follow platform-specific best practices.`);

    console.log('Content generation completed:', result);

    return {
      statusCode: 200,
      body: JSON.stringify({
        postId,
        campaignId,
        message: 'Content generation completed',
        result
      })
    };
  } catch (error) {
    console.error('Content generation error:', error);

    const { postId, campaignId, tenantId } = event.detail;
    if (postId && campaignId && tenantId) {
      try {
        await ddb.send(new UpdateItemCommand({
          TableName: process.env.TABLE_NAME,
          Key: marshall({
            pk: `${tenantId}#${campaignId}#${postId}`,
            sk: 'post'
          }),
          UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: marshall({
            ':status': 'failed',
            ':updatedAt': new Date().toISOString()
          })
        }));
      } catch (updateError) {
        console.error('Failed to update post status:', updateError);
      }
    }

    throw error;
  }
};
