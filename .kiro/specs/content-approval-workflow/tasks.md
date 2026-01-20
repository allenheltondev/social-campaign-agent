# Implementation Plan: Content Approval Workflow

## Overview

Implement a comprehensive content approval workflow system with campaign and post-level decisions, manual editing, AI regeneration with feedback, version history tracking, and decision history. The implementation extends existing campaign infrastructure with new Lambda functions, data models, and API endpoints.

## Tasks

- [x] 1. Create data models and schemas
  - Create ApprovalRecord model with Zod schema validation
  - Create PostVersion model with Zod schema validation
  - Update Campaign model to include approval metadata
  - Update SocialPost model to include approval and version metadata
  - Add validation for decision types (approved, rejected, needs_revision)
  - _Requirements: 1.1-1.6, 2.1-2.6, 3.1-3.4_

- [x] 2. Implement campaign decision endpoint
  - [x] 2.1 Create CampaignDecisionFunction Lambda handler
    - Accept decision (approved, rejected, needs_revision) with comments and feedback
    - Validate campaign exists and is in valid state for decisions
    - Validate campaign has callbackId (is waiting for approval)
    - Create ApprovalRecord for audit trail
    - Send decision to Step Functions using SendTaskSuccess with callbackId
    - Resume durable execution workflow in build-campaign
    - Emit EventBridge event for decision
    - _Requirements: 1.1-1.6_
    - _Note: This function sends the callback to Step Functions to resume the durable execution_

  - [ ]* 2.2 Write property tests for campaign decisions
    - **Property 1: Campaign Status Transitions**
    - **Property 3: Approval Status Update**
    - **Property 4: Rejection with Reason**
    - **Property 5: Revision Enables Regeneration**
    - **Property 6: Decision Event Emission**
    - **Validates: Requirements 1.1, 1.3, 1.4, 1.5, 1.6**

- [x] 3. Implement post decision endpoint
  - [x] 3.1 Create PostDecisionFunction Lambda handler
    - Accept decision for individual post with comments
    - Validate post exists and is in valid state
    - Update post approval status and metadata
    - Create ApprovalRecord for audit trail
    - Check if all campaign posts are approved and update campaign status
    - Emit EventBridge event for decision
    - _Requirements: 2.1-2.3, 6.4_

  - [ ]* 3.2 Write property tests for post decisions
    - **Property 7: Post Review Actions Availability**
    - **Property 8: Post Approval Metadata**
    - **Property 9: Post Rejection Recording**
    - **Property 23: Campaign Approval Aggregation**
    - **Validates: Requirements 2.1, 2.2, 2.3, 6.4**

- [x] 4. Implement post content editing
  - [x] 4.1 Create EditPostContentFunction Lambda handler
    - Accept edited content with change description
    - Validate content against platform constraints (character limits)
    - Create PostVersion record for original content
    - Update post with new content and mark as manually_edited
    - Increment version number
    - _Requirements: 2.4-2.6_

  - [ ]* 4.2 Write property tests for content editing
    - **Property 10: Manual Edit Preservation**
    - **Property 11: Content Validation**
    - **Property 14: Version History Preservation**
    - **Validates: Requirements 2.4, 2.5, 2.6, 3.3**

- [x] 5. Implement post regeneration
  - [x] 5.1 Create RegeneratePostFunction Lambda handler
    - Accept feedback for AI regeneration
    - Validate post hasn't exceeded max regeneration attempts
    - Create PostVersion record for current content
    - Emit EventBridge event t
 Storage**
    - **Property 20: Regeneration Feedback Inclusion**
    - **Property 21: Regeneration Counter Tracking**
    - **Property 22: Regeneration Limit Enforcement**
    - **Validates: Requirements 5.2, 5.3, 5.5, 5.6**

- [x] 6. Implement bulk post decisions
  - [x] 6.1 Create BulkPostDecisionsFunction Lambda handler
    - Accept array of post decisions
    - Validate all posts exist and are in valid states
    - Process decisions in parallel (up to 25 per batch)
    - Create ApprovalRecord for each decision
    - Update post statuses
    - Return success/failure count and results
    - Handle partial failures gracefully
    - _Requirements: 4.1-4.5_

  - [ ]* 6.2 Write property tests for bulk decisions
    - **Property 16: Bulk Decision Processing**
    - **Property 17: Bulk Decision Validation**
    - **Property 18: Partial Bulk Success**
    - **Property 19: Bulk Decision Metadata**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

