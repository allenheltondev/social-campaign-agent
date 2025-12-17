import { Agent, BedrockModel } from '@strands-agents/sdk';
import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Campaign } from '../../models/campaign.mjs';
import { Persona } from '../../models/persona.mjs';
import { Brand } from '../../models/brand.mjs';
import { saveGeneratedContentTool } from './tools.mjs';

const ddb = new DynamoDBClient();

const model = new BedrockModel({
  ...process.env.MODEL_ID && { modelId: process.env.MODEL_ID },
  stream: false,
  stopSequences: ['END'],
  clientConfig: {
    retryMode: 'standard',
    maxAttempts: 3
  }
});

const buildContentPrompt = (postData, campaignData, personaData, brandData) => {
  const { post, postId, campaignId, tenantId } = postData;
  const { platform, topic, intent, assetRequirements, scheduledAt } = post;

  const platformConstraints = {
    twitter: 'Twitter (280 chars max, conversational tone, hashtags at end, punchy and engaging)',
    linkedin: 'LinkedIn (up to 3000 chars, professional tone, thought leadership style, minimal hashtags, focus on insights)',
    instagram: 'Instagram (visual-first captions, emoji-friendly, 3-5 integrated hashtags, storytelling approach)',
    facebook: 'Facebook (community-focused, medium length, engaging questions, 1-2 hashtags, conversational)'
  };

  const intentGuidance = {
    announce: 'Make an announcement or share news',
    educate: 'Teach or inform the audience about something valuable',
    opinion: 'Share a perspective or viewpoint on a topic',
    invite_discussion: 'Encourage conversation and engagement',
    social_proof: 'Share success stories, testimonials, or achievements',
    reminder: 'Remind audience about something important or upcoming'
  };

  return `Generate authentic social media content for ${personaData.name} (${personaData.role} at ${personaData.company}).

**POST DETAILS**:
- Platform: ${platformConstraints[platform]}
- Topic: ${topic}
- Intent: ${intentGuidance[intent]}
- Scheduled: ${scheduledAt}
- Asset Requirements: ${assetRequirements?.imageRequired ? 'Image required' : 'Image optional'}${assetRequirements?.videoRequired ? ', Video required' : ''}

**CAMPAIGN CONTEXT**:
- Campaign: ${campaignData.name}
- Objective: ${campaignData.brief.objective}
- Description: ${campaignData.brief.description}
${campaignData.brief.primaryCTA ? `- Primary CTA: "${campaignData.brief.primaryCTA.text}" → ${campaignData.brief.primaryCTA.url}` : ''}

**PERSONA VOICE PROFILE**:
- Name: ${personaData.name}
- Role: ${personaData.role} at ${personaData.company}
- Primary Audience: ${personaData.primaryAudience}
- Voice Traits: ${personaData.voiceTraits.join(', ')}
- Writing Style: ${personaData.writingHabits.structure} structure, ${personaData.writingHabits.paragraphs} paragraphs, ${personaData.writingHabits.emojis} emoji usage
- Strong Beliefs: ${personaData.opinions.strongBeliefs.join('; ')}
- Avoids Topics: ${personaData.opinions.avoidsTopics.join(', ') || 'None specified'}
- Language to Avoid: ${personaData.language.avoid.join(', ') || 'None specified'}
- CTA Style: ${personaData.ctaStyle.aggressiveness} aggressiveness

${personaData.inferredStyle ? `**INFERRED STYLE PATTERNS**:
- Sentence Length: ${personaData.inferredStyle.sentenceLengthPattern.classification} (avg ${personaData.inferredStyle.sentenceLengthPattern.avgWordsPerSentence} words)
- Structure: ${personaData.inferredStyle.structurePreference}
- Pacing: ${personaData.inferredStyle.pacing}
- Tone: ${personaData.inferredStyle.toneTags.join(', ')}
- Assertiveness: ${personaData.inferredStyle.assertiveness}
- Hook Style: ${personaData.inferredStyle.hookStyle}
- Emoji Frequency: ${Math.round(personaData.inferredStyle.emojiFrequency * 100)}%
- Analogy Usage: ${personaData.inferredStyle.analogyUsage}
- Anecdote Usage: ${personaData.inferredStyle.anecdoteUsage}` : ''}

${brandData ? `**BRAND GUIDELINES**:
- Brand: ${brandData.name}
- Ethos: ${brandData.ethos}
- Voice Tone: ${Array.isArray(brandData.voiceGuidelines?.tone) ? brandData.voiceGuidelines.tone.join(', ') : brandData.voiceGuidelines?.tone || 'Not specified'}
- Content Standards: ${brandData.contentStandards?.qualityRequirements?.join(', ') || 'Standard quality'}
- Restrictions: ${brandData.contentStandards?.restrictions?.join(', ') || 'None specified'}` : ''}

**YOUR TASK**:
1. Generate authentic social media content that perfectly matches ${personaData.name}'s voice and style
2. Ensure the content aligns with the ${intent} intent and covers the topic: "${topic}"
3. Follow ${platform} platform best practices and constraints
4. Respect all persona guardrails and brand guidelines
5. Make the content feel genuinely written by ${personaData.name}, not by an AI
6. Include appropriate hashtags and mentions for the platform
7. Save the content using the save_generated_content tool with these exact parameters:
   - postId: "${postId}"
   - campaignId: "${campaignId}"
   - tenantId: "${tenantId}"
   - content: { text: "your generated text", hashtags: ["optional", "hashtags"], mentions: ["optional", "mentions"] }

The content must feel authentic to ${personaData.name}'s voice while achieving the campaign objectives. Focus on persona authenticity above all else.`;
};

