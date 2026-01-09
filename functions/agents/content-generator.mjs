import { Agent, BedrockModel } from '@strands-agents/sdk';
import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Campaign } from '../../models/campaign.mjs';
import { Persona } from '../../models/persona.mjs';
import { Brand } from '../../models/brand.mjs';
import { AssetResolver } from '../../utils/asset-resolver.mjs';
import { saveGeneratedContentTool } from './tools.mjs';
import { agentLogger } from '../../utils/logger.mjs';

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

const buildContentPrompt = (postData, campaignData, personaData, brandData, resolvedAssets = []) => {
  const { post, postId, campaignId, tenantId } = postData;
  const { platform, topic, intent, assetRequirements, scheduledAt, references: _references } = post;

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

  let assetSection = '';
  if (resolvedAssets && resolvedAssets.length > 0) {
    const availableAssets = resolvedAssets.filter(asset => asset.available);
    const unavailableAssets = resolvedAssets.filter(asset => !asset.available);

    if (availableAssets.length > 0) {
      assetSection = `
**AVAILABLE ASSETS** (${availableAssets.length} assets accessible for this post):
${availableAssets.map((asset, index) =>
    `- Asset ${index + 1}: ${asset.contentType} | "${asset.description}" | Access URL: ${asset.accessUrl}`
  ).join('\n')}

**ASSET USAGE INSTRUCTIONS**:
- Reference these assets naturally in your content when relevant
- Use asset descriptions to inform your content creation
- Consider the visual elements when crafting your message`;

      if (unavailableAssets.length > 0) {
        assetSection += `

**UNAVAILABLE ASSETS** (${unavailableAssets.length} assets with access issues - content will proceed without these):
${unavailableAssets.map(asset => `- ${asset.type} asset: ${asset.error}`).join('\n')}`;
      }
    } else if (unavailableAssets.length > 0) {
      assetSection = `
**ASSET ACCESS ISSUES**: All ${unavailableAssets.length} assigned assets are currently unavailable. Content will be generated without asset references.
${unavailableAssets.map(asset => `- ${asset.type} asset: ${asset.error}`).join('\n')}`;
    }
  }

  return `Generate authentic social media content for ${personaData.name} (${personaData.role} at ${personaData.company}).

**POST DETAILS**:
- Platform: ${platformConstraints[platform]}
- Topic: ${topic}
- Intent: ${intentGuidance[intent]}
- Scheduled: ${scheduledAt}
- Asset Requirements: ${assetRequirements?.imageRequired ? 'Image required' : 'Image optional'}${assetRequirements?.videoRequired ? ', Video required' : ''}
${assetSection}

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
    const { personaId, platform: _platform } = post;

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

    const campaign = await Campaign.findById(tenantId, campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    const [persona, brand] = await Promise.all([
      Persona.findById(tenantId, personaId),
      campaign.brandId ? Brand.findById(tenantId, campaign.brandId) : Promise.resolve(null)
    ]);

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    if (!persona) {
      throw new Error(`Persona ${personaId} not found`);
    }

    // Resolve assets for this post to ensure accessibility throughout generation (Requirement 10.2)
    let resolvedAssets = [];
    if (fullPost.references && fullPost.references.length > 0) {
      try {
        const assetReferences = fullPost.references
          .filter(ref => ref.type === 'assetId')
          .map(ref => ({
            assetId: ref.value,
            type: 'internal'
          }));

        if (assetReferences.length > 0) {
          resolvedAssets = await AssetResolver.resolveMultipleAssets(tenantId, assetReferences);

          const _availableAssets = resolvedAssets.filter(asset => asset.available);
          const unavailableAssets = resolvedAssets.filter(asset => !asset.available);

          if (unavailableAssets.length > 0) {
            agentLogger.error('Some assets are unavailable for content generation', {
              operation: 'content-generation',
              postId,
              campaignId,
              tenantId,
              unavailableAssets: unavailableAssets.map(asset => ({
                assetId: asset.assetId,
                error: asset.error
              }))
            });
          }
        }
      } catch (error) {
        agentLogger.error('Asset resolution failed for post', {
          operation: 'asset-resolution',
          postId,
          campaignId,
          tenantId,
          errorName: error.name,
          errorMessage: error.message
        });

        resolvedAssets = [];
      }
    }

    const prompt = buildContentPrompt(
      { postId, campaignId, post: fullPost, tenantId },
      campaign,
      persona,
      brand,
      resolvedAssets
    );

    const agentResponse = await contentGeneratorAgent.invoke(prompt);

    return {
      success: true,
      content: {
        text: agentResponse.text || '',
        hashtags: agentResponse.hashtags || [],
        mentions: agentResponse.mentions || [],
        generatedAt: new Date().toISOString()
      },
      error: null
    };
  } catch (error) {
    agentLogger.error('Content generation error', {
      operation: 'content-generation',
      postId: postData?.postId,
      campaignId: postData?.campaignId,
      tenantId,
      errorName: error.name,
      errorMessage: error.message
    });

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
        agentLogger.error('Failed to update post status', {
          operation: 'update-post-status',
          postId,
          campaignId,
          tenantId,
          errorName: updateError.name,
          errorMessage: updateError.message
        });
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
    const {detail} = event;
    const { postId, campaignId, tenantId, personaId, platform } = detail;

    const contentGenerationResult = await run(tenantId, {
      campaignId,
      postId,
      post: { personaId, platform, ...detail.post }
    });

    if (contentGenerationResult.success) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          postId,
          campaignId,
          message: 'Content generation completed',
          result: contentGenerationResult.content
        })
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Content generation failed',
          error: contentGenerationResult.error.message
        })
      };
    }
  } catch (error) {
    agentLogger.error('Content generation handler error', {
      operation: 'content-generation-handler',
      postId: event.detail?.postId,
      campaignId: event.detail?.campaignId,
      tenantId: event.detail?.tenantId,
      errorName: error.name,
      errorMessage: error.message
    });
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Content generation failed',
        error: error.message
      })
    };
  }
};
