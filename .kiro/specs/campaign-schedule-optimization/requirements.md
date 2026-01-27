# Campaign Schedule Blending Requirements

## Introduction

When creating a new campaign, the system can optionally blend its posts with existing campaign posts to create a well-distributed schedule. An LLM agent analyzes all posts and reschedules them to avoid conflicts and maintain good cadence.

## Glossary

- **Schedule_Blending**: Mixing posts from a new campaign with existing campaign posts
- **Schedule_Agent**: An LLM that receives all posts and returns new scheduledAt timestamps
- **Active_Posts**: Posts from campaigns with status approved or awaiting_review

## Requirements

### Requirement 1

**User Story:** As an API user, I want to create a campaign with automatic schedule blending, so that new posts integrate smoothly with existing content.

#### Acceptance Criteria

1. WHEN creating a campaign with blendSchedule=true THEN the system SHALL wait for campaign planning to complete
1. WHEN planning completes THEN the system SHALL fetch all active posts from other campaigns
2. WHEN posts are fetched THEN the system SHALL call the Schedule_Agent with all posts and cadence rules
4. WHEN the agent returns new schedules THEN the system SHALL update all post scheduledAt timestamps
5. WHEN updates complete THEN the system SHALL return success with the campaign ID

### Requirement 2

**User Story:** As the Schedule_Agent, I want to receive all necessary context, so that I can create an optimal schedule.

#### Acceptance Criteria

1. WHEN the Schedule_Agent is invoked THEN it SHALL receive all posts with id, campaignId, personaId, platform, scheduledAt, and topic
2. WHEN receiving context THEN it SHALL get cadence rules (maxPostsPerDay, maxPostsPerWeek)
3. WHEN receiving context THEN it SHALL get the overall date range (earliest to latest scheduledAt)
4. WHEN receiving context THEN it SHALL get blackout dates if any exist
5. WHEN the agent responds THEN it SHALL return an array of {postId, newScheduledAt} objects

### Requirement 3

**User Story:** As a developer, I want the schedule blending to be simple and reliable, so that it's easy to maintain and debug.

#### Acceptance Criteria

1. WHEN schedule blending fails THEN the system SHALL leave all posts with their original schedules
2. WHEN the agent returns invalid timestamps THEN the system SHALL reject them and keep original schedules
3. WHEN updating posts THEN the system SHALL use batch updates for efficiency
4. WHEN errors occur THEN the system SHALL log clear error messages with context
5. WHEN blending completes THEN the system SHALL log how many posts were rescheduled

### Requirement 4

**User Story:** As a marketing manager, I want blended schedules to respect cadence limits, so that I don't overwhelm my audience.

#### Acceptance Criteria

1. WHEN the Schedule_Agent creates schedules THEN it SHALL ensure no day exceeds maxPostsPerDay
2. WHEN the Schedule_Agent creates schedules THEN it SHALL ensure no week exceeds maxPostsPerWeek
3. WHEN the Schedule_Agent creates schedules THEN it SHALL spread posts evenly across the date range
4. WHEN the Schedule_Agent creates schedules THEN it SHALL avoid clustering posts from the same persona
5. WHEN the Schedule_Agent creates schedules THEN it SHALL maintain the original campaign's date boundaries
