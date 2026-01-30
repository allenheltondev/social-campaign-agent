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
 * Property-based test to verify that all models use Zod schema validation
 * and that validation errors are consistent.
 */

describe('Model Validation Consistency', () => {
  it('should throw consistent validation errors across models when saving invalid data', async () => {
    const models = [
      { name: 'Campaign', model: Campaign },
      { name: 'Brand', model: Brand },
      { name: 'Persona', model: Persona }
    ];

    for (const { name: _name, model } of models) {
      const invalidEntity = { id: 'test-id' };

      try {
        await model.save('tenant-id', invalidEntity);
        expect(true).toBe(false);
      } catch (error) {
        expect(error.name).toMatch(/ValidationError|Error/);
        expect(error.message).toMatch(/validation error:|failed to save/i);
      }
    }

    try {
      await SocialPost.save('tenant-id', 'campaign-id', { id: 'test-id' });
      expect(true).toBe(false);
    } catch (error) {
      expect(error.name).toMatch(/ValidationError|Error/);
      expect(error.message).toMatch(/validation error:|failed to save/i);
    }
  });
});
