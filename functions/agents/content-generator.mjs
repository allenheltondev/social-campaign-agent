import { Agent, tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const ddb = new DynamoDBClient();

const getPersonaDetailsTool = tool({
  name: 'get_persona_details',
  description: 'Retrieve persona details including voice traits, writing habits, opinions, and inferred style.',
  schema: z.object({
    personaId: z.string().describe('The persona ID to retrieve'),
    tenantId: z.string().describe('The tenant ID for isolation')
  }),
  handler: async (input) => {
    const { personaId, tenantId } = input;

    const result = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${personaId}`,
        sk: 'persona'
      })
    }));

    if (!result.Item) {
      throw new Error(`Persona ${personaId} not found`);
    }

    const persona = unmarshall(result.Item);
    return {
      name: persona.name,
      role: persona.role,
      company: persona.company,
      primaryAudience: persona.primaryAudience,
      voiceTraits: persona.voiceTraits,
      writingHabits: persona.writingHabits,
      opinions: persona.opinions,
      language: persona.language,
      ctaStyle: persona.ctaStyle,
      inferredStyle: persona.inferredStyle
    };
  }
});

const getBrandDetailsTool = tool({
  name: 'get_brand_details',
  description: 'Retrieve brand guidelines and standards if a brand is associated with the post.',
  schema: z.object({
    brandId: z.string().describe('The brand ID to retrieve'),
    tenantId: z.string().describe('The tenant ID for isolation')
  }),
  handler: async (input) => {
    const { brandId, tenantId } = input;

    const result = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${brandId}`,
        sk: 'brand'
      })
    }));

    if (!result.Item) {
      return null;
    }

    const brand = unmarshall(result.Item);
    return {
      name: brand.name,
      ethos: brand.ethos,
      voiceAttributes: brand.voiceAttributes,
      contentStandards: brand.contentStandards,
      guardrails: brand.guardrails
    };
  }
});

const getPostDetailsTool = tool({
  name: 'get_post_details',
  description: 'Retrieve social post details including topic, platform, and asset requirements.',
  schema: z.object({
    postId: z.string().describe('The post ID to retrieve'),
    campaignId: z.string().describe('The campaign ID this post belongs to'),
    tenantId: z.string().describe('The tenant ID for isolation')
  }),
  handler: async (input) => {
    const { postId, campaignId, tenantId } = input;

    const result = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${campaignId}#${postId}`,
        sk: 'post'
      })
    }));

    if (!result.Item) {
      throw new Error(`Post ${postId} not found`);
    }

    const post = unmarshall(result.Item);
    return {
      topic: post.topic,
      platform: post.platform,
      scheduledDate: post.scheduledDate,
      assetRequirements: post.assetRequirements,
      personaId: post.personaId
    };
  }
});

const getCampaignDetailsTool = tool({
  name: 'get_campaign_details',
  description: 'Retrieve campaign details including description and brand ID.',
  schema: z.object({
    campaignId: z.string().describe('The campaign ID to retrieve'),
    tenantId: z.string().describe('The tenant ID for isolation')
  }),
  handler: async (input) => {
    const { campaignId, tenantId } = input;

    const result = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${campaignId}`,
        sk: 'campaign'
      })
    }));

    if (!result.Item) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    const campaign = unmarshall(result.Item);
    return {
      description: campaign.description,
      brandId: campaign.brandId
    };
  }
});

const saveGeneratedContentTool = tool({
  name: 'save_generated_content',
  description: 'Save the generated social media content to the post.',
  schema: z.object({
    postId: z.string().describe('The post ID to update'),
    campaignId: z.string().describe('The campaign ID this post belongs to'),
    tenantId: z.string().describe('The tenant ID for isolation'),
    content: z.object({
      text: z.string().describe('The generated social media post text'),
      hashtags: z.array(z.string()).optional().describe('Array of hashtags to include'),
      mentions: z.array(z.string()).optional().describe('Array of account mentions to include')
    }).describe('The generated content for the post')
  }),
  handler: async (input) => {
    const { postId, campaignId, tenantId, content } = input;
    const now = new Date().toISOString();

    await ddb.send(new UpdateItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${campaignId}#${postId}`,
        sk: 'post'
      }),
      UpdateExpression: 'SET content = :content, #status = :status, updatedAt = :updatedAt, version = version + :inc',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: marshall({
        ':content': {
          ...content,
          generatedAt: now
        },
        ':status': 'completed',
        ':updatedAt': now,
        ':inc': 1
      })
    }));

    return {
      success: true,
      postId,
      status: 'completed'
    };
  }
});

const contentGeneratorAgent = new Agent({
  name: 'Content Generator',
  instructions: `You are an expert social media content creator who generates authentic, engaging posts that match specific persona voices and brand guidelines.

Your process:
1. Get the post details using get_post_details to understand the topic, platform, and requirements
2. Get the campaign details using get_campaign_details for overall context
3. Get the persona details using get_persona_details to understand their voice, style, and preferences
4. If the campaign has a brandId, get brand details using get_brand_details
5. Generate content that:
   - Matches the persona's voice traits and writing style exactly
   - Respects their language preferences (avoid certain words/topics)
   - Aligns with their opinions and CTA style
   - Follows their inferred style patterns (sentence length, structure, tone, etc.)
   - Adheres to brand guidelines if provided
   - Is optimized for the specific platform
   - Addresses the assigned topic effectively
   - Includes appropriate hashtags and mentions
6. Save the generated content using save_generated_content

Platform-specific guidelines:
- Twitter: Concise (280 chars), punchy, hashtags at end, conversational
- LinkedIn: Professional, longer-form (up to 3000 chars), thought leadership, minimal hashtags
- Instagram: Visual-first caption, emoji-friendly, 3-5 hashtags integrated naturally
- Facebook: Community-focused, medium length, engaging questions, 1-2 hashtags

Content quality standards:
- Must authentically match the persona's voice (this is critical)
- Should feel natural, not robotic or templated
- Must respect all persona guardrails (avoid topics, language preferences)
- Should align with brand voice if brand guidelines exist
- Must be platform-appropriate in length and format
- Should include a call-to-action matching the persona's CTA style`,
  model: 'amazon.nova-pro-v1:0',
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
