import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Campaign } from '../../models/campaign.mjs';
import { SocialPost } from '../../models/social-post.mjs';
import { Brand } from '../../models/brand.mjs';
import { Persona } from '../../models/persona.mjs';

/**
 * **Feature: data-access-layer-standardization, Property 8: Model validation consistency**
 * **Validates: Requirements 2.5**
 *
 * Property-based test to verify that all models use their own validation logic
 * rather than external validation, and that validation errors are consistent.
 */

describe('Model Validation Consistency', () => {
  it('should have validation methods on all models', () => {
    const models = [
      { name: 'Campaign', model: Campaign },
      { name: 'SocialPost', model: SocialPost },
      { name: 'Brand', model: Brand },
      { name: 'Persona', model: Persona }
    ];

    models.forEach(({ name, model }) => {
      expect(typeof model.validateEntity).toBe('function');
      expect(typeof model.validateUpdateData).toBe('function');
    });
  });

  it('should throw consistent validation errors across models', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Campaign', 'SocialPost', 'Brand', 'Persona'),
        (modelName) => {
          const models = {
            Campaign: Campaign,
            SocialPost: SocialPost,
            Brand: Brand,
            Persona: Persona
          };

          const model = models[modelName];

          // Test with completely invalid entity (empty object)
          try {
            model.validateEntity({});
            return false; // Should have thrown an error
          } catch (error) {
            // Should throw ValidationError with consistent format
            expect(error.name).toBe('ValidationError');
            expect(error.message).toMatch(/validation error:/i);
            expect(error.details).toBeDefined();
            return true;
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should use model validation in save operations', async () => {
    const models = [
      { name: 'Campaign', model: Campaign },
      { name: 'Brand', model: Brand },
      { name: 'Persona', model: Persona }
    ];

    for (const { name, model } of models) {
      const invalidEntity = { id: 'test-id' }; // Missing required fields

      try {
        await model.save('tenant-id', invalidEntity);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.name).toBe('ValidationError');
        expect(error.message).toMatch(/validation error:/i);
      }
    }

    // Test SocialPost separately due to different signature
    try {
      await SocialPost.save('tenant-id', 'campaign-id', { id: 'test-id' });
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error.name).toBe('ValidationError');
      expect(error.message).toMatch(/validation error:/i);
    }
  });
});
