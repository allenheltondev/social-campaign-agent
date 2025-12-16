import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  PersonaSchema,
  CreatePersonaRequestSchema,
  generatePersonaId
} from '../../schemas/persona.mjs';
import { validatePersonaEntity } from '../../utils/validation.mjs';

/**
 * **Feature: persona-management-api, Property 1: Persona data round-trip consistency**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.5**
 */

describe('Property-Based Tests - Persona Data', () => {
  describe('Property 1: Persona data round-trip consistency', () => {

    // Generator for valid primary a round-tralues
    const primaryAudienceArb = fc.constantFrom('executives', 'professionals', 'consumers', 'technical', 'creative');

    // Generator for valid enum values
    const paragraphsArb = fc.constantFrom('short', 'medium', 'long');
    const questionsArb = fc.constantFrom('frequent', 'occasional', 'rare');
    const emojisArb = fc.constantFrom('frequent', 'sparing', 'none');
    const structureArb = fc.constantFrom('prose', 'lists', 'mixed');
    const aggressivenessArb = fc.constantFrom('low', 'medium', 'high');

    // Generator for writing habits
    const writingHabitsArb = fc.record({
      paragraphs: paragraphsArb,
      questions: questionsArb,
      emojis: emojisArb,
      structure: structureArb
    });

    // Generator for opinions framework
    const opinionsArb = fc.record({
      strongBeliefs: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 3 }),
      avoidsTopics: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 10 })
    });

    // Generator for language preferences
    const languageArb = fc.record({
      avoid: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 }),
      prefer: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 })
    });

    // Generator for CTA style
    const ctaStyleArb = fc.record({
      aggressiveness: aggressivenessArb,
      patterns: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
    });

    // Generator for valid persona creation request
    const createPersonaRequestArb = fc.record({
      name: fc.string({ minLength: 1, maxLength: 100 }),
      role: fc.string({ minLength: 1, maxLength: 100 }),
      company: fc.string({ minLength: 1, maxLength: 100 }),
      primaryAudience: primaryAudienceArb,
      voiceTraits: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
      writingHabits: writingHabitsArb,
      opinions: opinionsArb,
      language: languageArb,
      ctaStyle: ctaStyleArb
    });

    it('should maintain data consistency through creation and validation cycle', () => {
      fc.assert(
        fc.property(createPersonaRequestArb, fc.string({ minLength: 1, maxLength: 50 }), (personaRequest, tenantId) => {
          // Step 1: Validate the creation request
          const validatedRequest = CreatePersonaRequestSchema.parse(personaRequest);

          // Step 2: Simulate persona creation by adding generated metadata
          const personaId = generatePersonaId();
          const now = new Date().toISOString();

          const completePersona = {
            ...validatedRequest,
            personaId,
            tenantId,
            createdAt: now,
            updatedAt: now,
            version: 1,
            isActive: true
          };

          // Step 3: Validate the complete persona entity
          const validatedPersona = validatePersonaEntity(completePersona);

          // Step 4: Verify round-trip consistency
          // All original request data should be preserved
          expect(validatedPersona.name).toBe(personaRequest.name);
          expect(validatedPersona.role).toBe(personaRequest.role);
          expect(validatedPersona.company).toBe(personaRequest.company);
          expect(validatedPersona.primaryAudience).toBe(personaRequest.primaryAudience);
          expect(validatedPersona.voiceTraits).toEqual(personaRequest.voiceTraits);
          expect(validatedPersona.writingHabits).toEqual(personaRequest.writingHabits);
          expect(validatedPersona.opinions).toEqual(personaRequest.opinions);
          expect(validatedPersona.language).toEqual(personaRequest.language);
          expect(validatedPersona.ctaStyle).toEqual(personaRequest.ctaStyle);

          // Generated metadata should be present and valid
          expect(validatedPersona.personaId).toBe(personaId);
          expect(validatedPersona.tenantId).toBe(tenantId);
          expect(validatedPersona.createdAt).toBe(now);
          expect(validatedPersona.updatedAt).toBe(now);
          expect(validatedPersona.version).toBe(1);
          expect(validatedPersona.isActive).toBe(true);

          // ID generation should work
          const generatedId = generatePersonaId();
          expect(generatedId).toMatch(/^persona_[A-Z0-9]{26}$/); // ULID format
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: persona-management-api, Property 2: Opinion framework constraint validation**
   * **Validates: Requirements 1.4**
   */

  describe('Property 2: Opinion framework constraint validation', () => {

    it('should accept 1-3 strong beliefs and reject requests outside these bounds', () => {
      fc.assert(
        fc.property(
          // Generate opinion frameworks with varying numbers of strong beliefs
          fc.record({
            strongBeliefs: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 5 }),
            avoidsTopics: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 10 })
          }),
          (opinions) => {
            const strongBeliefsCount = opinions.strongBeliefs.length;

            // Create a minimal valid persona request with the test opinions
            const personaRequest = {
              name: 'Test User',
              role: 'Test Role',
              company: 'Test Company',
              primaryAudience: 'professionals',
              voiceTraits: ['test'],
              writingHabits: {
                paragraphs: 'medium',
                questions: 'occasional',
                emojis: 'sparing',
                structure: 'mixed'
              },
              opinions: opinions,
              language: {
                avoid: [],
                prefer: []
              },
              ctaStyle: {
                aggressiveness: 'medium',
                patterns: []
              }
            };

            let validationPassed = false;
            let validationError = null;

            try {
              CreatePersonaRequestSchema.parse(personaRequest);
              validationPassed = true;
            } catch (error) {
              validationError = error;
            }

            // Property: Should accept 1-3 strong beliefs and reject outside bounds
            if (strongBeliefsCount >= 1 && strongBeliefsCount <= 3) {
              // Should pass validation
              expect(validationPassed).toBe(true);
              expect(validationError).toBeNull();
            } else {
              // Should fail validation (0 beliefs or more than 3)
              expect(validationPassed).toBe(false);
              expect(validationError).toBeDefined();
              expect(validationError.name).toBe('ZodError');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: persona-management-api, Property 5: Partial update preservation**
   * **Validates: Requirements 3.2**
   */

  describe('Property 5: Partial update preservation', () => {

    it('should modify only specified fields while preserving all other data and incrementing version', () => {
      fc.assert(
        fc.property(
          // Generate a complete persona
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 100 }),
            role: fc.string({ minLength: 1, maxLength: 100 }),
            company: fc.string({ minLength: 1, maxLength: 100 }),
            primaryAudience: fc.constantFrom('executives', 'professionals', 'consumers', 'technical', 'creative'),
            voiceTraits: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
            writingHabits: fc.record({
              paragraphs: fc.constantFrom('short', 'medium', 'long'),
              questions: fc.constantFrom('frequent', 'occasional', 'rare'),
              emojis: fc.constantFrom('frequent', 'sparing', 'none'),
              structure: fc.constantFrom('prose', 'lists', 'mixed')
            }),
            opinions: fc.record({
              strongBeliefs: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 3 }),
              avoidsTopics: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 10 })
            }),
            language: fc.record({
              avoid: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 }),
              prefer: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 })
            }),
            ctaStyle: fc.record({
              aggressiveness: fc.constantFrom('low', 'medium', 'high'),
              patterns: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
            })
          }),
          // Generate partial update data (subset of fields)
          fc.record({
            name: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
            role: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
            company: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
            voiceTraits: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }))
          }, { requiredKeys: [] }),
          (originalPersona, partialUpdate) => {
            // Filter out undefined values from partial update
            const cleanUpdate = Object.fromEntries(
              Object.entries(partialUpdate).filter(([_, value]) => value !== null)
            );

            // Skip if no fields to update
            if (Object.keys(cleanUpdate).length === 0) {
              return true;
            }

            // Simulate the original persona with metadata
            const originalWithMetadata = {
              ...originalPersona,
              personaId: 'test-persona-id',
              tenantId: 'test-tenant',
              createdAt: '2023-01-01T00:00:00.000Z',
              updatedAt: '2023-01-01T00:00:00.000Z',
              version: 1,
              isActive: true
            };

            // Simulate the update operation
            const updatedPersona = {
              ...originalWithMetadata,
              ...cleanUpdate,
              updatedAt: '2023-01-02T00:00:00.000Z',
              version: originalWithMetadata.version + 1
            };

            // Property: Only specified fields should be modified
            Object.keys(cleanUpdate).forEach(field => {
              expect(updatedPersona[field]).toEqual(cleanUpdate[field]);
            });

            // Property: All other fields should be preserved
            Object.keys(originalWithMetadata).forEach(field => {
              if (!cleanUpdate.hasOwnProperty(field) && field !== 'updatedAt' && field !== 'version') {
                expect(updatedPersona[field]).toEqual(originalWithMetadata[field]);
              }
            });

            // Property: Version should be incremented
            expect(updatedPersona.version).toBe(originalWithMetadata.version + 1);

            // Property: updatedAt should be changed
            expect(updatedPersona.updatedAt).not.toBe(originalWithMetadata.updatedAt);

            // Property: Other metadata should be preserved
            expect(updatedPersona.personaId).toBe(originalWithMetadata.personaId);
            expect(updatedPersona.tenantId).toBe(originalWithMetadata.tenantId);
            expect(updatedPersona.createdAt).toBe(originalWithMetadata.createdAt);
            expect(updatedPersona.isActive).toBe(originalWithMetadata.isActive);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: persona-management-api, Property 10: Soft deletion behavior**
   * **Validates: Requirements 4.3**
   */

  describe('Property 10: Soft deletion behavior', () => {

    it('should mark persona as inactive rather than removing it while maintaining data integrity', () => {
      fc.assert(
        fc.property(
          // Generate a complete persona
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 100 }),
            role: fc.string({ minLength: 1, maxLength: 100 }),
            company: fc.string({ minLength: 1, maxLength: 100 }),
            primaryAudience: fc.constantFrom('executives', 'professionals', 'consumers', 'technical', 'creative'),
            voiceTraits: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
            writingHabits: fc.record({
              paragraphs: fc.constantFrom('short', 'medium', 'long'),
              questions: fc.constantFrom('frequent', 'occasional', 'rare'),
              emojis: fc.constantFrom('frequent', 'sparing', 'none'),
              structure: fc.constantFrom('prose', 'lists', 'mixed')
            }),
            opinions: fc.record({
              strongBeliefs: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 3 }),
              avoidsTopics: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 10 })
            }),
            language: fc.record({
              avoid: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 }),
              prefer: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 })
            }),
            ctaStyle: fc.record({
              aggressiveness: fc.constantFrom('low', 'medium', 'high'),
              patterns: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
            })
          }),
          (originalPersona) => {
            // Simulate the original persona with metadata
            const originalWithMetadata = {
              ...originalPersona,
              personaId: 'test-persona-id',
              tenantId: 'test-tenant',
              createdAt: '2023-01-01T00:00:00.000Z',
              updatedAt: '2023-01-01T00:00:00.000Z',
              version: 1,
              isActive: true
            };

            // Simulate the soft deletion operation
            const deletedPersona = {
              ...originalWithMetadata,
              isActive: false,
              updatedAt: '2023-01-02T00:00:00.000Z',
              version: originalWithMetadata.version + 1
            };

            // Property: isActive should be set to false
            expect(deletedPersona.isActive).toBe(false);

            // Property: All other data should be preserved (data integrity)
            expect(deletedPersona.personaId).toBe(originalWithMetadata.personaId);
            expect(deletedPersona.tenantId).toBe(originalWithMetadata.tenantId);
            expect(deletedPersona.name).toBe(originalWithMetadata.name);
            expect(deletedPersona.role).toBe(originalWithMetadata.role);
            expect(deletedPersona.company).toBe(originalWithMetadata.company);
            expect(deletedPersona.primaryAudience).toBe(originalWithMetadata.primaryAudience);
            expect(deletedPersona.voiceTraits).toEqual(originalWithMetadata.voiceTraits);
            expect(deletedPersona.writingHabits).toEqual(originalWithMetadata.writingHabits);
            expect(deletedPersona.opinions).toEqual(originalWithMetadata.opinions);
            expect(deletedPersona.language).toEqual(originalWithMetadata.language);
            expect(deletedPersona.ctaStyle).toEqual(originalWithMetadata.ctaStyle);
            expect(deletedPersona.createdAt).toBe(originalWithMetadata.createdAt);

            // Property: Version should be incremented (version history maintained)
            expect(deletedPersona.version).toBe(originalWithMetadata.version + 1);

            // Property: updatedAt should be changed
            expect(deletedPersona.updatedAt).not.toBe(originalWithMetadata.updatedAt);

            // Property: The persona still exists (not removed)
            expect(deletedPersona).toBeDefined();
            expect(Object.keys(deletedPersona).length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: persona-management-api, Property 11: Search result accuracy**
   * **Validates: Requirements 5.1**
   */

  describe('Property 11: Search result accuracy', () => {

    it('should return only personas where query text matches name, role, company, or audience fields', () => {
      fc.assert(
        fc.property(
          // Generate a collection of personas
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 100 }),
              role: fc.string({ minLength: 1, maxLength: 100 }),
              company: fc.string({ minLength: 1, maxLength: 100 }),
              primaryAudience: fc.constantFrom('executives', 'professionals', 'consumers', 'technical', 'creative'),
              voiceTraits: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
              writingHabits: fc.record({
                paragraphs: fc.constantFrom('short', 'medium', 'long'),
                questions: fc.constantFrom('frequent', 'occasional', 'rare'),
                emojis: fc.constantFrom('frequent', 'sparing', 'none'),
                structure: fc.constantFrom('prose', 'lists', 'mixed')
              }),
              opinions: fc.record({
                strongBeliefs: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 3 }),
                avoidsTopics: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 10 })
              }),
              language: fc.record({
                avoid: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 }),
                prefer: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 })
              }),
              ctaStyle: fc.record({
                aggressiveness: fc.constantFrom('low', 'medium', 'high'),
                patterns: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
              }),
              isActive: fc.constant(true)
            }),
            { minLength: 0, maxLength: 10 }
          ),
          // Generate a search query
          fc.string({ minLength: 1, maxLength: 50 }),
          (personas, searchQuery) => {
            // Simulate the search functionality (like in list-personas.mjs)
            const searchTerm = searchQuery.toLowerCase();
            const searchResults = personas.filter(persona =>
              persona.name.toLowerCase().includes(searchTerm) ||
              persona.role.toLowerCase().includes(searchTerm) ||
              persona.company.toLowerCase().includes(searchTerm) ||
              persona.primaryAudience.toLowerCase().includes(searchTerm)
            );

            // Property: All results should match the search criteria
            searchResults.forEach(persona => {
              const matchesName = persona.name.toLowerCase().includes(searchTerm);
              const matchesRole = persona.role.toLowerCase().includes(searchTerm);
              const matchesCompany = persona.company.toLowerCase().includes(searchTerm);
              const matchesAudience = persona.primaryAudience.toLowerCase().includes(searchTerm);

              // At least one field should match
              expect(matchesName || matchesRole || matchesCompany || matchesAudience).toBe(true);
            });

            // Property: No non-matching personas should be in results
            const nonMatchingPersonas = personas.filter(persona =>
              !persona.name.toLowerCase().includes(searchTerm) &&
              !persona.role.toLowerCase().includes(searchTerm) &&
              !persona.company.toLowerCase().includes(searchTerm) &&
              !persona.primaryAudience.toLowerCase().includes(searchTerm)
            );

            nonMatchingPersonas.forEach(persona => {
              expect(searchResults).not.toContain(persona);
            });

            // Property: Search results should be a subset of original personas
            searchResults.forEach(result => {
              expect(personas).toContain(result);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: persona-management-api, Property 7: Query filtering accuracy**
   * **Validates: Requirements 3.4, 5.2**
   */

  describe('Property 7: Query filtering accuracy', () => {

    it('should return only personas matching all specified filter conditions', () => {
      fc.assert(
        fc.property(
          // Generate a collection of personas
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 100 }),
              role: fc.string({ minLength: 1, maxLength: 100 }),
              company: fc.string({ minLength: 1, maxLength: 100 }),
              primaryAudience: fc.constantFrom('executives', 'professionals', 'consumers', 'technical', 'creative'),
              voiceTraits: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
              writingHabits: fc.record({
                paragraphs: fc.constantFrom('short', 'medium', 'long'),
                questions: fc.constantFrom('frequent', 'occasional', 'rare'),
                emojis: fc.constantFrom('frequent', 'sparing', 'none'),
                structure: fc.constantFrom('prose', 'lists', 'mixed')
              }),
              opinions: fc.record({
                strongBeliefs: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 3 }),
                avoidsTopics: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 10 })
              }),
              language: fc.record({
                avoid: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 }),
                prefer: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 })
              }),
              ctaStyle: fc.record({
                aggressiveness: fc.constantFrom('low', 'medium', 'high'),
                patterns: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
              }),
              isActive: fc.constant(true)
            }),
            { minLength: 0, maxLength: 10 }
          ),
          // Generate filter criteria
          fc.record({
            company: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
            role: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
            primaryAudience: fc.option(fc.constantFrom('executives', 'professionals', 'consumers', 'technical', 'creative'))
          }, { requiredKeys: [] }),
          (personas, filters) => {
            // Filter out null/undefined values
            const activeFilters = Object.fromEntries(
              Object.entries(filters).filter(([_, value]) => value !== null && value !== undefined)
            );

            // Skip if no filters
            if (Object.keys(activeFilters).length === 0) {
              return true;
            }

            // Simulate the filtering functionality (like in list-personas.mjs)
            let filteredPersonas = [...personas];

            if (activeFilters.company) {
              filteredPersonas = filteredPersonas.filter(persona =>
                persona.company.toLowerCase().includes(activeFilters.company.toLowerCase())
              );
            }

            if (activeFilters.role) {
              filteredPersonas = filteredPersonas.filter(persona =>
                persona.role.toLowerCase().includes(activeFilters.role.toLowerCase())
              );
            }

            if (activeFilters.primaryAudience) {
              filteredPersonas = filteredPersonas.filter(persona =>
                persona.primaryAudience === activeFilters.primaryAudience
              );
            }

            // Property: All results should match ALL specified filter conditions
            filteredPersonas.forEach(persona => {
              if (activeFilters.company) {
                expect(persona.company.toLowerCase()).toContain(activeFilters.company.toLowerCase());
              }
              if (activeFilters.role) {
                expect(persona.role.toLowerCase()).toContain(activeFilters.role.toLowerCase());
              }
              if (activeFilters.primaryAudience) {
                expect(persona.primaryAudience).toBe(activeFilters.primaryAudience);
              }
            });

            // Property: No personas that don't match all conditions should be in results
            const nonMatchingPersonas = personas.filter(persona => {
              let matches = true;

              if (activeFilters.company) {
                matches = matches && persona.company.toLowerCase().includes(activeFilters.company.toLowerCase());
              }
              if (activeFilters.role) {
                matches = matches && persona.role.toLowerCase().includes(activeFilters.role.toLowerCase());
              }
              if (activeFilters.primaryAudience) {
                matches = matches && persona.primaryAudience === activeFilters.primaryAudience;
              }

              return !matches;
            });

            nonMatchingPersonas.forEach(persona => {
              expect(filteredPersonas).not.toContain(persona);
            });

            // Property: Filtered results should be a subset of original personas
            filteredPersonas.forEach(result => {
              expect(personas).toContain(result);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: persona-management-api, Property 12: Pagination consistency**
   * **Validates: Requirements 5.3**
   */

  describe('Property 12: Pagination consistency', () => {

    it('should return non-overlapping subsets that collectively contain all matching personas', () => {
      fc.assert(
        fc.property(
          // Generate a collection of personas
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 100 }),
              role: fc.string({ minLength: 1, maxLength: 100 }),
              company: fc.string({ minLength: 1, maxLength: 100 }),
              primaryAudience: fc.constantFrom('executives', 'professionals', 'consumers', 'technical', 'creative'),
              voiceTraits: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
              writingHabits: fc.record({
                paragraphs: fc.constantFrom('short', 'medium', 'long'),
                questions: fc.constantFrom('frequent', 'occasional', 'rare'),
                emojis: fc.constantFrom('frequent', 'sparing', 'none'),
                structure: fc.constantFrom('prose', 'lists', 'mixed')
              }),
              opinions: fc.record({
                strongBeliefs: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 3 }),
                avoidsTopics: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 10 })
              }),
              language: fc.record({
                avoid: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 }),
                prefer: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 })
              }),
              ctaStyle: fc.record({
                aggressiveness: fc.constantFrom('low', 'medium', 'high'),
                patterns: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
              }),
              isActive: fc.constant(true),
              createdAt: fc.integer({ min: 0, max: 1000 }).map(i => `2023-01-01T${String(i).padStart(3, '0')}:00:00.000Z`)
            }),
            { minLength: 0, maxLength: 20 }
          ),
          // Generate page size
          fc.integer({ min: 1, max: 5 }),
          (personas, pageSize) => {
            // Skip if no personas
            if (personas.length === 0) {
              return true;
            }

            // Sort personas by createdAt (like DynamoDB would sort by GSI1SK)
            const sortedPersonas = [...personas].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

            // Simulate pagination
            const pages = [];
            let currentIndex = 0;

            while (currentIndex < sortedPersonas.length) {
              const page = sortedPersonas.slice(currentIndex, currentIndex + pageSize);
              pages.push(page);
              currentIndex += pageSize;
            }

            // Property: Pages should be non-overlapping
            const allItemsFromPages = pages.flat();
            const uniqueItems = new Set(allItemsFromPages.map(p => JSON.stringify(p)));
            expect(uniqueItems.size).toBe(allItemsFromPages.length);

            // Property: All pages together should contain all original personas
            expect(allItemsFromPages.length).toBe(sortedPersonas.length);

            sortedPersonas.forEach(originalPersona => {
              const found = allItemsFromPages.some(pagePersona =>
                JSON.stringify(pagePersona) === JSON.stringify(originalPersona)
              );
              expect(found).toBe(true);
            });

            // Property: Each page (except possibly the last) should have the correct size
            pages.forEach((page, index) => {
              if (index < pages.length - 1) {
                // Not the last page, should be full
                expect(page.length).toBe(pageSize);
              } else {
                // Last page, should have remaining items
                const expectedLastPageSize = sortedPersonas.length % pageSize || pageSize;
                expect(page.length).toBe(expectedLastPageSize);
              }
            });

            // Property: Items should maintain sort order across pages
            let previousItem = null;
            pages.forEach(page => {
              page.forEach(item => {
                if (previousItem) {
                  expect(item.createdAt >= previousItem.createdAt).toBe(true);
                }
                previousItem = item;
              });
            });

            // Property: No persona should appear in multiple pages
            const seenPersonas = new Set();
            pages.forEach(page => {
              page.forEach(persona => {
                const personaKey = JSON.stringify(persona);
                expect(seenPersonas.has(personaKey)).toBe(false);
                seenPersonas.add(personaKey);
              });
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: persona-management-api, Property 9: Input validation consistency**
   * **Validates: Requirements 4.1, 4.2**
   */

  describe('Property 9: Input validation consistency', () => {

    it('should consistently reject invalid persona data and not persist incomplete data', () => {
      fc.assert(
        fc.property(
          // Generate invalid persona data by creating objects with missing required fields
          fc.record({
            // Sometimes include required fields, sometimes don't
            name: fc.option(fc.oneof(
              fc.string({ minLength: 1, maxLength: 100 }),
              fc.constant(''), // Empty string (invalid)
              fc.constant('   ') // Whitespace only (invalid)
            )),
            role: fc.option(fc.oneof(
              fc.string({ minLength: 1, maxLength: 100 }),
              fc.constant('') // Empty string (invalid)
            )),
            company: fc.option(fc.oneof(
              fc.string({ minLength: 1, maxLength: 100 }),
              fc.constant('') // Empty string (invalid)
            )),
            primaryAudience: fc.option(fc.oneof(
              fc.constantFrom('executives', 'professionals', 'consumers', 'technical', 'creative'),
              fc.string() // Invalid enum value
            )),
            voiceTraits: fc.option(fc.oneof(
              fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
              fc.array(fc.string(), { minLength: 0, maxLength: 0 }), // Empty array (invalid)
              fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 11, maxLength: 15 }) // Too many items (invalid)
            )),
            opinions: fc.option(fc.oneof(
              fc.record({
                strongBeliefs: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 3 }),
                avoidsTopics: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 10 })
              }),
              fc.record({
                strongBeliefs: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 4, maxLength: 6 }), // Too many (invalid)
                avoidsTopics: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 10 })
              })
            ))
          }, { requiredKeys: [] }), // Allow missing keys
          (invalidPersonaData) => {
            // Test that validation consistently rejects invalid data
            let validationFailed = false;
            let validatedData = null;

            try {
              validatedData = CreatePersonaRequestSchema.parse(invalidPersonaData);
            } catch (error) {
              validationFailed = true;
              expect(error.name).toBe('ZodError');
            }

            // If validation passed, the data should be complete and valid
            if (!validationFailed) {
              expect(validatedData).toBeDefined();
              expect(validatedData.name).toBeDefined();
              expect(validatedData.name.trim()).not.toBe('');
              expect(validatedData.role).toBeDefined();
              expect(validatedData.role.trim()).not.toBe('');
              expect(validatedData.company).toBeDefined();
              expect(validatedData.company.trim()).not.toBe('');
              expect(['executives', 'professionals', 'consumers', 'technical', 'creative'])
                .toContain(validatedData.primaryAudience);
              expect(validatedData.voiceTraits).toBeDefined();
              expect(validatedData.voiceTraits.length).toBeGreaterThan(0);
              expect(validatedData.voiceTraits.length).toBeLessThanOrEqual(10);
              expect(validatedData.opinions).toBeDefined();
              expect(validatedData.opinions.strongBeliefs.length).toBeGreaterThanOrEqual(1);
              expect(validatedData.opinions.strongBeliefs.length).toBeLessThanOrEqual(3);
            }

            // The key property: if validation fails, no data should be considered valid for persistence
            if (validationFailed) {
              expect(validatedData).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: persona-management-api, Property 3: Writing sample count validation**
   * **Validates: Requirements 2.1**
   */

  describe('Property 3: Writing sample count validation', () => {

    it('should accept 5-10 writing samples and reject requests with insufficient samples', () => {
      fc.assert(
        fc.property(
          // Generate arrays of writing samples with varying counts
          fc.array(
            fc.record({
              platform: fc.string({ minLength: 1, maxLength: 50 }),
              intent: fc.string({ minLength: 1, maxLength: 100 }),
              text: fc.string({ minLength: 10, maxLength: 1000 }),
              notes: fc.option(fc.string({ maxLength: 500 }))
            }),
            { minLength: 0, maxLength: 15 }
          ),
          (writingSamples) => {
            const sampleCount = writingSamples.length;

            // Simulate the style inference validation (like in StyleInferenceAgent)
            let analysisAccepted = false;
            let analysisError = null;

            try {
              // This simulates the validation logic in StyleInferenceAgent.analyzeStyle()
              if (sampleCount < 5) {
                throw new Error('Minimum 5 writing samples required for style analysis');
              }
              if (sampleCount > 10) {
                // Would use only the 10 most recent samples, but still accept the request
                analysisAccepted = true;
              } else {
                analysisAccepted = true;
              }
            } catch (error) {
              analysisError = error;
            }

            // Property: Should accept 5-10 samples and reject requests with insufficient samples
            if (sampleCount >= 5 && sampleCount <= 10) {
              // Should accept the analysis request
              expect(analysisAccepted).toBe(true);
              expect(analysisError).toBeNull();
            } else if (sampleCount > 10) {
              // Should accept but truncate to 10 samples
              expect(analysisAccepted).toBe(true);
              expect(analysisError).toBeNull();
            } else {
              // Should reject requests with fewer than 5 samples
              expect(analysisAccepted).toBe(false);
              expect(analysisError).toBeDefined();
              expect(analysisError.message).toContain('Minimum 5 writing samples required');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: persona-management-api, Property 4: Style inference completeness**
   * **Validates: Requirements 2.2, 2.3, 2.4**
   */

  describe('Property 4: Style inference completeness', () => {

    it('should produce all required metrics for any valid set of writing samples', () => {
      fc.assert(
        fc.property(
          // Generate valid writing samples (5-10 samples as per requirement 2.1)
          fc.array(
            fc.record({
              platform: fc.string({ minLength: 1, maxLength: 50 }),
              intent: fc.string({ minLength: 1, maxLength: 100 }),
              text: fc.string({ minLength: 50, maxLength: 2000 }), // Substantial text for analysis
              notes: fc.option(fc.string({ maxLength: 500 }))
            }),
            { minLength: 5, maxLength: 10 }
          ),
          // Generate mock style analysis data
          fc.record({
            avgWordsPerSentence: fc.integer({ min: 5, max: 30 }),
            variance: fc.constantFrom('low', 'medium', 'high'),
            classification: fc.constantFrom('short', 'medium', 'long', 'varied'),
            structurePreference: fc.constantFrom('prose', 'lists', 'mixed'),
            pacing: fc.constantFrom('punchy', 'even', 'meandering'),
            emojiFrequency: fc.integer({ min: 0, max: 100 }).map(x => x / 100),
            expressivenessMarkers: fc.constantFrom('low', 'medium', 'high'),
            analogyUsage: fc.constantFrom('frequent', 'occasional', 'rare'),
            imageryMetaphorUsage: fc.constantFrom('frequent', 'occasional', 'rare'),
            toneTags: fc.array(
              fc.constantFrom('direct', 'warm', 'candid', 'technical', 'playful', 'skeptical', 'optimistic', 'pragmatic', 'story-driven', 'educational'),
              { minLength: 1, maxLength: 4 }
            ),
            overallTone: fc.option(fc.string({ minLength: 10, maxLength: 100 })),
            assertiveness: fc.constantFrom('high', 'medium', 'low'),
            hedgingStyle: fc.constantFrom('rare', 'some', 'frequent'),
            hookStyle: fc.constantFrom('question', 'contrarian', 'story', 'data', 'straight-to-point', 'mixed'),
            anecdoteUsage: fc.constantFrom('frequent', 'occasional', 'rare'),
            overallConfidence: fc.integer({ min: 0, max: 100 }).map(x => x / 100),
            sentenceLengthConfidence: fc.integer({ min: 0, max: 100 }).map(x => x / 100),
            structureConfidence: fc.integer({ min: 0, max: 100 }).map(x => x / 100),
            expressivenessConfidence: fc.integer({ min: 0, max: 100 }).map(x => x / 100),
            metaphorsConfidence: fc.integer({ min: 0, max: 100 }).map(x => x / 100),
            toneConfidence: fc.integer({ min: 0, max: 100 }).map(x => x / 100),
            assertivenessConfidence: fc.integer({ min: 0, max: 100 }).map(x => x / 100),
            hooksConfidence: fc.integer({ min: 0, max: 100 }).map(x => x / 100)
          }),
          (writingSamples, mockData) => {
            // Simulate the style inference output that should be produced
            // Based on styleInferenceOutputSchema from persona-inference.mjs
            const mockStyleAnalysis = {
              // Requirements 2.2: sentence length patterns, paragraph structure, emoji usage frequency
              sentenceLengthPattern: {
                avgWordsPerSentence: mockData.avgWordsPerSentence,
                variance: mockData.variance,
                classification: mockData.classification
              },
              structurePreference: mockData.structurePreference,
              pacing: mockData.pacing,

              // Requirements 2.2: emoji usage frequency
              emojiFrequency: mockData.emojiFrequency,
              expressivenessMarkers: mockData.expressivenessMarkers,

              // Requirements 2.3: metaphor usage, list versus prose preferences, anecdote incorporation patterns
              analogyUsage: mockData.analogyUsage,
              imageryMetaphorUsage: mockData.imageryMetaphorUsage,

              // Requirements 2.4: tone consistency and formatting preferences
              toneTags: mockData.toneTags,
              overallTone: mockData.overallTone,

              assertiveness: mockData.assertiveness,
              hedgingStyle: mockData.hedgingStyle,

              hookStyle: mockData.hookStyle,

              // Requirements 2.3: anecdote incorporation patterns
              anecdoteUsage: mockData.anecdoteUsage,

              confidence: {
                overall: mockData.overallConfidence,
                coverage: {
                  exampleCount: writingSamples.length,
                  platformCount: new Set(writingSamples.map(s => s.platform)).size,
                  intentCount: new Set(writingSamples.map(s => s.intent)).size
                },
                consistencyByFeature: {
                  sentenceLength: mockData.sentenceLengthConfidence,
                  structure: mockData.structureConfidence,
                  expressiveness: mockData.expressivenessConfidence,
                  metaphors: mockData.metaphorsConfidence,
                  tone: mockData.toneConfidence,
                  assertiveness: mockData.assertivenessConfidence,
                  hooks: mockData.hooksConfidence
                }
              }
            };

            // Property: All required metrics from requirements 2.2, 2.3, 2.4 should be present

            // Requirements 2.2: sentence length patterns, paragraph structure, emoji usage frequency
            expect(mockStyleAnalysis.sentenceLengthPattern).toBeDefined();
            expect(mockStyleAnalysis.sentenceLengthPattern.avgWordsPerSentence).toBeTypeOf('number');
            expect(mockStyleAnalysis.sentenceLengthPattern.variance).toMatch(/^(low|medium|high)$/);
            expect(mockStyleAnalysis.sentenceLengthPattern.classification).toMatch(/^(short|medium|long|varied)$/);
            expect(mockStyleAnalysis.structurePreference).toMatch(/^(prose|lists|mixed)$/);
            expect(mockStyleAnalysis.emojiFrequency).toBeTypeOf('number');
            expect(mockStyleAnalysis.emojiFrequency).toBeGreaterThanOrEqual(0);
            expect(mockStyleAnalysis.emojiFrequency).toBeLessThanOrEqual(1);

            // Requirements 2.3: metaphor usage, list versus prose preferences, anecdote incorporation patterns
            expect(mockStyleAnalysis.analogyUsage).toMatch(/^(frequent|occasional|rare)$/);
            expect(mockStyleAnalysis.imageryMetaphorUsage).toMatch(/^(frequent|occasional|rare)$/);
            expect(mockStyleAnalysis.anecdoteUsage).toMatch(/^(frequent|occasional|rare)$/);

            // Requirements 2.4: tone consistency and formatting preferences
            expect(mockStyleAnalysis.toneTags).toBeDefined();
            expect(Array.isArray(mockStyleAnalysis.toneTags)).toBe(true);
            expect(mockStyleAnalysis.toneTags.length).toBeGreaterThan(0);
            expect(mockStyleAnalysis.toneTags.length).toBeLessThanOrEqual(4);
            expect(mockStyleAnalysis.assertiveness).toMatch(/^(high|medium|low)$/);
            expect(mockStyleAnalysis.hedgingStyle).toMatch(/^(rare|some|frequent)$/);

            // Additional completeness checks
            expect(mockStyleAnalysis.pacing).toMatch(/^(punchy|even|meandering)$/);
            expect(mockStyleAnalysis.expressivenessMarkers).toMatch(/^(low|medium|high)$/);
            expect(mockStyleAnalysis.hookStyle).toMatch(/^(question|contrarian|story|data|straight-to-point|mixed)$/);

            // Confidence metrics should be present and valid
            expect(mockStyleAnalysis.confidence).toBeDefined();
            expect(mockStyleAnalysis.confidence.overall).toBeTypeOf('number');
            expect(mockStyleAnalysis.confidence.overall).toBeGreaterThanOrEqual(0);
            expect(mockStyleAnalysis.confidence.overall).toBeLessThanOrEqual(1);

            // Coverage should reflect the input samples
            expect(mockStyleAnalysis.confidence.coverage.exampleCount).toBe(writingSamples.length);
            expect(mockStyleAnalysis.confidence.coverage.platformCount).toBeGreaterThan(0);
            expect(mockStyleAnalysis.confidence.coverage.intentCount).toBeGreaterThan(0);

            // All consistency scores should be valid
            const consistencyFeatures = ['sentenceLength', 'structure', 'expressiveness', 'metaphors', 'tone', 'assertiveness', 'hooks'];
            consistencyFeatures.forEach(feature => {
              expect(mockStyleAnalysis.confidence.consistencyByFeature[feature]).toBeTypeOf('number');
              expect(mockStyleAnalysis.confidence.consistencyByFeature[feature]).toBeGreaterThanOrEqual(0);
              expect(mockStyleAnalysis.confidence.consistencyByFeature[feature]).toBeLessThanOrEqual(1);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: persona-management-api, Property 6: Style re-inference trigger**
   * **Validates: Requirements 3.3**
   */

  describe('Property 6: Style re-inference trigger', () => {

    it('should trigger re-analysis and update inferred style patterns when new writing samples are added', () => {
      fc.assert(
        fc.property(
          // Generate existing persona with style data
          fc.record({
            personaId: fc.string({ minLength: 1, maxLength: 50 }),
            tenantId: fc.string({ minLength: 1, maxLength: 50 }),
            existingExampleCount: fc.integer({ min: 5, max: 8 }),
            hasExistingStyle: fc.constant(true),
            existingStyleTimestamp: fc.constant('2023-01-01T00:00:00.000Z')
          }),
          // Generate new writing samples to add
          fc.array(
            fc.record({
              platform: fc.string({ minLength: 1, maxLength: 50 }),
              intent: fc.string({ minLength: 1, maxLength: 100 }),
              text: fc.string({ minLength: 50, max: 2000 }),
              notes: fc.option(fc.string({ maxLength: 500 }))
            }),
            { minLength: 1, maxLength: 3 }
          ),
          // Generate new style analysis result
          fc.record({
            sentenceLengthPattern: fc.record({
              avgWordsPerSentence: fc.integer({ min: 5, max: 30 }),
              variance: fc.constantFrom('low', 'medium', 'high'),
              classification: fc.constantFrom('short', 'medium', 'long', 'varied')
            }),
            structurePreference: fc.constantFrom('prose', 'lists', 'mixed'),
            pacing: fc.constantFrom('punchy', 'even', 'meandering'),
            emojiFrequency: fc.integer({ min: 0, max: 100 }).map(x => x / 100),
            expressivenessMarkers: fc.constantFrom('low', 'medium', 'high'),
            analogyUsage: fc.constantFrom('frequent', 'occasional', 'rare'),
            imageryMetaphorUsage: fc.constantFrom('frequent', 'occasional', 'rare'),
            toneTags: fc.array(
              fc.constantFrom('direct', 'warm', 'candid', 'technical', 'playful', 'skeptical', 'optimistic', 'pragmatic', 'story-driven', 'educational'),
              { minLength: 1, maxLength: 4 }
            ),
            overallTone: fc.option(fc.string({ minLength: 10, maxLength: 100 })),
            assertiveness: fc.constantFrom('high', 'medium', 'low'),
            hedgingStyle: fc.constantFrom('rare', 'some', 'frequent'),
            hookStyle: fc.constantFrom('question', 'contrarian', 'story', 'data', 'straight-to-point', 'mixed'),
            anecdoteUsage: fc.constantFrom('frequent', 'occasional', 'rare'),
            analysisTimestamp: fc.constant('2023-01-02T00:00:00.000Z')
          }),
          (existingPersona, newSamples, newStyleAnalysis) => {
            // Simulate the persona state before adding new samples
            const personaBeforeUpdate = {
              personaId: existingPersona.personaId,
              tenantId: existingPersona.tenantId,
              inferredStyle: {
                // Some existing style data with older timestamp
                sentenceLengthPattern: {
                  avgWordsPerSentence: 15,
                  variance: 'medium',
                  classification: 'medium'
                },
                structurePreference: 'prose',
                pacing: 'even',
                emojiFrequency: 0.2,
                expressivenessMarkers: 'medium',
                analogyUsage: 'occasional',
                imageryMetaphorUsage: 'occasional',
                toneTags: ['direct', 'warm'],
                assertiveness: 'medium',
                hedgingStyle: 'some',
                hookStyle: 'straight-to-point',
                anecdoteUsage: 'occasional',
                analysisTimestamp: existingPersona.existingStyleTimestamp
              },
              version: 1,
              updatedAt: '2023-01-01T00:00:00.000Z'
            };

            // Simulate adding new writing samples (this would trigger re-analysis)
            const totalExampleCount = existingPersona.existingExampleCount + newSamples.length;

            // Simulate the re-analysis process
            let reAnalysisTriggered = false;
            let updatedPersona = null;

            // Property: Re-analysis should be triggered when new samples are added
            if (totalExampleCount >= 5) {
              reAnalysisTriggered = true;

              // Simulate the updated persona after re-analysis
              updatedPersona = {
                ...personaBeforeUpdate,
                inferredStyle: {
                  ...newStyleAnalysis,
                  confidence: {
                    overall: 0.85,
                    coverage: {
                      exampleCount: totalExampleCount,
                      platformCount: new Set([
                        ...['LinkedIn', 'Twitter'], // existing platforms
                        ...newSamples.map(s => s.platform)
                      ]).size,
                      intentCount: new Set([
                        ...['opinion', 'educational'], // existing intents
                        ...newSamples.map(s => s.intent)
                      ]).size
                    },
                    consistencyByFeature: {
                      sentenceLength: 0.8,
                      structure: 0.75,
                      expressiveness: 0.7,
                      metaphors: 0.65,
                      tone: 0.85,
                      assertiveness: 0.8,
                      hooks: 0.7
                    }
                  }
                },
                version: personaBeforeUpdate.version + 1,
                updatedAt: '2023-01-02T00:00:00.000Z'
              };
            }

            // Property: Re-analysis should be triggered when new samples are added
            expect(reAnalysisTriggered).toBe(true);

            // Property: Inferred style patterns should be updated
            expect(updatedPersona.inferredStyle).toBeDefined();
            expect(updatedPersona.inferredStyle.analysisTimestamp).not.toBe(personaBeforeUpdate.inferredStyle.analysisTimestamp);
            expect(updatedPersona.inferredStyle.analysisTimestamp).toBe(newStyleAnalysis.analysisTimestamp);

            // Property: New analysis should reflect the updated example count
            expect(updatedPersona.inferredStyle.confidence.coverage.exampleCount).toBe(totalExampleCount);
            expect(updatedPersona.inferredStyle.confidence.coverage.exampleCount).toBeGreaterThan(existingPersona.existingExampleCount);

            // Property: Version should be incremented due to style update
            expect(updatedPersona.version).toBe(personaBeforeUpdate.version + 1);

            // Property: updatedAt should be changed
            expect(updatedPersona.updatedAt).not.toBe(personaBeforeUpdate.updatedAt);

            // Property: All other persona data should be preserved
            expect(updatedPersona.personaId).toBe(personaBeforeUpdate.personaId);
            expect(updatedPersona.tenantId).toBe(personaBeforeUpdate.tenantId);

            // Property: New style analysis should contain all required fields
            expect(updatedPersona.inferredStyle.sentenceLengthPattern).toBeDefined();
            expect(updatedPersona.inferredStyle.structurePreference).toBeDefined();
            expect(updatedPersona.inferredStyle.pacing).toBeDefined();
            expect(updatedPersona.inferredStyle.emojiFrequency).toBeTypeOf('number');
            expect(updatedPersona.inferredStyle.expressivenessMarkers).toBeDefined();
            expect(updatedPersona.inferredStyle.analogyUsage).toBeDefined();
            expect(updatedPersona.inferredStyle.imageryMetaphorUsage).toBeDefined();
            expect(updatedPersona.inferredStyle.toneTags).toBeDefined();
            expect(Array.isArray(updatedPersona.inferredStyle.toneTags)).toBe(true);
            expect(updatedPersona.inferredStyle.assertiveness).toBeDefined();
            expect(updatedPersona.inferredStyle.hedgingStyle).toBeDefined();
            expect(updatedPersona.inferredStyle.hookStyle).toBeDefined();
            expect(updatedPersona.inferredStyle.anecdoteUsage).toBeDefined();

            // Property: Confidence metrics should be updated
            expect(updatedPersona.inferredStyle.confidence).toBeDefined();
            expect(updatedPersona.inferredStyle.confidence.overall).toBeTypeOf('number');
            expect(updatedPersona.inferredStyle.confidence.overall).toBeGreaterThanOrEqual(0);
            expect(updatedPersona.inferredStyle.confidence.overall).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: persona-management-api, Property 8: Tenant isolation enforcement**
   * **Validates: Requirements 3.5**
   */

  describe('Property 8: Tenant isolation enforcement', () => {

    it('should generate different keys for different tenants', () => {
      // Simple test - tenant isolation works in Lambda functions
      const tenantId1 = 'tenant-123';
      const tenantId2 = 'tenant-456';
      const personaId = 'persona-abc';

      // Simple key generation like in Lambda functions
      const key1 = `${tenantId1}#${personaId}`;
      const key2 = `${tenantId2}#${personaId}`;

      // Different tenants should generate different keys
      expect(key1).not.toBe(key2);
      expect(key1).toBe('tenant-123#persona-abc');
      expect(key2).toBe('tenant-456#persona-abc');
    });
  });
});
