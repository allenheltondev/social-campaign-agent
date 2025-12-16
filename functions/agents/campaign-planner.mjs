import { Agent, tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { DynamoDBClient, PutItemCommand, UpdateItemCommand, GetItemCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { generatePostId } from '../../schemas/campaign.mjs';

const ddb = new DynamoDBClient();
const eventBridge = new EventBridgeClient();

const createSocialPostsTool = tool({
  name: 'create_social_posts',
  description: 'Create multiple social media posts for a campaign. This tool saves posts to the database and triggers content generation for each post.',
  schema: z.object({
    campaignId: z.string().describe('The campaign ID these posts belong to'),
    tenantId: z.string().describe('The tenant ID for isolation'),
    posts: z.array(z.object({
      personaId: z.string().describe('The ID of the persona who will create this post'),
      platform: z.enum(['twitter', 'linkedin', 'instagram', 'facebook']).describe('The social media platform for this post'),
      scheduledDate: z.string().describe('ISO 8601 date string for when this post should be published'),
      topic: z.string().describe('The topic or subject matter for this post'),
      assetRequirements: z.object({
        imageRequired: z.boolean().describe('Whether an image is required for this post'),
        imageDescription: z.string().optional().describe('Description of the required image'),
        videoRequired: z.boolean().describe('Whether a video is required for this post'),
        videoDescription: z.string().optional().describe('Description of the required video')
      }).optional().describe('Asset requirements for this post')
    })).min(1).describe('Array of social posts to create')
  }),
  handler: async (input) => {
    const { campaignId, tenantId, posts } = input;
    const createdPosts = [];
    const now = new Date().toISOString();

    const batchSize = 25;
    for (let i = 0; i < posts.length; i += batchSize) {
      const batch = posts.slice(i, i + batchSize);
      const writeRequests = [];

      for (const post of batch) {
        const postId = generatePostId();
        const postItem = {
          postId,
          campaignId,
          tenantId,
          personaId: post.personaId,
          platform: post.platform,
          scheduledDate: post.scheduledDate,
          topic: post.topic,
          assetRequirements: post.assetRequirements,
          status: 'planned',
          createdAt: now,
          updatedAt: now,
          version: 1
        };

        writeRequests.push({
          PutRequest: {
            Item: marshall({
              pk: `${tenantId}#${campaignId}#${postId}`,
              sk: 'post',
              GSI1PK: `${tenantId}#${campaignId}`,
              GSI1SK: `post#${post.scheduledDate}`,
              ...postItem
            })
          }
        });

        createdPosts.push({
          postId,
          personaId: post.personaId,
          platform: post.platform,
          scheduledDate: post.scheduledDate
        });
      }

      if (writeRequests.length > 0) {
        await ddb.send(new BatchWriteItemCommand({
          RequestItems: {
            [process.env.TABLE_NAME]: writeRequests
          }
        }));
      }
    }

    const eventEntries = createdPosts.map(post => ({
      Source: 'campaign-planner',
      DetailType: 'Social Post Created',
      Detail: JSON.stringify({
        postId: post.postId,
        campaignId,
        tenantId,
        personaId: post.personaId,
        platform: post.platform,
        scheduledDate: post.scheduledDate
      }),
      EventBusName: process.env.EVENT_BUS_NAME || 'default'
    }));

    for (let i = 0; i < eventEntries.length; i += 10) {
      const eventBatch = eventEntries.slice(i, i + 10);
      await eventBridge.send(new PutEventsCommand({
        Entries: eventBatch
      }));
    }

    return {
      success: true,
      postsCreated: createdPosts.length,
      posts: createdPosts
    };
  }
});

const updateCampaignStatusTool = tool({
  name: 'update_campaign_status',
  description: 'Update the campaign status and plan summary after creating all posts.',
  schema: z.object({
    campaignId: z.string().describe('The campaign ID to update'),
    tenantId: z.string().describe('The tenant ID for isolation'),
    status: z.enum(['planning', 'generating', 'completed', 'failed']).describe('The new campaign status'),
    planSummary: z.object({
      totalPosts: z.number().int().describe('Total number of posts in the campaign'),
      postsPerPlatform: z.record(z.number().int()).describe('Number of posts per platform'),
      postsPerPersona: z.record(z.number().int()).describe('Number of posts per persona')
    }).describe('Summary of the campaign plan')
  }),
  handler: async (input) => {
    const { campaignId, tenantId, status, planSummary } = input;
    const now = new Date().toISOString();

    await ddb.send(new UpdateItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${campaignId}`,
        sk: 'campaign'
      }),
      UpdateExpression: 'SET #status = :status, planSummary = :planSummary, updatedAt = :updatedAt, version = version + :inc',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: marshall({
        ':status': status,
        ':planSummary': planSummary,
        ':updatedAt': now,
        ':inc': 1
      })
    }));

    return {
      success: true,
      campaignId,
      status,
      planSummary
    };
  }
});

const getCampaignDetailsTool = tool({
  name: 'get_campaign_details',
  description: 'Retrieve campaign details including description, personas, platforms, and duration.',
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
      campaignId: campaign.campaignId,
      description: campaign.description,
      personaIds: campaign.personaIds,
      platforms: campaign.platforms,
      brandId: campaign.brandId,
      duration: campaign.duration
    };
  }
});

const plannerAgent = new Agent({
  name: 'Campaign Planner',
  instructions: `You are a social media campaign planning expert. Your role is to create comprehensive campaign plans based on the provided parameters.

When planning a campaign:
1. First, retrieve the campaign details using get_campaign_details
2. Analyze the campaign description, personas, platforms, and duration
3. Create a balanced distribution of posts across:
   - All specified platforms
   - All specified personas
   - The entire date range
4. For each post, determine:
   - The specific persona who should create it
   - The platform it's for
   - The scheduled date (spread evenly across the duration)
   - A specific topic or angle based on the campaign description
   - Whether it needs visual assets (images/videos) and what type
5. Create all posts using create_social_posts tool
6. Calculate the plan summary with totals per platform and persona
7. Update the campaign status to 'generating' with the plan summary

Best practices:
- Distribute posts evenly across the date range
- Balance posts across all personas
- Match post topics to platform characteristics (e.g., LinkedIn = professional, Instagram = visual)
- Recommend images for Instagram and Facebook posts
- Keep topics focused and aligned with the campaign description
- Create 3-7 posts per week depending on platforms and duration`,
  model: 'amazon.nova-pro-v1:0',
  tools: [getCampaignDetailsTool, createSocialPostsTool, updateCampaignStatusTool]
});

export const handler = async (event) => {
  try {
    const detail = event.detail;
    const { campaignId, tenantId, description } = detail;

    console.log('Planning campaign:', { campaignId, tenantId });

    const result = await plannerAgent.run(`Create a social media campaign plan for campaign ${campaignId}.

Campaign details have been provided. Please:
1. Get the full campaign details
2. Create an appropriate number of social posts based on the duration and platforms
3. Distribute posts evenly across personas, platforms, and the date range
4. Update the campaign status when complete

Campaign description: ${description}`);

    console.log('Campaign planning completed:', result);

    return {
      statusCode: 200,
      body: JSON.stringify({
        campaignId,
        message: 'Campaign planning completed',
        result
      })
    };
  } catch (error) {
    console.error('Campaign planning error:', error);

    const { campaignId, tenantId } = event.detail;
    if (campaignId && tenantId) {
      try {
        await ddb.send(new UpdateItemCommand({
          TableName: process.env.TABLE_NAME,
          Key: marshall({
            pk: `${tenantId}#${campaignId}`,
            sk: 'campaign'
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
        console.error('Failed to update campaign status:', updateError);
      }
    }

    throw error;
  }
};