const contentGeneratorAgent = new Agent({
  systemPrompt: `You are an expert social media content creator specializing in authentic, persona-driven content generation.

Your job is to create social media posts that perfectly match a specific persona's voice, style, and communication patterns while achieving campaign objectives and respecting brand guidelines.

Key principles:
- Persona authenticity is paramount - content must feel genuinely written by the persona
- Respect all guardrails including avoided topics, language restrictions, and CTA preferences
- Follow platform-specific best practices and constraints
- Integrate topics naturally within the persona's expertise and communication style
- Generate engaging, platform-optimized content with appropriate hashtags and mentions

You MUST use the save_generated_content tool to save your final content. The tool requires:
- postId: The ID of the post you're generating content for
- campaignId: The ID of the campaign this post belongs to
- tenantId: The tenant ID for data isolation
- content: Object with text, hashtags (optional), and mentions (optional)`,
  model,
  tools: [saveGeneratedContentTool]
});

export const run = async (tenantId, postData) => {
  try {
    const { campaignId, postId, post } = postData;
    const { personaId, platform } = post;

    console.log('Generating content for post:', { postId, campaignId, personaId, platform });

    await ddb.send(new UpdateItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${campaignId}`,
        sk: `POST#${postId}`
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

    const postResponse = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${campaignId}`,
        sk: `POST#${postId}`
      })
    }));

    if (!postResponse.Item) {
      throw new Error(`Post ${postId} not found`);
    }

    const fullPost = unmarshall(postResponse.Item);

    const [campaign, persona, brand] = await Promise.all([
      Campaign.findById(tenantId, campaignId),
      Persona.findById(tenantId, personaId),
      fullPost.brandId ? Brand.findById(tenantId, fullPost.brandId) : Promise.resolve(null)
    ]);

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    if (!persona) {
      throw new Error(`Persona ${personaId} not found`);
    }

    const prompt = buildContentPrompt(
      { postId, campaignId, post: fullPost, tenantId },
      campaign,
      persona,
      brand
    );

    const result = await contentGeneratorAgent.invoke(prompt);

    console.log('Content generation completed:', result);

    return {
      success: true,
      content: {
        text: result.text || '',
        hashtags: result.hashtags || [],
        mentions: result.mentions || [],
        generatedAt: new Date().toISOString()
      },
      error: null
    };
  } catch (error) {
    console.error('Content generation error:', error);

    const { postId, campaignId } = postData;
    if (postId && campaignId && tenantId) {
      try {
        await ddb.send(new UpdateItemCommand({
          TableName: process.env.TABLE_NAME,
          Key: marshall({
            pk: `${tenantId}#${campaignId}`,
            sk: `POST#${postId}`
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

    return {
      success: false,
      content: null,
      error: {
        code: error.code || 'CONTENT_GENERATION_ERROR',
        message: error.message,
        retryable: error.retryable !== false
      }
    };
  }
};

export const handler = async (event) => {
  try {
    const detail = event.detail;
    const { postId, campaignId, tenantId, personaId, platform } = detail;

    const result = await run(tenantId, {
      campaignId,
      postId,
      post: { personaId, platform, ...detail.post }
    });

    if (result.success) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          postId,
          campaignId,
          message: 'Content generation completed',
          result: result.content
        })
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Content generation failed',
          error: result.error.message
        })
      };
    }
  } catch (error) {
    console.error('Content generation handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Content generation failed',
        error: error.message
      })
    };
  }
};
