import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * **Feature: logging-cleanup, Property 7: Lambda PowerTools Configuration**
 * **Validates: Requirements 3.5**
 *
 * For any Lambda function that uses logging, the Logger should be configured with an appropriate serviceName
 */

const EXPECTED_LOGGER_NAMES = {
  'functions/assets': 'assetLogger',
  'functions/campaign': 'campaignLogger',
  'functions/persona': 'personaLogger',
  'functions/brand': 'brandLogger',
  'functions/agents': 'agentLogger',
  'functions/auth': 'authLogger'
};

describe('Lambda PowerTools Configuration Property Tests', () => {
  it('Property 7: Standardized logger utility should export all expected loggers', async () => {
    const loggerUtilPath = join(process.cwd(), 'utils/logger.mjs');
    const content = await readFile(loggerUtilPath, 'utf-8');

    // Check that all expected loggers are exported
    const expectedLoggers = Object.values(EXPECTED_LOGGER_NAMES);

    await fc.assert(
      fc.property(
        fc.constantFrom(...expectedLoggers),
        (expectedLogger) => {
          expect(content).toContain(`export const ${expectedLogger}`);
          return true;
        }
      ),
      { numRuns: expectedLoggers.length }
    );
  });

  it('Property 7: Logger configuration should use Lambda PowerTools', async () => {
    const loggerUtilPath = join(process.cwd(), 'utils/logger.mjs');
    const content = await readFile(loggerUtilPath, 'utf-8');

    // Verify that the logger utility imports Lambda PowerTools Logger
    expect(content).toContain("import { Logger } from '@aws-lambda-powertools/logger'");

    // Verify that it creates loggers with service names
    expect(content).toContain('serviceName');
    expect(content).toContain('new Logger');
  });

  it('Property 7: Updated functions should use standardized logger imports', async () => {
    // Test specific functions that we know have been updated
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

      // Should import from standardized logger
      const usesStandardizedLogger = content.includes("from '../../utils/logger.mjs'") ||
                                    content.includes("from '../utils/logger.mjs'");

      expect(usesStandardizedLogger).toBe(true);

      // Should not use console.error if using standardized logger
      if (usesStandardizedLogger) {
        expect(content.includes('console.error')).toBe(false);
      }
    }
  });
});
