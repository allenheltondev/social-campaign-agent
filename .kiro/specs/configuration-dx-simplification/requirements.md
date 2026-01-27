# Configuration DX Simplification - Requirements

## Overview
Analyze and reduce developer/user experience friction in brand and persona configuration. The current system requires extensive upfront configuration with many nested objects and arrays, which may create barriers to adoption and slow down the initial setup process.

## Problem Statement
Users need to configure brands and personas before they can generate campaigns. The current configuration requirements are comprehensive but potentially overwhelming:

**Persona Configuration Requires:**
- Basic identity (name, role, company, audience)
- Voice traits array (1-10 items)
- Writing habits object (4 nested properties)
- Opinions object (strong beliefs array, avoid topics array)
- Language preferences (avoid/prefer arrays)
- CTA style object (aggressiveness + patterns array)
- Writing examples (5-10 samples for style inference)

**Brand Configuration Requires:**
- Basic identity (name, ethos, core values array)
- Voice guidelines object (tone, style, messaging arrays)
- Content standards object (quality requirements, restrictions)
- Visual identity object (color palette, typography, imagery)
- Optional: Platform guidelines (complex nested object)
- Optional: Audience profile, pillars, claims policy, CTA library, approval policy
- Optional: Asset associations (internal/external with metadata)

## User Stories

### US-1: Quick Start Persona Creation
**As a** new user
**I want to** create a basic persona with minimal required fields
**So that** I can start generating content quickly and refine the persona later

**Acceptance Criteria:**
- 1.1 User can create a persona with only name, role, company, and audience
- 1.2 System provides sensible defaults for voice traits, writing habits, opinions, language, and CTA style
- 1.3 User can optionally provide additional details during creation
- 1.4 User can update persona with more details after initial creation
- 1.5 System indicates which fields are using defaults vs user-provided values

### US-2: Quick Start Brand Creation
**As a** new user
**I want to** create a basic brand with minimal required fields
**So that** I can start generating campaigns quickly and refine the brand later

**Acceptance Criteria:**
- 2.1 User can create a brand with only name, ethos, and 1-3 core values
- 2.2 System provides sensible defaults for voice guidelines, content standards, and visual identity
- 2.3 User can optionally provide additional details during creation
- 2.4 User can update brand with more details after initial creation
- 2.5 System indicates which fields are using defaults vs user-provided values

### US-3: Progressive Disclosure of Configuration
**As a** user
**I want to** see configuration options organized by importance and frequency of use
**So that** I'm not overwhelmed by all options at once

**Acceptance Criteria:**
- 3.1 API documentation clearly separates required vs optional fields
- 3.2 Optional nested objects (platformGuidelines, audienceProfile, etc.) are truly optional
- 3.3 System provides clear guidance on when to configure optional fields
- 3.4 Default values are documented and sensible for common use cases

### US-4: Simplified Asset Management
**As a** user
**I want to** associate assets with brands without complex metadata
**So that** I can quickly add visual elements to my brand

**Acceptance Criteria:**
- 4.1 User can add internal assets with just assetId
- 4.2 User can add external assets with just URL and description
- 4.3 Optional metadata (categories, usage intent, isDefault) can be added later
- 4.4 System provides sensible defaults for asset metadata

### US-5: Persona Style Inference Flexibility
**As a** user
**I want to** create a persona without providing writing examples upfront
**So that** I can start using the persona immediately

**Acceptance Criteria:**
- 5.1 User can create persona without writing examples
- 5.2 System uses declared voice traits and writing habits when no examples exist
- 5.3 User can add writing examples later to improve style inference
- 5.4 System clearly indicates when style is inferred vs declared

### US-6: Configuration Templates
**As a** user
**I want to** start from pre-configured templates
**So that** I don't have to understand all configuration options

**Acceptance Criteria:**
- 6.1 System provides persona templates (e.g.,
-10 examples for style inference before persona is useful
4. **Complex nested objects**: Writing habits, opinions, language, CTA style all have multiple required sub-fields
5. **No defaults**: Every field must be explicitly provided

### Brand Configuration Friction Points
1. **Too many required fields**: 7 required fields with nested objects
2. **Array minimums**: Core values (1-10), tone (1-10), style (1-10), messaging (1-10), quality requirements (1-10)
3. **Complex nested objects**: Voice guidelines, content standards, visual identity all have multiple required sub-fields
4. **Asset complexity**: Asset associations require type discrimination and metadata
5. **Optional fields still complex**: Platform guidelines, audience profile, claims policy are optional but still complex when used

### Positive Aspects
1. **Comprehensive**: Current schema captures all necessary information for high-quality content generation
2. **Flexible**: Optional fields allow for customization
3. **Type-safe**: Zod validation ensures data integrity
4. **Well-documented**: OpenAPI spec provides clear documentation

## Proposed Solutions

### Solution 1: Make Most Fields Optional with Smart Defaults
- Reduce required fields to absolute minimum (name, role/ethos, audience)
- Provide intelligent defaults for all other fields based on audience type
- Allow users to override defaults as needed

### Solution 2: Introduce Configuration Levels
- **Basic**: Minimal required fields only
- **Standard**: Basic + commonly used optional fields
- **Advanced**: All fields available

### Solution 3: Template System
- Provide pre-configured templates for common use cases
- Allow users to start from template and customize
- Templates include all defaults pre-filled

### Solution 4: Simplified Asset Management
- Remove required metadata from asset associations
- Auto-populate addedAt and addedBy server-side
- Make categories, usage intent, and isDefault truly optional

### Solution 5: Deferred Style Inference
- Allow persona creation without writing examples
- Use declared traits until examples are provided
- Trigger style analysis only when examples are added

## Success Metrics
- Time to create first persona: < 2 minutes (currently ~10 minutes)
- Time to create first brand: < 3 minutes (currently ~15 minutes)
- Percentage of users who complete persona/brand setup: > 80% (currently ~40%)
- User satisfaction with configuration process: > 4/5 stars

## Dependencies
- None - this is a pure API/schema improvement

## Out of Scope
- Frontend UI changes (focus on API/schema only)
- Migration of existing data
- Changes to campaign generation logic
- Changes to content generation quality

## Technical Constraints
- Must maintain backward compatibility with existing data
- Must not reduce content generation quality
- Must preserve all validation rules for provided fields
- Must maintain type safety with Zod schemas

## Questions for User
1. What is the minimum information needed to generate acceptable content for a persona?
2. What is the minimum information needed to generate acceptable content for a brand?
3. Should we prioritize speed of setup or quality of initial output?
4. Are there specific use cases where comprehensive configuration is critical?
5. Would users prefer templates or smart defaults?
