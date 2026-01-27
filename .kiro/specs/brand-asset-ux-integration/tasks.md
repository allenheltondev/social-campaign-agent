# Implementation Plan: Brand Asset UX Integration

## Overview

This implementation plan extends the existing brand management, asset management, and campaign creation systems with simple workflows for associating assets with brands and automatically including brand assets in campaigns. The implementation focuses on data model extensions, API enhancements, and campaign planner improvements to create a cohesive user experience.

## Tasks

- [x] 1. Extend brand data model and API for asset associations
  - [x] 1.1 Update Brand model to support asset associations
    - Add assets array field to Brand schema with internal/external asset support
    - Implement validation for asset association structure
    - _Requirements: 1.1, 1.3, 1.4_

  - [x] 1.2 Write property test for brand-asset association management
    - **Property 1: Brand-Asset Association Management**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**

  - [x] 1.3 Update create-brand and update-brand functions to handle asset associations
    - Accept optional assets array in request payload
    - Validate internal asset references exist and belong to tenant
    - Validate external asset HTTPS URLs, content types, and descriptions
    - Store asset associations within brand entity
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.4 Write unit tests for brand asset validation
    - Test internal asset existence validation
    - Test tenant ownership validation
    - Test external URL HTTPS validation
    - Test content type validation
    - Test description length validation
    - _Requirements: 1.2, 1.3_

  - [x] 1.5 Update get-brand function to include asset metadata
    - Retrieve brand with asset associations
    - Fetch metadata for internal assets from Asset service
    - Include complete asset information in response
    - _Requirements: 1.5_

  - [x] 1.6 Implement brand asset disassociation logic
    - Allow removing assets from brand without deleting underlying assets
    - Preserve internal assets and external URLs after disassociation
    - _Requirements: 1.6_

- [x] 2. Implement asset pool builder service
  - [x] 2.1 Create AssetPoolBuilder utility service
    - Implement function to construct campaign asset pools
    - Accept brand ID and campaign-specific assets as input
    - Retrieve brand entity and extract asset associations
    - Merge brand assets with campaign-specific assets
    - Tag assets with source metadata (brand vs campaign)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.2 Write property test for campaign asset pool construction
    - **Property 2: Campaign Asset Pool Construction**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

  - [x] 2.3 Implement asset pool validation
    - Validate all internal asset references exist
    - Validate external asset URLs are accessible
    - Handle missing or invalid assets gracefully
    - Return validation errors with actionable messages
    - _Requirements: 1.2, 1.3_

- [x] 3. Enhance campaign creation to use asset pool builder
  - [x] 3.1 Update create-campaign function to construct asset pools
    - Call AssetPoolBuilder when brand ID is provided
    - Accept campaign-specific assets in request payload
    - Support both internal asset references and external asset definitions
    - Store complete assetPool in campaign entity
    - _Requirements: 2.1, 2.3, 2.4, 2.5_

  - [x] 3.2 Write unit tests for campaign creation with assets
    - Test campaign with brand ID includes brand assets
    - Test campaign without brand ID uses only campaign assets
    - Test merging of brand and campaign assets
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Implement asset pool immutability for existing campaigns
    - Ensure brand asset updates don't modify existing campaigns
    - New campaigns reflect current brand asset state
    - Existing campaign asset pools remain unchanged
    - _Requirements: 2.4_

- [x] 4. Enhance campaign planner with asset selection logic
  - [x] 4.1 Update campaign planner to receive asset context
    - Pass complete asset pool to planner
    - Include asset metadata (descriptions, content types)
    - _Requirements: 3.1_

  - [x] 4.2 Write property test for planning context completeness
    - **Property 3: Planning Context Completeness**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x] 4.3 Update campaign planner prompt with asset selection guidance
    - Instruct planner to evaluate asset descriptions
    - Consider content topics when selecting assets
    - Generate posts without assets when no suitable match exists
    - _Requirements: 3.2, 3.3_

  - [x] 4.4 Write unit tests for asset selection
    - Test assets are passed to planner
    - Test posts can be generated without assets
    - _Requirements: 3.2, 3.3_

- [x] 5. Update OpenAPI specification
  - [x] 5.1 Add brand asset association schemas
    - Define BrandAssetAssociation schema
    - Update CreateBrandRequest and UpdateBrandRequest schemas
    - Update Brand response schema
    - _Requirements: 1.1_

  - [x] 5.2 Update campaign creation schemas
    - Add assets array to CreateCampaignRequest
    - Add assetPool to Campaign response schema
    - _Requirements: 2.3, 2.5_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Implementation builds on existing brand, asset, and campaign infrastructure
- Focus on simple v1 workflows: associate assets with brands, automatically include in campaigns
