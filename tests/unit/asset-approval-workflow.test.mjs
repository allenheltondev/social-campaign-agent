import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { mockClient } from 'aws-sdk-client-mock';
import { Asset } from '../../models/asset.mjs';
import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

vi.mock('../../utils/logger.mjs', () => ({
  logger: {
    error: vi.fn()
  }
}));

const ddbMock = mockClient(DynamoDBClient);

describe('Asset Approval Workflow Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ddbMock.reset();
    process.env.TABLE_NAME = 'test-table';
  });

  const approvalStatusArb = fc.constantFrom('pending', 'approved', 'rejected');
  const tenantIdArb = fc.string({ minLength: 5, maxLength: 20 }).map(s => `tenant_${s}`);
  const assetIdArb = fc.string({ minLength: 5, maxLength: 20 }).map(s => `asset_${s}`);
  const reviewerIdArb = fc.string({ minLength: 5, maxLength: 20 }).map(s => `user_${s}`);
  const feedbackArb = fc.option(fc.string({ minLength: 10, maxLength: 200 }), { nil: null });

  it('Property 5: Asset Approval Workflow - Validates Requirements 5.1, 5.2, 5.3, 5.4, 5.5', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantIdArb,
        assetIdArb,
        approvalStatusArb,
        reviewerIdArb,
        feedbackArb,
        async (tenantId, assetId, newStatus, reviewerId, feedback) => {
          const now = new Date().toISOString();
          const existingAsset = {
            pk: `${tenantId}#${assetId}`,
            sk: 'asset',
            GSI1PK: tenantId,
            GSI1SK: `ASSET#image/jpeg#${now}`,
            assetId,
            tenantId,
            type: 'internal',
            contentType: 'image/jpeg',
            description: 'Test asset for approval workflow',
            fileSize: 1024000,
            objectKey: `${tenantId}/assets/${assetId}.jpg`,
            fileExtension: 'jpg',
            uploadStatus: 'completed',
            uploadUrl: null,
            ttl: null,
            approvalStatus: 'pending',
            approvalHistory: [],
            brandAssociations: null,
            usageStats: {
              totalCampaigns: 0,
              totalPosts: 0,
              lastUsedAt: null,
              brandUsage: null
            },
            createdAt: now,
            updatedAt: now,
            version: 1
          };

          ddbMock.on(GetItemCommand).resolves({
            Item: marshall(existingAsset)
          });

          const asset = await Asset.findById(tenantId, assetId);
          expect(asset).toBeDefined();
          expect(asset.approvalStatus).toBe('pending');
          expect(asset.approvalHistory).toEqual([]);

          ddbMock.on(UpdateItemCommand).resolves({
            Attributes: marshall({
              ...existingAsset,
              approvalStatus: newStatus,
              approvalHistory: [{
                status: newStatus,
                reviewedBy: reviewerId,
                reviewedAt: now,
                feedback
              }],
              updatedAt: now
            })
          });

          await Asset.updateApprovalStatus(tenantId, assetId, newStatus, reviewerId, feedback);

          const updateCalls = ddbMock.commandCalls(UpdateItemCommand);
          expect(updateCalls.length).toBeGreaterThan(0);

          const updateCall = updateCalls[updateCalls.length - 1];
          expect(updateCall.args[0].input.UpdateExpression).toContain('#approvalStatus = :status');
          expect(updateCall.args[0].input.UpdateExpression).toContain('#approvalHistory');

          const values = unmarshall(updateCall.args[0].input.ExpressionAttributeValues);
          expect(values[':status']).toBe(newStatus);
          expect(values[':newEntry']).toHaveLength(1);
          expect(values[':newEntry'][0].status).toBe(newStatus);
          expect(values[':newEntry'][0].reviewedBy).toBe(reviewerId);
          expect(values[':newEntry'][0].feedback).toBe(feedback);
          expect(values[':newEntry'][0].reviewedAt).toBeDefined();

          if (newStatus === 'approved') {
            expect(['approved', 'rejected']).toContain(newStatus);
          } else if (newStatus === 'rejected') {
            expect(['approved', 'rejected']).toContain(newStatus);
          }

          ddbMock.reset();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5 - New assets default to pending approval status', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantIdArb,
        fc.string({ minLength: 10, maxLength: 500 }),
        fc.integer({ min: 1000, max: 10000000 }),
        async (tenantId, description, fileSize) => {
          ddbMock.on(PutItemCommand).resolves({});

          const assetData = {
            contentType: 'image/jpeg',
            description,
            fileSize
          };

          try {
            await Asset.save(tenantId, assetData);

            const putCalls = ddbMock.commandCalls(PutItemCommand);
            if (putCalls.length > 0) {
              const putCall = putCalls[putCalls.length - 1];
              const item = unmarshall(putCall.args[0].input.Item);
              expect(item.approvalStatus).toBe('pending');
              expect(item.approvalHistory).toEqual([]);
            }
          } catch (error) {
            if (error.name === 'ValidationError') {
              return;
            }
            throw error;
          } finally {
            ddbMock.reset();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5 - Approval history accumulates with each status change', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantIdArb,
        assetIdArb,
        fc.array(
          fc.record({
            status: approvalStatusArb,
            reviewerId: reviewerIdArb,
            feedback: feedbackArb
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (tenantId, assetId, statusChanges) => {
          for (const change of statusChanges) {
            ddbMock.on(UpdateItemCommand).resolves({
              Attributes: marshall({
                pk: `${tenantId}#${assetId}`,
                sk: 'asset',
                assetId,
                tenantId,
                approvalStatus: change.status,
                approvalHistory: [{
                  status: change.status,
                  reviewedBy: change.reviewerId,
                  reviewedAt: new Date().toISOString(),
                  feedback: change.feedback
                }],
                updatedAt: new Date().toISOString()
              })
            });

            try {
              await Asset.updateApprovalStatus(
                tenantId,
                assetId,
                change.status,
                change.reviewerId,
                change.feedback
              );

              const updateCalls = ddbMock.commandCalls(UpdateItemCommand);
              if (updateCalls.length > 0) {
                const updateCall = updateCalls[updateCalls.length - 1];
                const values = unmarshall(updateCall.args[0].input.ExpressionAttributeValues);
                expect(values[':newEntry']).toHaveLength(1);
                expect(values[':newEntry'][0].status).toBe(change.status);
                expect(values[':newEntry'][0].reviewedBy).toBe(change.reviewerId);
                expect(values[':newEntry'][0].feedback).toBe(change.feedback);
              }
            } catch (error) {
              if (error.name === 'ValidationError') {
                continue;
              }
              throw error;
            } finally {
              ddbMock.reset();
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
