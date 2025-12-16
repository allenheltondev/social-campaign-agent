import { Agent, tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { DynamoDBClient, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const ddb = new DynamoDBClient();
const eventBridge = new EventBridgeClient();

const lambdaEventSchema = z.object({
  personaId: z.string().min(1, 'Persona ID is required'),
  tenantId: z.string().min(1, 'Tenant ID is required')
});

const styleInferenceOutputSchema = z.object({
  // Measurable sentence/paragraph patterns
  sentenceLengthPattern: z.object({
    avgWordsPerSentence: z.number(),
    variance: z.enum(['low', 'medium', 'high']),
    classification: z.enum(['short', 'medium', 'long', 'varied'])
  }),
  structurePreference: z.enum(['prose', 'lists', 'mixed']),
  pacing: z.enum(['punchy', 'even', 'meandering']),

  // Separated emoji and expressiveness
  emojiFrequency: z.number().min(0).max(1),
  expressivenessMarkers: z.enum(['low', 'medium', 'high']),

  // Split metaphor types
  analogyUsage: z.enum(['frequent', 'occasional', 'rare']),
  imageryMetaphorUsage: z.enum(['frequent', 'occasional', 'rare']),

  // Controlled vocabulary tone + free text
  toneTags: z.array(z.enum(['direct', 'warm', 'candid', 'technical', 'playful', 'skeptical', 'optimistic', 'pragmatic', 'story-driven', 'educational'])).min(1).max(4),
  overallTone: z.string().optional(),

  // Stance and hedging
  assertiveness: z.enum(['high', 'medium', 'low']),
  hedgingStyle: z.enum(['rare', 'some', 'frequent']),

  // Hook style
  hookStyle: z.enum(['question', 'contrarian', 'story', 'data', 'straight-to-point', 'mixed']),

  // Anecdote usage
  anecdoteUsage: z.enum(['frequent', 'occasional', 'rare']),

  // Diagnostic confidence
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

const saveAnalysisTool = tool({
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

/**
 * Emit EventBridge event for style analysis completion
 * @param {string} tenantId - Tenant identifier
 * @param {string} personaId - Persona identifier
 * @param {string} status - Analysis status (success/failure)
 * @param {Object} details - Additional event details
 */
async function emitAnalysisEvent(tenantId, personaId, status, details = {}) {
  const eventParams = {
    Entries: [
      {
        Source: 'persona-management-api',
        DetailType: 'Style Analysis Completed',
        Detail: JSON.stringify({
          tenantId,
          personaId,
          status,
          timestamp: new Date().toISOString(),
          ...details
        }),
        EventBusName: process.env.EVENT_BUS_NAME || 'default'
      }
    ]
  };

  try {
    await eventBridge.send(new PutEventsCommand(eventParams));

  } catch (error) {
    console.error('Failed to emit EventBridge event:', error);
    // Don't throw - event emission failure shouldn't fail the analysis
  }
}

/**
 * Load writing examples from DynamoDB for a persona
 * @param {string} tenantId - Tenant identifier
 * @param {string} personaId - Persona identifier
 * @returns {Array} Array of writing examples
 */
async function loadWritingExamples(tenantId, personaId) {
  const queryParams = {
    TableName: process.env.TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
    ExpressionAttributeValues: marshall({
      ':pk': `${tenantId}#${personaId}`,
      ':skPrefix': 'example#'
    })
  };

  const result = await ddb.send(new QueryCommand(queryParams));

  if (!result.Items || result.Items.length === 0) {
    throw new Error('No writing examples found for this persona');
  }

  return result.Items.map(item => unmarshall(item));
}

/**
 * Style Inference Agent using Strands SDK
 * Loads examples from DynamoDB and saves analysis back to DynamoDB
 */
export class StyleInferenceAgent {
  constructor() {
    this.agent = new Agent({
      tools: [saveAnalysisTool],
      printer: false
    });
  }

  /**
   * Analyze writing examples and save results to DynamoDB
   * @param {Object} input - Input containing personaId and tenantId
   * @returns {Object} Analysis results
   */
  async analyzeAndSaveStyle(input) {
    try {
      const validatedInput = lambdaEventSchema.parse(input);
      const { personaId, tenantId } = validatedInput;

      const examples = await loadWritingExamples(tenantId, personaId);

      if (examples.length < 5) {
        throw new Error(`Insufficient writing examples. Found ${examples.length}, minimum 5 required.`);
      }

      const recentExamples = examples
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10);

      // Format examples with full context for the agent prompt
      const formattedExamples = recentExamples
        .map((example, index) => {
          let formatted = `Example ${index + 1}:
Platform: ${example.platform}
Intent: ${example.intent}`;

          if (example.notes) {
            formatted += `\nNotes: ${example.notes}`;
          }

          formatted += `\nText: ${example.text}`;
          return formatted;
        })
        .join('\n\n---\n\n');

      // Create comprehensive prompt for the agent
      const analysisPrompt = `You are a writing style analysis expert. I need you to analyze the following ${recentExamples.length} writing samples and extract consistent communication patterns.

Each example includes the platform it was written for, the intent behind the content, any additional notes, and the actual text. Use all this context to understand how the persona adapts their writing style across different platforms and purposes.

Here are the writing samples to analyze:

${formattedExamples}

Please analyze these samples and provide a comprehensive style analysis with the following structure:

**Sentence & Paragraph Analysis (measurable):**
- Calculate average words per sentence across all examples
- Determine variance in sentence length (low/medium/high)
- Classify overall pattern (short/medium/long/varied)
- Identify structure preference: prose vs lists vs mixed
- Assess pacing: punchy (short bursts), even (consistent flow), or meandering (long, winding)

**Expressiveness Analysis (separate emoji from personality):**
- Count emoji frequency (0.0-1.0) - platform-dependent
- Measure expressiveness markers: exclamation density, interjections ("y'all", "dang"), all-caps, parentheticals (low/medium/high)

**Metaphor & Analogy (split by type):**
- Technical analogies and comparisons (frequent/occasional/rare)
- Figurative imagery and metaphorical language (frequent/occasional/rare)

**Tone Analysis (controlled vocabulary + free text):**
- Select 2-4 tone tags from: direct, warm, candid, technical, playful, skeptical, optimistic, pragmatic, story-driven, educational
- Optional free-text tone summary

**Stance & Communication Style:**
- Assertiveness: how often they make strong claims vs soften (high/medium/low)
- Hedging style: frequency of "maybe", "I think", "it depends" (rare/some/frequent)

**Hook Style (how they open content):**
- Identify dominant pattern: question, contrarian, story, data, straight-to-point, or mixed

**Anecdote Usage:**
- Personal stories and examples (frequent/occasional/rare)

**Diagnostic Confidence:**
- Overall confidence (0.0-1.0)
- Coverage: count examples, platforms, and intents analyzed
- Per-feature confidence scores for each analysis dimension

Provide your analysis as a JSON object matching this structure exactly.

After your analysis, use the save_style_analysis tool to save the results for persona "${personaId}" in tenant "${tenantId}".`;

      const result = await this.agent.invoke(analysisPrompt);

      // Emit success event
      await emitAnalysisEvent(tenantId, personaId, 'success', {
        examplesAnalyzed: recentExamples.length,
        platforms: [...new Set(recentExamples.map(e => e.platform))],
        intents: [...new Set(recentExamples.map(e => e.intent))],
        requestId: input.requestId
      });

      return {
        success: true,
        message: 'Style analysis completed and saved successfully',
        personaId,
        tenantId,
        examplesAnalyzed: recentExamples.length,
        agentResponse: result.lastMessage
      };

    } catch (error) {
      console.error('Style inference error:', {
        error: error.message,
        personaId: input?.personaId,
        tenantId: input?.tenantId
      });

      // Emit failure event
      await emitAnalysisEvent(input?.tenantId, input?.personaId, 'failure', {
        error: error.message,
        requestId: input?.requestId
      });

      return {
        success: false,
        error: error.message,
        personaId: input?.personaId,
        tenantId: input?.tenantId
      };
    }
  }
}

/**
 * Lambda handler for style inference using Strands agent
 * Triggered by EventBridge events
 * @param {Object} event - EventBridge event containing analysis request
 * @returns {Object} Style analysis results or error response
 */
export const handler = async (event) => {
  try {
    const detail = event.detail;
    const { personaId, tenantId, requestId } = detail;

    if (!personaId || !tenantId) {
      throw new Error('Missing required fields in EventBridge event');
    }

    const agent = new StyleInferenceAgent();
    const result = await agent.analyzeAndSaveStyle({
      personaId,
      tenantId,
      requestId
    });

    return {
      statusCode: result.success ? 200 : 400,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('Handler error:', error);

    // Emit failure event for any unhandled errors
    if (event.detail?.tenantId && event.detail?.personaId) {
      await emitAnalysisEvent(
        event.detail.tenantId,
        event.detail.personaId,
        'failure',
        {
          error: error.message,
          requestId: event.detail?.requestId
        }
      );
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error during style analysis'
      })
    };
  }
};

// Export for use in other modules
export { lambdaEventSchema, styleInferenceOutputSchema };
