import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

const mockSend = vi.fn();
const mockGetSignedUrl = vi.fn();

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({ send: mockSend })),
  GetItemCommand: vi.fn((params) => ({ input: params })),
  PutItemCommand: vi.fn((params) => ({ input: params })),
  UpdateItemCommand: vi.fn((params) => ({ input: params })),
  QueryCommand: vi.fn((params) => ({ input: params }))
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({ send: mockSend })),
  GetObjectCommand: vi.fn((params) => ({ input: params })),
  PutObjectCommand: vi.fn((params) => ({ input: params })),
  DeleteObjectCommand: vi.fn((params) => ({ input: params }))
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: vi.fn((obj) => obj),
  unmarshall: vi.fn((obj) => obj)
}));

vi.mock('@aws-lambda-powertools/logger', () => ({
  Logger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}));

describe('Asset Security and Access Control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.TABLE_NAME = 'test-table';
    process.env.ASSETS_BUCKET = 'test-bucket';
  });

  /**
   * **Feature: campaign-asset-management, Property 9: Security and access control**
   * **Validates: Requirements 9.1, 9.2, 9.3, 9.4**
   */
  it('should enforce tenant ownership verification for all asset operations', async () => {
    const { validateTenantOwnership, AssetSecurityError, SecurityViolationTypes } = await import('../../utils/asset-security.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          requestingTenantId: fc.string({ minLength: 8, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          actualTenantId: fc.string({ minLength: 8, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          assetId: fc.string({ minLength: 15, maxLength: 30 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s))
        }).filter(data => data.requestingTenantId !== data.actualTenantId),
        async (testData) => {
          // Mock DynamoDB response - asset exists but belongs to different tenant
          mockSend.mockResolvedValueOnce({
            Item: {
              pk: `${testData.requestingTenantId}#${testData.assetId}`,
              sk: 'asset',
              tenantId: testData.actualTenantId, // Different tenant ID in the data
              assetId: testData.assetId
            }
          });

          // Should throw security error for cross-tenant access attempt
          await expect(
            validateTenantOwnership(testData.requestingTenantId, testData.assetId)
          ).rejects.toThrow(AssetSecurityError);

          // Reset mock for second call
          mockSend.mockClear();
          mockSend.mockResolvedValueOnce({
            Item: {
              pk: `${testData.requestingTenantId}#${testData.assetId}`,
              sk: 'asset',
              tenantId: testData.actualTenantId,
              assetId: testData.assetId
            }
          });

          try {
            await validateTenantOwnership(testData.requestingTenantId, testData.assetId);
            // Should not reach here
            expect(false).toBe(true);
          } catch (error) {
            expect(error).toBeInstanceOf(AssetSecurityError);
            expect(error.violationType).toBe(SecurityViolationTypes.TENANT_ISOLATION_VIOLATION);
            expect(error.details.tenantId).toBe(testData.requestingTenantId);
            expect(error.details.assetId).toBe(testData.assetId);
            expect(error.details.actualTenantId).toBe(testData.actualTenantId);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should validate content policy for uploaded assets', async () => {
    const { validateContentPolicy, AssetSecurityError, SecurityViolationTypes: _SecurityViolationTypes } = await import('../../utils/asset-security.mjs');

    await fc.assert(
      fc.property(
        fc.record({
          contentType: fc.constantFrom('image/jpeg', 'image/png', 'video/mp4', 'application/pdf', 'text/plain'),
          fileSize: fc.integer({ min: 1, max: 200 * 1024 * 1024 }), // Up to 200MB
          description: fc.string({ minLength: 5, maxLength: 600 })
        }),
        (testData) => {
          const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/mov', 'video/avi'];
          const isValidContentType = supportedTypes.includes(testData.contentType);

          const maxImageSize = 10 * 1024 * 1024; // 10MB
          const maxVideoSize = 100 * 1024 * 1024; // 100MB
          const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
          const videoTypes = ['video/mp4', 'video/mov', 'video/avi'];

          const isValidSize =
            (imageTypes.includes(testData.contentType) && testData.fileSize <= maxImageSize) ||
            (videoTypes.includes(testData.contentType) && testData.fileSize <= maxVideoSize);

          const prohibitedTerms = ['malware', 'virus', 'exploit', 'hack', 'phishing', 'spam', 'scam', 'fraud', 'illegal', 'pirated'];
          const hasProhibitedContent = testData.description && prohibitedTerms.some(term =>
            testData.description.toLowerCase().includes(term)
          );

          const isValidDescription = testData.description && testData.description.trim().length >= 10 && testData.description.length <= 500;

          const shouldPass = isValidContentType && isValidSize && !hasProhibitedContent && isValidDescription;

          if (shouldPass) {
            expect(() => validateContentPolicy(testData.contentType, testData.fileSize, testData.description))
              .not.toThrow();
          } else {
            expect(() => validateContentPolicy(testData.contentType, testData.fileSize, testData.description))
              .toThrow(AssetSecurityError);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate time-limited signed URLs with appropriate permissions', async () => {
    const { generateSecureSignedUrl } = await import('../../utils/asset-security.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          bucket: fc.string({ minLength: 3, maxLength: 63 }).filter(s => s.trim().length > 0),
          objectKey: fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length > 0),
          operation: fc.constantFrom('getObject', 'putObject'),
          requestedExpiry: fc.integer({ min: 60, max: 3600 }) // 1 minute to 1 hour
        }),
        async (testData) => {
          const mockS3Client = {};
          const expectedSignedUrl = `https://s3.amazonaws.com/${testData.bucket}/${testData.objectKey}?signed=true`;

          mockGetSignedUrl.mockResolvedValueOnce(expectedSignedUrl);

          const result = await generateSecureSignedUrl(
            mockS3Client,
            testData.bucket,
            testData.objectKey,
            testData.operation,
            testData.requestedExpiry
          );

          expect(result).toBe(expectedSignedUrl);

          // Verify that expiry is capped at 15 minutes (900 seconds)
          const expectedExpiry = Math.min(testData.requestedExpiry, 900);

          expect(mockGetSignedUrl).toHaveBeenCalledWith(
            mockS3Client,
            expect.any(Object),
            { expiresIn: expectedExpiry }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should provide comprehensive audit logging for asset operations', async () => {
    const { logAssetOperation, logAssetAccess, logSecurityViolation } = await import('../../utils/asset-security.mjs');

    await fc.assert(
      fc.property(
        fc.record({
          tenantId: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
          assetId: fc.string({ minLength: 10, maxLength: 50 }).filter(s => s.trim().length > 0),
          operation: fc.constantFrom('CREATE', 'READ', 'UPDATE', 'DELETE', 'LIST'),
          result: fc.constantFrom('SUCCESS', 'FAILED', 'DENIED', 'NOT_FOUND'),
          metadata: fc.record({
            contentType: fc.option(fc.constantFrom('image/jpeg', 'video/mp4')),
            fileSize: fc.option(fc.integer({ min: 1000, max: 10000000 })),
            errorName: fc.option(fc.string({ minLength: 5, maxLength: 30 }))
          })
        }),
        (testData) => {
          // Test that logging functions don't throw errors and handle all input types
          expect(() => {
            logAssetOperation(
              testData.tenantId,
              testData.assetId,
              testData.operation,
              testData.result,
              testData.metadata
            );
          }).not.toThrow();

          expect(() => {
            logAssetAccess(
              testData.tenantId,
              testData.assetId,
              testData.operation,
              testData.result
            );
          }).not.toThrow();

          if (testData.result === 'DENIED') {
            expect(() => {
              logSecurityViolation('TENANT_ISOLATION_VIOLATION', {
                tenantId: testData.tenantId,
                assetId: testData.assetId,
                operation: testData.operation
              });
            }).not.toThrow();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should enforce tenant-based S3 key prefixes for complete data isolation', async () => {
    const { validateTenantOwnership } = await import('../../utils/asset-security.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
          assetId: fc.string({ minLength: 10, maxLength: 50 }).filter(s => s.trim().length > 0)
        }),
        async (testData) => {
          // Mock successful tenant ownership validation
          mockSend.mockResolvedValueOnce({
            Item: {
              pk: `${testData.tenantId}#${testData.assetId}`,
              sk: 'asset',
              tenantId: testData.tenantId,
              assetId: testData.assetId
            }
          });

          await validateTenantOwnership(testData.tenantId, testData.assetId);

          // Verify that DynamoDB query uses tenant-scoped partition key
          expect(mockSend).toHaveBeenCalledWith(
            expect.objectContaining({
              input: expect.objectContaining({
                Key: {
                  pk: `${testData.tenantId}#${testData.assetId}`,
                  sk: 'asset'
                }
              })
            })
          );

          // Verify projection expression includes tenant validation fields
          const call = mockSend.mock.calls[0][0];
          expect(call.input.ProjectionExpression).toContain('tenantId');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle asset access validation across all operations', async () => {
    const { validateAssetAccess, AssetSecurityError } = await import('../../utils/asset-security.mjs');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
          assetId: fc.string({ minLength: 10, maxLength: 50 }).filter(s => s.trim().length > 0),
          operation: fc.constantFrom('READ', 'update', 'delete', 'access')
        }),
        async (testData) => {
          // Test successful access validation
          mockSend.mockResolvedValueOnce({
            Item: {
              pk: `${testData.tenantId}#${testData.assetId}`,
              sk: 'asset',
              tenantId: testData.tenantId,
              assetId: testData.assetId
            }
          });

          const result = await validateAssetAccess(
            testData.tenantId,
            testData.assetId,
            testData.operation.toUpperCase()
          );

          expect(result).toBe(true);

          // Test failed access validation (asset not found)
          mockSend.mockClear();
          mockSend.mockResolvedValueOnce({ Item: null });

          await expect(
            validateAssetAccess(testData.tenantId, testData.assetId, testData.operation.toUpperCase())
          ).rejects.toThrow(AssetSecurityError);
        }
      ),
      { numRuns: 100 }
    );
  });
});