- [x] 7. Implement decision history endpoint
  - [x] 7.1 Create GetDecisionHistoryFunction Lambda handler
    - Query ApprovalRecords by campaignId using GSI
    - Support pagination with limit and nextToken
    - Return decisions for both campaign and posts
    - Include reviewer information and timestamps
    - _Requirements: 3.4_

  - [ ]* 7.2 Write property tests for decision history
    - **Property 12: Decision History Recording**
    - **Property 15: Decision History Queryability**
    - **Property 28: Comment Storage**
    - **Property 29: Comment History Preservation**
    - **Validates: Requirements 3.1, 3.4, 8.1, 8.2, 8.4, 8.5**

- [x] 8. Implement post version history endpoint
  - [x] 8.1 Create GetPostVersionsFunction Lambda handler
    - Query PostVersions by postId using GSI
    - Return all versions with metadata (source, timestamps, editor info)
    - Include generation metadata for AI versions
    - Include edit metadata for manual versions
    - _Requirements: 3.3_

  - [ ]* 8.2 Write property tests for version history
    - **Property 14: Version History Preservation**
    - **Validates: Requirements 3.3, 5.4**

- [x] 9. Implement approval deadline management
  - [x] 9.1 Create CheckApprovalDeadlinesFunction scheduled Lambda
    - Run every hour via EventBridge schedule
    - Query campaigns with deadlines in the past
    - Filter for campaigns still in "awaiting_review" status
    - Update status to "approval_timeout"
    - Emit timeout events
    - _Requirements: 7.2_

  - [x] 9.2 Add deadline warning logic
    - Check for deadlines within 24 hours
    - Emit warning events for approaching deadlines
    - _Requirements: 7.3_

  - [ ]* 9.3 Write property tests for deadline management
    - **Property 25: Deadline Acceptance**
    - **Property 26: Deadline Timeout**
    - **Property 27: Deadline Warning Events**
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 10. Emit notification events
  - [x] 10.1 Update BuildCampaignFunction to emit notification events
    - Emit EventBridge event with DetailType "Notification"
    - Include notification payload with tenantId, type, title, url, message, metadata
    - Use existing notification handler from other project (no new function needed)
    - _Requirements: 6.5_
    - _Note: Simplified to use existing notification infrastructure_

  - [ ]* 10.2 Write property tests for notification events
    - **Property 24: Notification Event Emission**
    - **Validates: Requirements 6.5**

- [x] 11. Update OpenAPI specification
  - Add POST /campaigns/{id}/decisions endpoint
  - Add POST /campaigns/{id}/posts/{postId}/decisions endpoint
  - Add PUT /campaigns/{id}/posts/{postId}/content endpoint
  - Add POST /campaigns/{id}/posts/{postId}/regenerate endpoint
  - Add POST /campaigns/{id}/posts/decisions endpoint (bulk)
  - Add GET /campaigns/{id}/decisions endpoint
  - Add GET /campaigns/{id}/posts/{postId}/versions endpoint
  - Add request/response schemas for all endpoints
  - _Requirements: All_

- [x] 12. Update SAM template
  - Add CampaignDecisionFunction with API Gateway integration
  - Add PostDecisionFunction with API Gateway integration
  - Add EditPostContentFunction with API Gateway integration
  - Add RegeneratePostFunction with API Gateway integration
  - Add BulkPostDecisionsFunction with API Gateway integration
  - Add GetDecisionHistoryFunction with API Gateway integration
  - Add GetPostVersionsFunction with API Gateway integration
  - Add CheckApprovalDeadlinesFunction with EventBridge schedule
  - Add WebhookNotificationFunction with EventBridge trigger
  - Add DynamoDB GSI for approval records query by campaignId
  - Add DynamoDB GSI for post versions query by postId
  - Add EventBridge rules for decision events
  - _Requirements: All_

- [x] 13. Create platform constraint validation utility
  - Define character limits for each platform (Twitter: 280, LinkedIn: 3000, etc.)
  - Create validation function for post content
  - Add format validation (hashtags, mentions)
  - Export for use in edit and regeneration functions
  - _Requirements: 2.6_

- [x] 14. Update CampaignPlannerAgent
  - Set campaign status to "awaiting_review" after planning completes
  - Initialize approval metadata with post counts
  - _Requirements: 1.1_

- [x] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Bulk operations use DynamoDB BatchWriteItem for performance
- Version history uses TTL for automatic cleanup after 90 days
- Approval records use TTL for automatic cleanup after 90 days
- EventBridge handles async event delivery for notifications
- Webhook notifications include retry logic for reliability
