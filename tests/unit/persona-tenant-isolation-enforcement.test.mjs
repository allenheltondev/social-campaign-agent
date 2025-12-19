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

describe('Persona Model Tenant Isolation Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  /**
   * **Feature: data-access-layer-standardization, Property 11: Model tenant isolation enforcement**
   * **Validates: Requirements 3.4**
   */
  it('should prevent cross-tenant data access by enforcing tenant context in all operations', async () => {
    const { Persona } = await import('../../models/persona.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId1: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
          tenantId2: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
          personaId: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0)
        }).filter(data => data.tenantId1 !== data.tenantId2), // Ensure different tenants
        async (testData) => {
          mockSend.mockResolvedValue({ Item: null });

          // Test findById with different tenant contexts
          await Persona.findById(testData.tenantId1, testData.personaId);
          const call1 = mockSend.mock.calls[0][0];

          mockSend.mockClear();
          await Persona.findById(testData.tenantId2, testData.personaId);
          const call2 = mockSend.mock.calls[0][0];

          // Verify that each call uses the correct tenant context
          expect(call1.input.Key.pk).toBeDefined();
          expect(call2.input.Key.pk).toBeDefined();

          // The keys should be different because they include different tenant IDs
          expect(call1.input.Key.pk).not.toBe(call2.input.Key.pk);

          // Both should have the same sort key (persona type)
          expect(call1.input.Key.sk).toBe(call2.input.Key.sk);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should enforce tenant isolation in list operations', async () => {
    const { Persona } = await import('../../models/persona.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId1: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
          tenantId2: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0)
        }).filter(data => data.tenantId1 !== data.tenantId2), // Ensure different tenants
        async (testData) => {
          mockSend.mockResolvedValue({ Items: [] });

          // Test list with different tenant contexts
          await Persona.list(testData.tenantId1);
          const call1 = mockSend.mock.calls[0][0];

          mockSend.mockClear();
          await Persona.list(testData.tenantId2);
          const call2 = mockSend.mock.calls[0][0];

          // Verify that each call uses the correct tenant context in GSI query
          expect(call1.input.ExpressionAttributeValues[':tenantId']).toBeDefined();
          expect(call2.input.ExpressionAttributeValues[':tenantId']).toBeDefined();

          // The tenant IDs in the queries should be different
          expect(call1.input.ExpressionAttributeValues[':tenantId']).not.toBe(
            call2.input.ExpressionAttributeValues[':tenantId']
          );

          // Both should query the same GSI and use the same key condition
          expect(call1.input.IndexName).toBe(call2.input.IndexName);
          expect(call1.input.KeyConditionExpression).toBe(call2.input.KeyConditionExpression);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should enforce tenant isolation in save operations', async () => {
    const { Persona } = await import('../../models/persona.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId1: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
          tenantId2: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
          persona: fc.record({
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
          })
        }).filter(data => data.tenantId1 !== data.tenantId2), // Ensure different tenants
        async (testData) => {
          mockSend.mockResolvedValue({});

          // Test save with different tenant contexts
          await Persona.save(testData.tenantId1, testData.persona);
          const call1 = mockSend.mock.calls[0][0];

          mockSend.mockClear();
          await Persona.save(testData.tenantId2, testData.persona);
          const call2 = mockSend.mock.calls[0][0];

          // Verify that each call uses the correct tenant context
          expect(call1.input.Item.pk).toBeDefined();
          expect(call2.input.Item.pk).toBeDefined();

          // The partition keys should be different because they include different tenant IDs
          expect(call1.input.Item.pk).not.toBe(call2.input.Item.pk);

          // Both should have the same sort key (persona type)
          expect(call1.input.Item.sk).toBe(call2.input.Item.sk);

          // GSI partition keys should also be different (tenant-specific)
          expect(call1.input.Item.GSI1PK).toBeDefined();
          expect(call2.input.Item.GSI1PK).toBeDefined();
          expect(call1.input.Item.GSI1PK).not.toBe(call2.input.Item.GSI1PK);
        }
      ),
      { numRuns: 100 }
    );
  });
});
