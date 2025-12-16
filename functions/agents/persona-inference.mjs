import { Agent } from '@strands-agents/sdk';
import { z } from 'zod';
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { saveStyleAnalysisTool } from './tools.mjs';

const ddb = new DynamoDBClient();
const eventBridge = new EventBridgeClient();

const lambdaEventSchema = z.object({
  personaId: z.string().min(1, 'Persona ID is required'),
  tenantId: z.string().min(1, 'Tenant ID is required')
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
      model: process.env.MODEL_ID,
      tools: [saveStyleAnalysisTool],
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

      // Create comprehensive prompt for the agent using RISEN framework
      const analysisPrompt = `**ROLE**: Act as a professional writing style analyst and linguistic pattern expert specializing in digital communication analysis and persona voice characterization.

**INSTRUCTIONS**: Analyze the provided writing samples to extract consistent communication patterns, voice traits, and stylistic preferences. You must identify measurable linguistic features and behavioral patterns that define this persona's unique writing style across different platforms and contexts.

**STEPS**:
1. **Sample Review**: Examine all ${recentExamples.length} writing samples, noting platform context, intent, and content variations
2. **Quantitative Analysis**: Calculate measurable metrics (sentence length, emoji frequency, expressiveness markers)
3. **Qualitative Assessment**: Identify tone patterns, communication style, and voice characteristics
4. **Pattern Recognition**: Determine consistent behaviors across platforms and content types
5. **Confidence Scoring**: Evaluate analysis reliability based on sample coverage and consistency
6. **Data Persistence**: Save structured analysis using the save_style_analysis tool

**EXPECTATIONS**: Provide a comprehensive JSON-structured analysis containing:
- Sentence & Paragraph Analysis with measurable metrics
- Expressiveness Analysis with quantified markers
- Metaphor & Analogy usage patterns
- Tone Analysis with controlled vocabulary tags
- Communication stance and assertiveness levels
- Hook style preferences for content openings
- Anecdote usage frequency
- Diagnostic confidence scores for each dimension

**NARROWING**:
- Focus on cross-platform consistency while noting platform-specific adaptations
- Distinguish between emoji usage and underlying personality expressiveness
- Separate technical analogies from figurative language usage
- Use only the specified tone vocabulary: direct, warm, candid, technical, playful, skeptical, optimistic, pragmatic, story-driven, educational
- Provide confidence scores between 0.0-1.0 for overall analysis and per-feature reliability
- Ensure analysis covers sentence patterns, structure preferences, pacing, expressiveness, metaphor usage, tone, assertiveness, hedging style, hook patterns, and anecdote frequency

Here are the writing samples to analyze:

${formattedExamples}

After completing your analysis, use the save_style_analysis tool to save the results for persona "${personaId}" in tenant "${tenantId}".`;

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
export { lambdaEventSchema };
