import { z } from 'zod';
import { ulid } from 'ulid';

export const CampaignSchema = z.object({
  campaignId: z.string(),
  tenantId: z.string(),
  description: z.string().min(10).max(1000),
  personaIds: z.array(z.string()).min(1).max(10),
  platforms: z.array(z.enum(['twitter', 'linkedin', 'instagram', 'facebook'])).min(1),
  brandId: z.string().optional(),
  duration: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    numberOfDays: z.number().int().min(1).max(90).optional()
  }).refine(
    (data) => {
      const hasDateRange = data.startDate && data.endDate;
      const hasDayCount = data.numberOfDays;
      return hasDateRange || hasDayCount;
    },
    { message: 'Either startDate/endDate or numberOfDays must be provided' }
  ),
  status: z.enum(['planning', 'generating', 'completed', 'failed']),
  planSummary: z.object({
    totalPosts: z.number().int().min(0),
    postsPerPlatform: z.record(z.number().int().min(0)),
    postsPerPersona: z.record(z.number().int().min(0))
  }).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
  version: z.number().int().min(1)
});

export const SocialPostSchema = z.object({
  postId: z.string(),
  campaignId: z.string(),
  tenantId: z.string(),
  personaId: z.string(),
  platform: z.enum(['twitter', 'linkedin', 'instagram', 'facebook']),
  scheduledDate: z.string(),
  topic: z.string().min(1).max(500),
  assetRequirements: z.object({
    imageRequired: z.boolean(),
    imageDescription: z.string().optional(),
    videoRequired: z.boolean(),
    videoDescription: z.string().optional()
  }).optional(),
  content: z.object({
    text: z.string(),
    hashtags: z.array(z.string()).optional(),
    mentions: z.array(z.string()).optional(),
    generatedAt: z.string()
  }).optional(),
  status: z.enum(['planned', 'generating', 'completed', 'failed']),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().min(1)
});

export const CreateCampaignRequestSchema = z.object({
  description: z.string().min(10).max(1000),
  personaIds: z.array(z.string()).min(1).max(10),
  platforms: z.array(z.enum(['twitter', 'linkedin', 'instagram', 'facebook'])).min(1),
  brandId: z.string().optional(),
  duration: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    numberOfDays: z.number().int().min(1).max(90).optional()
  }).refine(
    (data) => {
      const hasDateRange = data.startDate && data.endDate;
      const hasDayCount = data.numberOfDays;
      return hasDateRange || hasDayCount;
    },
    { message: 'Either startDate/endDate or numberOfDays must be provided' }
  )
});

export const validateRequestBody = (schema, body) => {
  try {
    const parsed = JSON.parse(body);
    return schema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw new Error('Invalid JSON in request body');
  }
};

export const generateCampaignId = () => {
  return `campaign_${ulid()}`;
};

export const generatePostId = () => {
  return `post_${ulid()}`;
};
