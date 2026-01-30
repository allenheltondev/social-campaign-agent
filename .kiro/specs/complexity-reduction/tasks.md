# Complexity Reduction - Tasks

## Phase 1: Foundation (Low Risk)

- [x] ### 1. Consolidate Logger Instances
**Dependencies:** None

Simplify logging by using a single logger instance across the entire application.

**Steps:**
1. Update `utils/logger.mjs` to export single logger instance
2. Update all imports in models (persona.mjs, brand.mjs, campaign.mjs, asset.mjs)
3. Update all imports in Lambda functions
4. Update all imports in utility files
5. Remove SERVICE_NAMES constant
6. Run tests to verify logging still works

**Files to modify:**
- `utils/logger.mjs`
- `models/persona.mjs`
- `models/brand.mjs`
- `models/campaign.mjs`
- `models/asset.mjs`
- `models/social-post.mjs`
- All Lambda function files (30+ files)
- `utils/asset-pool-builder.mjs`
- `utils/asset-resolver.mjs`
- `utils/asset-security.mjs`

**Validation:**
- All tests pass
- Logs still appear in CloudWatch
- No import errors

---

- [x] ### 2. Remove api-response.mjs Utility
**Dependencies:** None

Remove the simple wrapper utility and inline response formatting.

**Steps:**
1. Identify all usages of `formatResponse` function
2. Replace with inline response object creation
3. Delete `utils/api-response.mjs`
4. Run tests to verify responses unchanged

**Files to modify:**
- All Lambda function files (30+ files)
- Delete `utils/api-response.mjs`

**Validation:**
- All tests pass
- API responses have correct format
- Status codes unchanged

---

- [x] ### 3. Consolidate Default Configuration Files
**Dependencies:** None

Merge brand-defaults.mjs and persona-defaults.mjs into single file.

**Steps:**
1. Create `utils/defaults.mjs` with both functions
2. Update imports in `functions/persona/create-persona.mjs`
3. Update imports in `functions/brand/create-brand.mjs`
4. Delete `utils/brand-defaults.mjs`
5. Delete `utils/persona-defaults.mjs`
6. Run tests

**Files to modify:**
- Create `utils/defaults.mjs`
- `functions/persona/create-persona.mjs`
- `functions/brand/create-brand.mjs`
- Delete `utils/brand-defaults.mjs`
- Delete `utils/persona-defaults.mjs`

**Validation:**
- All tests pass
- Default values applied correctly

---

- [x] ### 4. Simplify Schema Definitions
**Dependencies:** None

Remove pre-defined schema variations and use inline transformations.

**Steps:**
1. Remove CreateXRequestSchema exports from models/persona.mjs
2. Remove UpdateXRequestSchema exports from models/persona.mjs
3. Remove DTOSchema exports from models/persona.mjs
4. Repeat for models/brand.mjs
5. Repeat for models/campaign.mjs
6. Repeat for models/asset.mjs
7. Keep only base schemas
8. Run tests (they may need updates)

**Files to modify:**
- `models/persona.mjs`
- `models/brand.mjs`
- `models/campaign.mjs`
- `models/asset.mjs`

**Validation:**
- Base schemas still exported
- No breaking changes to schema structure

---

- [x] ### 5. Clean Up Template Configuration
**Dependencies:** None

Remove unused configuration and consolidate IAM policies.

**Steps:**
1. Audit GSI2 usage across codebase
2. Remove GSI2 from DynamoDB table if unused
3. Review and consolidate duplicate IAM policies
4. Remove unused environment variables
5. Simplify esbuild configuration if possible
6. Run `sam build` to verify template validity

**Files to modify:**
- `template.yaml`

**Validation:**
- `sam build` succeeds
- No deployment errors
- All Lambda functions still work

---

## Phase 2: Core Refactoring (Medium Risk)

- [x] ### 6. Simplify Model Transformations
**Dependencies:** Task 1 (Logger consolidation)

Consolidate duplicate transformation methods in models.

**Steps:**
1. In models/persona.mjs:
   - Rename `transformFromDynamoDB` to `fromDynamoDB`
   - Remove `_transformFromDynamoDB` (consolidate into one)
   - Rename `_transformToDynamoDB` to `toDynamoDB`
   - Update all internal references
2. Repeat for models/brand.mjs
3. Repeat for models/campaign.mjs
4. Repeat for models/asset.mjs
5. Run tests

**Files to modify:**
- `models/persona.mjs`
- `models/brand.mjs`
- `models/campaign.mjs`
- `models/asset.mjs`
- `models/social-post.mjs`

