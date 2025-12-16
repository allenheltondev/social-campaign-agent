import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Campaign } from '../../models/campaign.mjs';

const ddb = new DynamoDBClient();
const eventBridge = new EventBridgeClient();

export const createSocialPostsTool = tool({
  name: 'create_social_posts',
  description: 'Create multiple social media posts for a campaign with enhanced metadata including intent, references, and asset requirements.',
  schema: z.object({
    campaignId: z.string().describe('The campaign ID these posts belong to'),
    tenantId: z.string().describe('The tenant ID for isolation'),
    planVersion: z.string().describe('The plan version hash for consistency checking'),
    posts: z.array(z.object({
      personaId: z.string().describe('The ID of the persona who will create this post'),
      platform: z.enum(['twitter', 'linkedin', 'instagram', 'facebook']).describe('The social media platform for this post'),
      scheduledDate: z.string().describe('ISO 8601 date string for when this post should be published'),
      topic: z.string().describe('The topic or subject matter for this post'),
      intent: z.enum(['announce', 'educate', 'opinion', 'invite_discussion', 'social_proof', 'reminder']).describe('The intent of this post'),
      assetRequirements: z.object({
        imageRequired: z.boolean().describe('Whether an image is required for this post'),
        imageDescription: z.string().nullable().describe('Description of the required image'),
        videoRequired: z.boolean().describe('Whether a video is required for this post'),
        videoDescription: z.string().nullable().describe('Description of the required video')
      }).describe('Asset requirements for this post'),
      references: z.array(z.object({
        type: z.enum(['url', 'assetId']).describe('Type of reference'),
        value: z.string().describe('Reference value (URL or asset ID)')
      })).nullable().describe('References to include in the post'),
      messagingPillar: z.string().optional().describe('The messaging pillar this post supports'),
      personaConstraints: z.any().optional().describe('Persona-specific constraints and restrictions')
    })).min(1).describe('Array of social posts to create')
  }),
  handler: async (input) => {
    const { campaignId, tenantId, planVersion, posts } = input;
    return await Campaign.createSocialPosts(campaignId, tenantId, planVersion, posts);
  }
});

export const updateCampaignStatusTool = tool({
  name: 'update_campaign_status',
  description: 'Update the campaign status, plan summary, and plan version after creating all posts.',
  schema: z.object({
    campaignId: z.string().describe('The campaign ID to update'),
    tenantId: z.string().describe('The tenant ID for isolation'),
    status: z.enum(['planning', 'generating', 'completed', 'failed']).describe('The new campaign status'),
    planSummary: z.object({
      totalPosts: z.number().int().describe('Total number of posts in the campaign'),
      postsPerPlatform: z.record(z.number().int()).describe('Number of posts per platform'),
      postsPerPersona: z.record(z.number().int()).describe('Number of posts per persona')
    }).describe('Summary of the campaign plan'),
    planVersion: z.string().describe('The plan version hash for consistency tracking')
  }),
  handler: async (input) => {
    const { campaignId, tenantId, status, planSummary, planVersion } = input;
    return await Campaign.updateStatus(campaignId, tenantId, status, planSummary, planVersion);
  }
});

export const getPersonaDetailsTool = tool({
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

export const getBrandDetailsTool = tool({
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

export const getPostDetailsTool = tool({
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

export const getCampaignDetailsTool = tool({
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

export const saveGeneratedContentTool = tool({
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

const styleInferenceOutputSchema = z.object({
  sentenceLengthPattern: z.object({
    avgWordsPerSentence: z.number(),
    variance: z.enum(['low', 'medium', 'high']),
    classification: z.enum(['short', 'medium', 'long', 'varied'])
  }),
  structurePreference: z.enum(['prose', 'lists', 'mixed']),
  pacing: z.enum(['punchy', 'even', 'meandering']),
  emojiFrequency: z.number().min(0).max(1),
  expressivenessMarkers: z.enum(['low', 'medium', 'high']),
  analogyUsage: z.enum(['frequent', 'occasional', 'rare']),
  imageryMetaphorUsage: z.enum(['frequent', 'occasional', 'rare']),
  toneTags: z.array(z.enum(['direct', 'warm', 'candid', 'technical', 'playful', 'skeptical', 'optimistic', 'pragmatic', 'story-driven', 'educational'])).min(1).max(4),
  overallTone: z.string().optional(),
  assertiveness: z.enum(['high', 'medium', 'low']),
  hedgingStyle: z.enum(['rare', 'some', 'frequent']),
  hookStyle: z.enum(['question', 'contrarian', 'story', 'data', 'straight-to-point', 'mixed']),
  anecdoteUsage: z.enum(['frequent', 'occasional', 'rare']),
  confidence: z.object({
    overall: z.number().min(0).max(1),
    coverage: z.object({
      exampleCount: z.number(),
      platformCount: z.number(),
      intentCount: z.number()
    }),
    consistencyByFeature: z.object({
      sentenceLength: z.number().min(0).max(1),
      structure: z.number().min(0).max(1),
      expressiveness: z.number().min(0).max(1),
      metaphors: z.number().min(0).max(1),
      tone: z.number().min(0).max(1),
      assertiveness: z.number().min(0).max(1),
      hooks: z.number().min(0).max(1)
    })
  })
});

export const saveStyleAnalysisTool = tool({
  name: 'save_style_analysis',
  description: 'Save the inferred style analysis to DynamoDB for the specified persona.',
  schema: z.object({
    personaId: z.string().describe('The persona ID to update'),
    tenantId: z.string().describe('The tenant ID for isolation'),
    styleAnalysis: styleInferenceOutputSchema.describe('The comprehensive style analysis data to save')
  }),
  handler: async (input) => {
    try {
      const { personaId, tenantId, styleAnalysis } = input;

      const analysisWithTimestamp = {
        ...styleAnalysis,
        analysisTimestamp: new Date().toISOString()
      };

      const updateParams = {
        TableName: process.env.TABLE_NAME,
        Key: marshall({
          pk: `${tenantId}#${personaId}`,
          sk: 'persona'
        }),
        UpdateExpression: 'SET inferredStyle = :style, updatedAt = :updatedAt, version = if_not_exists(version, :zero) + :inc',
        ExpressionAttributeValues: marshall({
          ':style': analysisWithTimestamp,
          ':updatedAt': new Date().toISOString(),
          ':zero': 0,
          ':inc': 1
        }),
        ReturnValues: 'UPDATED_NEW'
      };

      const result = await ddb.send(new UpdateItemCommand(updateParams));

      return `Successfully saved style analysis for persona ${personaId}.`;

    } catch (error) {
      console.error('Error saving style analysis:', error);
      return `Failed to save style analysis: ${error.message}`;
    }
  }
});
