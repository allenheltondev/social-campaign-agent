import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('Lambda PowerTools Configuration Property Tests', () => {
  it('Property 7: Standardized logger utility should export single logger instance', async () => {
    const loggerUtilPath = join(process.cwd(), 'utils/logger.mjs');
    const content = await readFile(loggerUtilPath, 'utf-8');

    expect(content).toContain('export const logger');
    expect(content).toContain("import { Logger } from '@aws-lambda-powertools/logger'");
    expect(content).toContain('new Logger');
    expect(content).toContain('serviceName');
  });

  it('Property 7: Logger configuration should use Lambda PowerTools', async () => {
    const loggerUtilPath = join(process.cwd(), 'utils/logger.mjs');
    const content = await readFile(loggerUtilPath, 'utf-8');

    expect(content).toContain("import { Logger } from '@aws-lambda-powertools/logger'");
    expect(content).toContain('serviceName');
    expect(content).toContain('new Logger');
  });

  it('Property 7: Updated functions should use standardized logger imports', async () => {
    const updatedFunctions = [
      'functions/assets/create-asset.mjs',
      'functions/campaign/create-campaign.mjs',
      'functions/persona/create-persona.mjs',
      'functions/brand/create-brand.mjs',
      'functions/agents/campaign-planner.mjs',
      'functions/auth/authorizer.mjs'
    ];

    for (const functionPath of updatedFunctions) {
      const fullPath = join(process.cwd(), functionPath);
      const content = await readFile(fullPath, 'utf-8');

      const usesStandardizedLogger = content.includes("from '../../utils/logger.mjs'") ||
                                    content.includes("from '../utils/logger.mjs'");

      expect(usesStandardizedLogger).toBe(true);

      if (usesStandardizedLogger) {
        expect(content.includes('console.error')).toBe(false);
      }
    }
  });
});
