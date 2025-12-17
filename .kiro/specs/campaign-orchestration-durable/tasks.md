# Implementation Plan

- [x] 1. Update existing campaign creation to use direct Lambda invocation


  - Modify create-campaign.mjs to invoke Build Campaign functioctly using Lambda SDK
  - Remove EventBridge dependency for campaign workflow initiation
  - Add IAM permissions for Lambda invocation
  - Update response handling for asynchronous invocation
  - _Requirements: 1.1, 2.1, 2.3, 2.4_

- [ ] 1.1 Write property test for workflow initiation and completion consistency
  - **Property 1: Workflow initiation and completion consistency**
  - **Validates: Requirements 1.1, 1.4**

- [x] 1.2 Write property test for direct invocation security and validation

  - **Property 3: Direct invocation security and validation**
  - **Validates: Requirements 2.2, 2.3, 2.4**


- [x] 2. Create Build Campaign durable function with core workflow



  - Install and configure AWS Durable Execution SDK for JavaScript
  - Create build-campaign.mjs with durable function wrapper
  - Implement basic workflow structure with save, plan, generate, approve steps
  - Add input validation and error handling for event payload
  - Configure durable function settings (timeout, retention)
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 7.1, 7.4_

- [x] 2.1 Write property test for checkpoint and recovery consistency

  - **Property 2: Checkpoint and recovery consistency**
  - **Validates: Requirements 1.2, 1.3, 7.1, 7.4**

- [x] 2.2 Write property test for retry and error handling consistency

  - **Property 6: Retry and error handling consistency**
  - **Validates: Requirements 1.5, 3.4, 4.4, 6.3, 6.5**

- [x] 3. Refactor Campaign Planner Agent to export run function




  - Extract agent logic from EventBridge handler into run function
  - Update function to accept tenantId and campaign data directly
  - Modify to return structured results with success/error status
  - Remove EventBridge dependencies and event parsing
  - Keep existing agent logic and tool integrations intact
  - _Requirements: 3.1, 3.2, 6.1, 6.2, 6.4_

- [x] 3.1 Write property test for agent integration consistency

  - **Property 4: Agent integration consistency**
  - **Validates: Requirements 3.1, 3.2, 4.1, 6.2, 6.4**

- [x] 3.2 Write property test for input validation consistency

  - **Property 7: Input validation consistency**
  - **Validates: Requirements 3.5, 6.3**

- [x] 4. Refactor Content Generator Agent to export run function





  - Extract agent logic from EventBridge handler into run function
  - Update function to accept tenantId and post data directly
  - Modify to return structured results with generated content
  - Remove EventBridge dependencies and event parsing
  - Keep existing agent logic and tool integrations intact
  - _Requirements: 4.1, 6.1, 6.2, 6.4_

- [-] 5. Implement campaign planning step in durable function


  - Add step to call Campaign Planner run function directly
  - Import and invoke planner with campaign configuration
  - Handle planner results and validate post plan structure
  - Create checkpoint after successful planning
  - Add retry logic for planning failures
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5.1 Write property test for workflow progression and status consistency

  - **Property 5: Workflow progression and status consistency**
  - **Validates: Requirements 3.3, 4.2, 4.3**

- [x] 6. Implement content generation steps with parallel processing





  - Add map operation to process posts in parallel with concurrency limits
  - Import and invoke Content Generator run function for each post
  - Handle individual post results and update post status in DynamoDB
  - Create checkpoints for each completed post
  - Aggregate results and handle partial failures
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 6.1 Write property test for parallel processing consistency


  - **Property 10: Parallel processing consistency**
  - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

- [x] 7. Implement approval callback workflow




  - Create callback for campaign approval with timeout configuration
  - Generate secure approval URL with JWT token
  - Suspend durable function execution waiting for callback
  - Handle approval, rejection, and timeout scenarios
  - Update campaign status based on approval decision
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 7.1 Write property test for callback workflow consistency

  - **Property 8: Callback workflow consistency**
  - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [x] 7.2 Write property test for callback timeout handling

  - **Property 9: Callback timeout handling**
  - **Validates: Requirements 5.6**

- [x] 8. Create approval callback handler function





  - Create approval-callback.mjs for handling approval submissions
  - Validate JWT tokens and callback permissions
  - Submit callback results to resume durable execution
  - Add security validation and tenant isolation
  - Handle callback errors and invalid submissions
  - _Requirements: 5.3, 9.3, 9.5_

- [ ] 9. Add comprehensive error handling and monitoring
  - Implement structured error logging with correlation IDs
  - Add CloudWatch metrics for workflow steps and performance
  - Create alerts for workflow failures and performance issues
  - Add workflow state querying and debugging capabilities
  - Implement security logging for unauthorized access attempts
  - _Requirements: 7.2, 7.3, 7.5, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 9.1 Write property test for workflow state and monitoring consistency
  - **Property 11: Workflow state and monitoring consistency**
  - **Validates: Requirements 7.2, 7.3, 7.5, 10.1, 10.2, 10.5**

- [ ] 9.2 Write property test for security and tenant isolation consistency
  - **Property 12: Security and tenant isolation consistency**
  - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

- [ ] 9.3 Write property test for performance and alerting consistency
  - **Property 13: Performance and alerting consistency**
  - **Validates: Requirements 10.3, 10.4**

- [x] 10. Update SAM template for durable function deployment




  - Add BuildCampaignFunction with durable configuration
  - Configure IAM policies for Lambda invocation and DynamoDB access
  - Add ApprovalCallbackFunction with API Gateway integration
  - Update CreateCampaignFunction with Lambda invoke permissions
  - Configure CloudWatch alarms and monitoring
  - _Requirements: 2.1, 6.1_

- [x] 11. Checkpoint - Ensure all tests pass




  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Integration testing and end-to-end validation
  - Test complete campaign creation through approval workflow
  - Validate durable function checkpoint and recovery behavior
  - Test parallel content generation with various concurrency scenarios
  - Verify approval callback security and timeout handling
  - Test error recovery and retry mechanisms
  - _Requirements: All integration requirements_

- [ ] 12.1 Write integration tests for complete workflow
  - Test end-to-end campaign orchestration with durable functions
  - Validate checkpoint creation and recovery scenarios
  - Test approval workflows and callback handling
  - _Requirements: All workflow requirements_

- [ ] 13. Final checkpoint - Complete system validation
  - Ensure all tests pass, ask the user if questions arise.
