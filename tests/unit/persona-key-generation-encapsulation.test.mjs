import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

const mockSend = vi.fn();

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({ send: mockSend })),
  GetItemCommand: vi.fn((params) => ({ input: params })),
  PutItemCommand: vi.fn((params) => ({ input: params })),
  QueryCommand: vi.fn((params) => ({ input: params })),
  BatchGetItemCommand: vi.fn((params) => ({ input: params }))
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: vi.fn((obj) => obj),
  unmarshall: vi.fn((obj) => obj)
}));

describe('Persona Model Key Generation Encapsulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  /**
   * **Feature: data-access-layer-standardization, Property 10: Model key generation encapsulation**
   * **Validates: Requirements 3.2**
   */
  it('should handle DynamoDB key generation internally without requiring external key construction', async () => {
    const { Persona } = await import('../../models/persona.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
          name: fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length > 0),
          role: fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length > 0),
          company: fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length > 0),
          primaryAudience: fc.constantFrom('executives', 'professionals', 'consumers', 'technical', 'creative'),
          voiceTraits: fc.array(fc.string({ minLength: 5, maxLength: 20 }).filter(s => s.trim().length > 0), { minLength: 1, maxLength: 5 }),
          writingHabits: fc.record({
            paragraphs: fc.constantFrom('short', 'medium', 'long'),
            questions: fc.constantFrom('frequent', 'occasional', 'rare'),
            emojis: fc.constantFrom('frequent', 'sparing', 'none'),
            structure: fc.constantFrom('prose', 'lists', 'mixed')
          }),
          opinions: fc.record({
            strongBeliefs: fc.array(fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length > 0), { minLength: 1, maxLength: 3 }),
            avoidsTopics: fc.array(fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0), { maxLength: 5 })
          }),
          language: fc.record({
            avoid: fc.array(fc.string({ minLength: 5, maxLength: 30 }).filter(s => s.trim().length > 0), { maxLength: 5 }),
            prefer: fc.array(fc.string({ minLength: 5, maxLength: 30 }).filter(s => s.trim().length > 0), { maxLength: 5 })
          }),
          ctaStyle: fc.record({
            aggressiveness: fc.constantFrom('low', 'medium', 'high'),
            patterns: fc.array(fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0), { maxLength: 5 })
          })
        }),
        async (testData) => {
          mockSend.mockResolvedValue({});

          // Test that save method doesn't require external key construction
          await Persona.save(testData.tenantId, testData);

          // Verify that the model handled key generation internally
          expect(mockSend).toHaveBeenCalled();
          const commandCall = mockSend.mock.calls[0][0];

          // The model should have constructed DynamoDB keys internally
          expect(commandCall).toBeDefined();
          expect(commandCall.input).toBeDefined();
          expect(commandCall.input.Item).toBeDefined();
          expect(commandCall.input.Item.pk).toBeDefined();
          expect(commandCall.input.Item.sk).toBeDefined();
          expect(commandCall.input.Item.GSI1PK).toBeDefined();
          expect(commandCall.input.Item.GSI1SK).toBeDefined();

          // The key property is that the model generates keys internally
          // We don't need to validate the exact format, just that keys are present
          expect(commandCall.input.Item.pk).toBeDefined();
          expect(commandCall.input.Item.sk).toBeDefined();
          expect(commandCall.input.Item.GSI1PK).toBeDefined();
          expect(commandCall.input.Item.GSI1SK).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle key generation for findById without external key construction', async () => {
    const { Persona } = await import('../../models/persona.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
          personaId: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0)
        }),
        async (testData) => {
          mockSend.mockResolvedValue({ Item: null });

          // Test that findById method doesn't require external key construction
          await Persona.findById(testData.tenantId, testData.personaId);

          // Verify that the model handled key generation internally
          expect(mockSend).toHaveBeenCalled();
          const commandCall = mockSend.mock.calls[0][0];

          // The model should have constructed DynamoDB keys internally
          expect(commandCall).toBeDefined();
          expect(commandCall.input).toBeDefined();
          expect(commandCall.input.Key).toBeDefined();
          // The key property is that the model generates keys internally
          expect(commandCall.input.Key.pk).toBeDefined();
          expect(commandCall.input.Key.sk).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
