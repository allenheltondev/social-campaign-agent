import { withDurableExecution } from '@aws/durable-execution-sdk-js';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { z } from 'zod';

import { run as campaignPlannerRun } from '../agents/campaign-planner.mjs';
import { run as contentGeneratorRun } from '../agents/content-generator.mjs';
import { Campaign } from '../../models/campaign.mjs';

const ddb = new DynamoDBClient();

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
        url: z.string().url().nullable()
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
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      allowedDaysOfWeek: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).min(1).max(7),
      blackoutDates: z.array(z.string().datetime()).nullable(),
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
    }).optional()
  })
});

export const handler = withDurableExecution(
  async (event, context) => {
    try {
      const validatedInput = inputSchema.parse(event);
      const { tenantId, campaign } = validatedInput;

      console.log('Starting campaign workflow', {
        executionId: context.executionId,
        tenantId,
        campaignId: campaign.id
      });

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
            metadata: campaign.metadata || { source: 'api', externalRef: null },
            version: 1,
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
        console.log('Campaign already exists, skipping workflow');
        return {
          success: false,
          message: 'Campaign already exists'
        };
      }

      const planResults = await context.step('Generate campaign plan', async () => {
        try {
          const result = await campaignPlannerRun(tenantId, {
            campaignId: campaign.id,
            campaign
          });

          if (!result.success) {
            const error = result.error || { message: 'Campaign planning returned unsuccessful result' };
            throw new Error(error.message || 'Campaign planning failed');
          }

          if (!result.posts || !Array.isArray(result.posts)) {
            throw new Error('Invalid post plan structure returned from planner');
          }

          return result;
        } catch (err) {
          throw err;
        }
      }, {
        retryPolicy: {
          maxAttempts: 1,
          backoffCoefficient: 2.0,
          initialInterval: 2000,
          maximumInterval: 60000
        }
      });

      console.log(JSON.stringify(planResults));

      let contentResults = await context.map(planResults.posts || [],
        async (ctx, post, index) => {
          await ctx.step(`Update post ${index} status to generating`, async () => {
            await ddb.send(new UpdateItemCommand({
              TableName: process.env.TABLE_NAME,
              Key: marshall({
                pk: `${tenantId}#${campaign.id}`,
                sk: `POST#${post.id}`
              }),
              UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
              ExpressionAttributeNames: {
                '#status': 'status'
              },
              ExpressionAttributeValues: marshall({
                ':status': 'generating',
                ':updatedAt': new Date().toISOString()
              })
            }));

            const result = await contentGeneratorRun(tenantId, {
              campaignId: campaign.id,
              postId: post.id,
              post
            });

            console.log(result);

            if (!result.success) {
              const error = result.error || { message: 'Content generation returned unsuccessful result' };
              throw new Error(`Content generation failed for post ${post.id}: ${error.message}`);
            }

            await ddb.send(new UpdateItemCommand({
              TableName: process.env.TABLE_NAME,
              Key: marshall({
                pk: `${tenantId}#${campaign.id}`,
                sk: `POST#${post.id}`
              }),
              UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
              ExpressionAttributeNames: {
                '#status': 'status'
              },
              ExpressionAttributeValues: marshall({
                ':status': 'completed',
                ':updatedAt': new Date().toISOString()
              })
            }));

            return {
              postId: post.id,
              success: true,
              content: result.content,
              error: null
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
      const failedPosts = contentResults.filter(result => !result.success);

      console.log('Content generation summary', {
        totalPosts: contentResults.length,
        successful: successfulPosts.length,
        failed: failedPosts.length,
        failedPostIds: failedPosts.map(p => p.postId)
      });

      let finalStatus = 'needs_revision';
      if (successfulPosts.length) {
        const result = await context.waitForCallback('Wait for approval', async (callbackId) => {
          await ddb.send(new UpdateItemCommand({
            TableName: process.env.TABLE_NAME,
            Key: marshall({
              pk: `${tenantId}#${campaign.id}`,
              sk: 'campaign'
            }),
            UpdateExpression: 'SET #status = :status, callbackId = :callbackId, updatedAt = :updatedAt',
            ExpressionAttributeNames: {
              '#status': 'status'
            },
            ExpressionAttributeValues: marshall({
              ':status': 'pending_approval',
              ':callbackId': callbackId,
              ':updatedAt': new Date().toISOString()
            })
          }));
        }, { timeout: { hours: 24 } });


        await context.step('Complete campaign', async () => {
          switch (result.toLowerCase()) {
            case 'approved':
              finalStatus = 'approved';
              break;
            case 'rejected':
              finalStatus = 'rejected';
              break;
            case 'timeout':
              finalStatus = 'approval_timeout';
              break;
            default:
              finalStatus = 'needs_revision';
          }
        });
      }

      await Campaign.updateStatus(campaign.id, tenantId, finalStatus);

      await ddb.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({
          pk: `${tenantId}#${campaign.id}`,
          sk: 'campaign'
        }),
        UpdateExpression: 'REMOVE callbackId'
      }));

      return {
        success: true,
        campaignId: campaign.id,
        planResults,
        contentResults,
        approvalDecision: result
      };

    } catch (error) {
      console.error('Workflow failed', {
        executionId: context.executionId,
        tenantId: event.tenantId,
        campaignId: event.campaign?.id,
        error: error.message,
        stack: error.stack
      });

      if (event.tenantId && event.campaign?.id) {
        try {
          await Campaign.markAsFailed(event.campaign.id, event.tenantId, error);
        } catch (updateError) {
          console.error('Failed to update campaign status after error', updateError);
        }
      }

      throw error;
    }
  }
);
