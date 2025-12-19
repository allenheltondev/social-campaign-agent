import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { z } from 'zod';

describe('Validation Error Format Consistency', () => {
  /**
   * **Feature: data-access-layer-standardization, Property 14: Validation error format consistency**
   * **Validates: Requirements 4.4**
   */
  it('should return consistent validation error formats across all models', async () => {
    const { validateRequestBody: brandValidate } = await import('../../models/brand.mjs');
    const { validateRequestBody: personaValidate } = await import('../../models/persona.mjs');
    const { validateRequestBody: campaignValidate } = await import('../../models/campaign.mjs');

    await fc.assert(
      fc.property(
        fc.record({
          fieldName: fc.constantFrom('name', 'email', 'description'),
          invalidValue: fc.constantFrom('', 123, true, null)
        }),
        (testData) => {
          const validJson = JSON.stringify({ [testData.fieldName]: testData.invalidValue });

          const testSchema = z.object({
            [testData.fieldName]: z.string().min(1)
          });

          const validators = [
            { name: 'Brand', validate: brandValidate },
            { name: 'Persona', validate: personaValidate },
            { name: 'Campaign', validate: campaignValidate }
          ];

          const errorResults = [];

          for (const { name, validate } of validators) {
            try {
              validate(testSchema, validJson);
            } catch (error) {
              errorResults.push({
                modelName: name,
                errorMessage: error.message,
                errorName: error.name,
                hasDetails: !!error.details
              });
            }
          }

          expect(errorResults.length).toBeGreaterThan(0);

          errorResults.forEach(result => {
            expect(result.errorMessage).toMatch(/^Validation error:/);
            expect(result.errorName).toBe('ValidationError');
            expect(result.hasDetails).toBe(true);
          });

          const uniqueErrorFormats = [...new Set(errorResults.map(r => r.errorName))];
          expect(uniqueErrorFormats.length).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
