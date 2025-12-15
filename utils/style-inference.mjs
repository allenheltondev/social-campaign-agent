import { StyleInferenceAgent } from '../functions/agents/persona-inference.mjs';

/**
 * Utility wrapper for Strands-based style inference agent
 * Provides simplified interface for persona management functions
 */
export class StyleInferenceService {
  constructor() {
    this.agent = new StyleInferenceAgent();
  }

  /**
   * Trigger style analysis for a persona (loads examples from DynamoDB and saves results)
   * @param {string} personaId - Persona identifier
   * @param {string} tenantId - Tenant identifier
   * @returns {Object} Style analysis results
   */
  async analyzePersonaStyle(personaId, tenantId) {
    const input = {
      personaId,
      tenantId
    };

    const result = await this.agent.analyzeAndSaveStyle(input);

    if (!result.success) {
      throw new Error(result.error);
    }

    return result;
  }

  /**
   * Check if sufficient examples exist for style analysis by querying DynamoDB
   * @param {string} personaId - Persona identifier
   * @param {string} tenantId - Tenant identifier
   * @returns {boolean} True if sufficient examples exist
   */
  async hasSufficientExamples(personaId, tenantId) {
    try {
      // This would need to query DynamoDB to count examples
      // For now, we'll let the agent handle this check
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get minimum examples required for analysis
   * @returns {number} Minimum number of examples required
   */
  getMinimumExamplesRequired() {
    return 5;
  }

  /**
   * Get maximum examples used for analysis
   * @returns {number} Maximum number of examples used
   */
  getMaximumExamplesUsed() {
    return 10;
  }
}
