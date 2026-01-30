# API Simplification - Tasks

## Phase 1: Remove Filtering from List Endpoints (COMPLETED)

- [x] 1. Update Asset Model
  - [x] 1.1 Remove contentType and createdAfter parameters from list() method
  - [x] 1.2 Remove FilterExpression for contentType
  - [x] 1.3 Remove client-side filtering for createdAfter
  - [x] 1.4 Simplify method signature and query logic

- [x] 2. Update Brand Model
  - [x] 2.1 Remove search and status parameters from list() method
  - [x] 2.2 Remove any FilterExpression or client-side filtering
  - [x] 2.3 Simplify method signature and query logic

- [x] 3. Update Campaign Model
  - [x] 3.1 Remove status, brandId, and personaId parameters from list() method
  - [x] 3.2 Remove FilterExpression and expression attribute logic
  - [x] 3.3 Simplify method signature and query logic

- [x] 4. Update Persona Model
  - [x] 4.1 Remove search, company, role, and primaryAudience parameters from list() method
  - [x] 4.2 Keep isActive FilterExpression (soft-delete filter)
  - [x] 4.3 Remove all client-side filtering logic
  - [x] 4.4 Update QueryPersonasRequestSchema to remove filter fields

- [x] 5. Update SocialPost Model
  - [x] 5.1 Remove platform parameter from findByCampaign() method
  - [x] 5.2 Simplify KeyConditionExpression to not filter by platform

- [x] 6. Update List Assets Handler
  - [x] 6.1 Remove contentType and createdAfter from queryParams extraction
  - [x] 6.2 Remove validation for filter parameters
  - [x] 6.3 Update logging to not reference filters
  - [x] 6.4 Update model method call to not pass filters

- [x] 7. Update List Brands Handler
  - [x] 7.1 Remove search and status from queryParams extraction
  - [x] 7.2 Update model method call to not pass filters

- [x] 8. Update List Campaigns Handler
  - [x] 8.1 Remove status, brandId, and personaId from queryParams extraction
  - [x] 8.2 Update model method call to not pass filters

- [x] 9. Update List Personas Handler
  - [x] 9.1 Remove filter parameters from queryParams validation
  - [x] 9.2 Update model method call to not pass filters

- [x] 10. Update List Posts Handler
  - [x] 10.1 Remove platform and persona from queryParams extraction
  - [x] 10.2 Remove client-side filtering logic for persona
  - [x] 10.3 Update model method call to not pass platform filter

- [x] 11. Update OpenAPI Spec
  - [x] 11.1 Remove filter parameters from GET /personas
  - [x] 11.2 Remove filter parameters from GET /brands
  - [x] 11.3 Remove filter parameters from GET /assets
  - [x] 11.4 Remove filter parameters from GET /campaigns
  - [x] 11.5 Remove filter parameters from GET /campaigns/{campaignId}/posts
  - [x] 11.6 Update endpoint descriptions to reflect simplified behavior

- [x] 12. Update Tests
  - [x] 12.1 Review and update campaign-list-multiple-status.test.mjs
  - [x] 12.2 Review and update collection-response-format-consistency.test.mjs
  - [x] 12.3 Remove filter-specific test cases from other test files
  - [x] 12.4 Verify pagination tests still pass

- [x] 13. Build and Verify
  - [x] 13.1 Run sam build to verify template correctness
  - [x] 13.2 Run test suite to verify all tests pass
  - [x] 13.3 Verify no references to removed filter parameters remain

## Phase 2: Remove Approval/Decision Workflow

- [x] 14. Delete Lambda Handler Files
  - [x] 14.1 Delete functions/campaign/approval-callback.mjs
  - [x] 14.2 Delete functions/campaign/approve-post.mjs
  - [x] 14.3 Delete functions/campaign/make-decision.mjs
  - [x] 14.4 Delete functions/campaign/make-post-decision.mjs
  - [x] 14.5 Delete functions/campaign/bulk-post-decisions.mjs

- [x] 15. Remove SAM Template Resources
  - [x] 15.1 Remove ApproveCampaignFunction and its API event
  - [x] 15.2 Remove CampaignDecisionFunction and its API event
  - [x] 15.3 Remove PostDecisionFunction and its API event
  - [x] 15.4 Remove BulkPostDecisionsFunction and its API event
  - [x] 15.5 Remove ApprovalCallbackFunction if it exists
  - [x] 15.6 Remove any IAM permissions specific to approval workflow

- [x] 16. Remove OpenAPI Endpoints
  - [x] 16.1 Remove POST /campaigns/{campaignId}/approve
  - [x] 16.2 Remove POST /campaigns/{campaignId}/decisions
  - [x] 16.3 Remove POST /campaigns/{campaignId}/posts/{postId}/decisions
  - [x] 16.4 Remove POST /campaigns/{campaignId}/posts/decisions

- [x] 17. Update Campaign Model
  - [x] 17.1 Remove approval-related status values from StatusSchema (awaiting_review, approved, rejected, approval_timeout, needs_revision)
  - [x] 17.2 Remove ApprovalStatusSchema entirely
  - [x] 17.3 Remove ApprovalMetadataSchema entirely
  - [x] 17.4 Remove any approval-related fields from campaign data structure
  - [x] 17.5 Remove callbackId field handling
  - [x] 17.6 Simplify status to: planning, generating, completed, failed, cancelled

- [x] 18. Update Campaign Status Utility
  - [x] 18.1 Remove AWAITING_REVIEW from CAMPAIGN_STATUSES
  - [x] 18.2 Update STATUS_TRANSITIONS to remove awaiting_review paths
  - [x] 18.3 Update getNextStatusFromPosts to not return AWAITING_REVIEW
  - [x] 18.4 Remove needs_review post status handling

- [x] 19. Update Build Campaign Workflow
  - [x] 19.1 Remove approval callback logic from build-campaign.mjs
  - [x] 19.2 Remove waitForCallback step
  - [x] 19.3 Remove pending_approval status setting
  - [x] 19.4 Remove needs_revision status handling
  - [x] 19.5 Simplify workflow to go directly from generating to completed/failed

- [x] 20. Update Schedule Blender Agent
  - [x] 20.1 Remove approved and pending_approval status filtering from fetchAllActivePosts
  - [x] 20.2 Update to use simplified campaign statuses

- [x] 21. Delete Approval Tests
  - [x] 21.1 Delete tests/unit/approval-callback.test.mjs
  - [x] 21.2 Remove approval-related test cases from other test files
  - [x] 21.3 Update campaign status tests to reflect simplified statuses

- [x] 22. Update Documentation
  - [x] 22.1 Update CAMPAIGN_API.md to remove approval workflow documentation
  - [x] 22.2 Update QUICK_START_CAMPAIGNS.md if it references approval
  - [x] 22.3 Update TESTING_CAMPAIGNS.md to remove approval test scenarios

- [x] 23. Build and Verify
  - [x] 23.1 Run sam build to verify template correctness
  - [x] 23.2 Run test suite to verify all tests pass
  - [x] 23.3 Search codebase for any remaining references to approval/decision logic