**Validation:**
- All tests pass
- Data transformations work correctly
- No data corruption

---

- [x] ### 7. Remove Validation Wrapper Functions
**Dependencies:** Task 4 (Schema simplification)

Remove v

**Files to modify:**
- `models/persona.mjs`
- `models/brand.mjs`
- `models/campaign.mjs`
- `models/asset.mjs`

**Validation:**
- Models still export base schemas
- No validation logic lost

---

- [x] ### 8. Remove validation.mjs Utility
**Dependencies:** Task 7 (Remove validation wrappers)

Delete the validation utility file entirely.

**Steps:**
1. Verify no remaining imports of validation.mjs
2. Delete `utils/validation.mjs`
3. Run tests

**Files to modify:**
- Delete `utils/validation.mjs`

**Validation:**
- No import errors
- All tests pass

---

- [x] ### 9. Remove Error Handler Utility
**Dependencies:** Task 1 (Logger consolidation)

Remove custom error classes and error handler utility.

**Steps:**
1. Remove all imports of `createStandardizedError` from Lambda functions
2. Remove all imports of `ModelError`, `BrandError` classes
3. Remove all imports of error codes
4. Delete `utils/error-handler.mjs`
5. Lambda handlers will be updated in Phase 3

**Files to modify:**
- Delete `utils/error-handler.mjs`
- Remove imports from Lambda functions (will be replaced in Phase 3)

**Validation:**
- File deleted successfully
- Ready for Phase 3 handler updates

---

## Phase 3: Handler Simplification (Higher Risk)

- [x] ### 10. Refactor Persona Lambda Handlers
**Dependencies:** Tasks 1, 2, 4, 7, 9

Simplify all persona-related Lambda handlers.

**Steps:**
1. Update `functions/persona/create-persona.mjs`:
   - Use Zod directly for validation
   - Inline response formatting
   - Simplify error handling
2. Update `functions/persona/get-persona.mjs`
3. Update `functions/persona/update-persona.mjs`
4. Update `functions/persona/delete-persona.mjs`
5. Update `functions/persona/list-personas.mjs`
6. Update `functions/persona/start-style-analysis.mjs`
7. Update `functions/persona/examples/create-example.mjs`
8. Update `functions/persona/examples/list-examples.mjs`
9. Update `functions/persona/examples/delete-example.mjs`
10. Update `functions/persona/events/style-analysis-complete.mjs`
11. Run tests after each file

**Files to modify:**
- `functions/persona/create-persona.mjs`
- `functions/persona/get-persona.mjs`
- `functions/persona/update-persona.mjs`
- `functions/persona/delete-persona.mjs`
- `functions/persona/list-personas.mjs`
- `functions/persona/start-style-analysis.mjs`
- `functions/persona/examples/create-example.mjs`
- `functions/persona/examples/list-examples.mjs`
- `functions/persona/examples/delete-example.mjs`
- `functions/persona/events/style-analysis-complete.mjs`

**Validation:**
- All persona tests pass
- API responses unchanged
- Error handling works correctly

---

- [x] ### 11. Refactor Brand Lambda Handlers
**Dependencies:** Tasks 1, 2, 4, 7, 9

Simplify all brand-related Lambda handlers.

**Steps:**
1. Update `functions/brand/create-brand.mjs`
2. Update `functions/brand/get-brand.mjs`
3. Update `functions/brand/update-brand.mjs`
4. Update `functions/brand/delete-brand.mjs`
5. Update `functions/brand/list-brands.mjs`
6. Update `functions/brand/assets/upload-asset.mjs`
7. Update `functions/brand/assets/list-assets.mjs`
8. Update `functions/brand/assets/delete-asset.mjs`
9. Run tests after each file

**Files to modify:**
- `functions/brand/create-brand.mjs`
- `functions/brand/get-brand.mjs`
- `functions/brand/update-brand.mjs`
- `functions/brand/delete-brand.mjs`
- `functions/brand/list-brands.mjs`
- `functions/brand/assets/upload-asset.mjs`
- `functions/brand/assets/list-assets.mjs`
- `functions/brand/assets/delete-asset.mjs`

**Validation:**
- All brand tests pass
- API responses unchanged
- Asset operations work correctly

---

- [x] ### 12. Refactor Campaign Lambda Handlers
**Dependencies:** Tasks 1, 2, 4, 7, 9

Simplify all campaign-related Lambda handlers.

