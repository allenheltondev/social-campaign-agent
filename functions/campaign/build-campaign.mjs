import { withDurableExecution } from '@aws/durable-execution-sdk-js';
import { z } from 'zod';

import { run as campaignPlannerRun } from '../agents/campaign-planner.mjs';
import { run as contentGeneratorRun } from '../agents/content-generator.mjs';
import { run as scheduleBlenderRun } from '../agents/schedule-blender.mjs';
import { Campaign } from '../../models/campaign.mjs';
import { SocialPost } from '../../models/social-post.mjs';

const inputSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  campaign: z.object({
    id: z.string().min(1, 'Campaign ID is required'),
    name: z.string().min(1, 'Campaign name is required'),
    brief: z.object({
      description: z.string().min(10).max(2000),
      objective: z.enum(['awareness', 'education', 'conversion', 'event', 'launch']),
      primaryCTA: z.object({
        type: z.string().min(1),
        text: z.string().min(1),
        url: z.url().nullable()
      }).nullable()
    }),
    participants: z.object({
      personaIds: z.array(z.string()).min(1).max(10),
      platforms: z.array(z.enum(['twitter', 'linkedin', 'instagram', 'facebook'])).min(1),
      distribution: z.object({
        mode: z.enum(['balanced', 'weighted', 'custom']).default('balanced'),
        personaWeights: z.record(z.number().min(0).max(1)).nullable().optional(),
        platformWeights: z.record(z.number().min(0).max(1)).nullable().optional()
      })
    }),
    schedule: z.object({
      timezone: z.string().min(1),
      startDate: z.iso.datetime(),
      endDate: z.iso.datetime(),
      allowedDaysOfWeek: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).min(1).max(7),
      blackoutDates: z.array(z.iso.datetime()).nullable(),
      postingWindows: z.array(z.object({
        start: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
        end: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      })).nullable()
    }),
    brandId: z.string().nullable().optional(),
    cadenceOverrides: z.object({
      minPostsPerWeek: z.number().int().min(1).nullable(),
      maxPostsPerWeek: z.number().int().min(1).nullable(),
      maxPostsPerDay: z.number().int().min(1).nullable()
    }).nullable().optional(),
    messaging: z.object({
      pillars: z.array(z.object({
        name: z.string().min(1),
        weight: z.number().min(0).max(1)
      })).nullable(),
      requiredInclusions: z.array(z.string().min(1)).nullable(),
      campaignAvoidTopics: z.array(z.string().min(1)).nullable()
    }).nullable().optional(),
    assetOverrides: z.object({
      forceVisuals: z.object({
        twitter: z.boolean().nullable(),
        linkedin: z.boolean().nullable(),
        instagram: z.boolean().nullable(),
        facebook: z.boolean().nullable()
      }).nullable()
    }).nullable().optional(),
    metadata: z.object({
      source: z.enum(['wizard', 'api', 'import']).default('api'),
      externalRef: z.string().nullable()
    }).optional(),
    blendSchedule: z.boolean().optional().default(false)
  })
});

export const handler = withDurableExecution(
  async (event, context) => {
    const validatedInput = inputSchema.parse(event);
    const { tenantId, campaign } = validatedInput;

    const campaignSaved = await context.step('Save campaign', async () => {
      try {
        await Campaign.save(tenantId, {
          id: campaign.id,
          tenantId,
          brandId: campaign.brandId || null,
          name: campaign.name,
          brief: campaign.brief,
          participants: campaign.participants,
          schedule: campaign.schedule,
          cadenceOverrides: campaign.cadenceOverrides || null,
          messaging: campaign.messaging || null,
          assetOverrides: campaign.assetOverrides || null,
          status: 'planning',
          metadata: campaign.metadata || { source: 'api', externalRef: null }
        });
        return true;
      } catch (err) {
        if (err.name === 'ConditionalCheckFailedException') {
          return false;
        }
        throw err;
      }
    }, {
      retryPolicy: {
        maxAttempts: 3,
        backoffCoefficient: 2.0,
        initialInterval: 1000,
        maximumInterval: 30000
      }
    });

    if (!campaignSaved) {
      return {
        success: false,
        message: 'Campaign already exists'
      };
    }

    const planResults = await context.step('Generate campaign plan', async () => {
      const planningResults = await campaignPlannerRun(tenantId, {
        campaignId: campaign.id,
        campaign
      });

      if (!planningResults.success) {
        throw new Error(planningResults.message || 'Campaign planning failed');
      }

      if (!planningResults.posts || !Array.isArray(planningResults.posts)) {
        throw new Error('Invalid post plan structure returned from planner');
      }

      return planningResults;
    }, {
      retryPolicy: {
        maxAttempts: 1,
        backoffCoefficient: 2.0,
        initialInterval: 2000,
        maximumInterval: 60000
      }
    });

    let contentResults = await context.map(planResults.posts || [],
      async (ctx, post, index) => {
        return await ctx.step(`Update post ${index} status to generating`, async () => {
          await SocialPost.updateStatus(tenantId, campaign.id, post.id, 'generating');

          const contentGenerationResults = await contentGeneratorRun(tenantId, {
            campaignId: campaign.id,
            postId: post.id,
            post
          });

          if (!contentGenerationResults.success) {
            throw new Error(`Content generation failed for post ${post.id}: ${contentGenerationResults.message || 'Content generation failed'}`);
          }

          await SocialPost.updateStatus(tenantId, campaign.id, post.id, 'completed');

          return {
            postId: post.id,
            success: true,
            content: contentGenerationResults.content
          };
        });
      },
      {
        maxConcurrency: 1,
        completionPolicy: 'all',
        retryPolicy: {
          maxAttempts: 2,
          backoffCoefficient: 1.5,
          initialInterval: 1000,
          maximumInterval: 10000
        }
      }
    );
    if (!contentResults) contentResults = [];
    const successfulPosts = contentResults.filter(result => result.success);

    if (campaign.blendSchedule) {
      await context.step('Blend schedules', async () => {
        try {
          console.log('Starting schedule blending', {
            campaignId: campaign.id,
            tenantId
          });

          const { schedules } = await scheduleBlenderRun(tenantId, {
            campaignId: campaign.id
          });

          await SocialPost.batchUpdateSchedules(tenantId, schedules);

          console.log('Schedule blending completed', {
            campaignId: campaign.id,
            tenantId,
            postsRescheduled: schedules.length
          });
        } catch (err) {
          console.error('Schedule blending failed', {
            campaignId: campaign.id,
            tenantId,
            error: err.message
          });
        }
      });
    }

    const finalStatus = successfulPosts.length > 0 ? 'completed' : 'failed';

    await Campaign.update(tenantId, campaign.id, {
      status: finalStatus
    });

    return {
      success: true,
      campaignId: campaign.id,
      planResults,
      contentResults
    };
  }
);
