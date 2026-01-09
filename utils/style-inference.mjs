import { StyleInferenceAgent } from '../functions/agents/persona-inference.mjs';

export class StyleInferenceService {
  constructor() {
    this.agent = new StyleInferenceAgent();
  }

  async analyzePersonaStyle(personaId, tenantId) {
    const analysisRequest = {
      personaId,
      tenantId
    };

    const analysisResult = await this.agent.analyzeAndSaveStyle(analysisRequest);

    if (!analysisResult.success) {
      throw new Error(analysisResult.error);
    }

    return analysisResult;
  }

  async hasSufficientExamples(_personaId, _tenantId) {
    return true;
  }

  getMinimumExamplesRequired() {
    return 5;
  }

  getMaximumExamplesUsed() {
    return 10;
  }
}