**Steps:**
1. Update `functions/campaign/create-campaign.mjs`
2. Update `functions/campaign/get-campaign.mjs`
3. Update `functions/campaign/update-campaign.mjs`
4. Update `functions/campaign/delete-campaign.mjs`
5. Update `functions/campaign/list-campaigns.mjs`
6. Update `functions/campaign/list-posts.mjs`
7. Update `functions/campaign/update-status.mjs`
8. Update `functions/campaign/build-campaign.mjs`
9. Update `functions/campaign/events/workflow-completion.mjs`
10. Run tests after each file

**Files to modify:**
- `functions/campaign/create-campaign.mjs`
- `functions/campaign/get-campaign.mjs`
- `functions/campaign/update-campaign.mjs`
- `functions/campaign/delete-campaign.mjs`
- `functions/campaign/list-campaigns.mjs`
- `functions/campaign/list-posts.mjs`
- `functions/campaign/update-status.mjs`
- `functions/campaign/build-campaign.mjs`
- `functions/campaign/events/workflow-completion.mjs`

**Validation:**
- All campaign tests pass
- Campaign creation workflow works
- Status updates work correctly

---

- [x] ### 13. Refactor Asset Lambda Handlers
**Dependencies:** Tasks 1, 2, 4, 7, 9

Simplify all asset-related Lambda handlers.

**Steps:**
1. Update `functions/assets/create-asset.mjs`
2. Update `functions/assets/get-asset.mjs`
3. Update `functions/assets/update-asset.mjs`
4. Update `functions/assets/delete-asset.mjs`
5. Update `functions/assets/list-assets.mjs`
6. Update `functions/assets/approve-asset.mjs`
7. Update `functions/assets/upload-complete.mjs`
8. Run tests after each file

**Files to modify:**
- `functions/assets/create-asset.mjs`
- `functions/assets/get-asset.mjs`
- `functions/assets/update-asset.mjs`
- `functions/assets/delete-asset.mjs`
- `functions/assets/list-assets.mjs`
- `functions/assets/approve-asset.mjs`
- `functions/assets/upload-complete.mjs`

**Validation:**
- All asset tests pass
- Asset upload workflow works
- Approval workflow works correctly

---

- [x] ### 14. Move Business Logic Out of Models
**Dependencies:** Tasks 10, 11, 12, 13

Extract business logic from models into Lambda handlers or service functions.

**Steps:**
1. In models/persona.mjs:
   - Move `enrichForCampaign` logic to campaign handlers
   - Move `mergeEffectiveRestrictions` logic to campaign handlers
   - Keep only CRUD operations
2. In models/brand.mjs:
   - Move `extractCadenceDefaults` to campaign handlers
   - Move `extractAssetRequirements` to campaign handlers
   - Move `extractContentRestrictions` to campaign handlers
   - Keep only CRUD operations
3. Update campaign handlers to include this logic
4. Run tests

**Files to modify:**
- `models/persona.mjs`
- `models/brand.mjs`
- `functions/campaign/build-campaign.mjs`
- `functions/agents/campaign-planner.mjs`
- `functions/agents/content-generator.mjs`

**Validation:**
- All tests pass
- Campaign generation still works
- Business logic preserved

---

## Phase 4: Final Validation

- [x] ### 15. Run Full Test Suite
**Dependencies:** All previous tasks

Comprehensive testing of all changes.

**Steps:**
1. Run `npm test` for full test suite
2. Fix any failing tests
3. Run `sam build` to verify template
4. Deploy to dev environment
5. Manual API testing of all endpoints
6. Verify CloudWatch logs
7. Check DynamoDB data integrity

**Validation:**
- 100% test pass rate
- All API endpoints work
- No data corruption
- Logs appear correctly
- Performance unchanged

---

- [x] ### 16. Update Documentation
**Dependencies:** Task 15

Update any documentation affected by changes.

**Steps:**
1. Update README.md if needed
2. Update inline code comments if needed
3. Update any API documentation
4. Document simplified patterns for team

**Files to modify:**
- `README.md` (if needed)
- Inline documentation

**Validation:**
- Documentation accurate
- Examples work correctly

---

## Summary

**Total Tasks:** 16
**Estimated Time:** 13-17 hours
**Risk Level:** Low to Medium (incremental approach)

**Key Milestones:**
- Phase 1 Complete: Foundation simplified (3 hours)
- Phase 2 Complete: Core refactoring done (7 hours)
- Phase 3 Complete: Handlers simplified (13 hours)
- Phase 4 Complete: Fully validated (17 hours)

**Success Metrics:**
- 20-30% code reduction achieved
- 100% test pass rate maintained
- Zero API breaking changes
- Improved code maintainability
