import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, PutItemCommand, GetItemCommand, DeleteItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

// Mock the Lambda functions
const ddbMock = mockClient(DynamoDBClient);
const s3Mock = mockClient(S3Client);

// Import the handlers
import { handler as uploadAssetHandler } from '../../functions/brand/assets/upload-asset.mjs';
import { handler as listAssetsHandler } from '../../functions/brand/assets/list-assets.mjs';
import { handler as deleteAssetHandler } from '../../functions/brand/assets/delete-asset.mjs';

describe('Brand Asset Management', () => {
  beforeEach(() => {
    ddbMock.reset();
    s3Mock.reset();
    vi.clearAllMocks();

    // Set environment variables
    process.env.TABLE_NAME = 'test-table';
    process.env.ASSETS_BUCKET_NAME = 'test-assets-bucket';
  });

  describe('Upload Asset', () => {
    it('should upload asset with valid data', async () => {
      const tenantId = 'tenant_123';
      const brandId = 'brand_456';
      const fileData = Buffer.from('test file content').toString('base64');

      const event = {
        requestContext: {
          authorizer: { tenantId }
        },
        pathParameters: { brandId },
        body: JSON.stringify({
          name: 'Test Logo',
          type: 'logo',
          category: 'Primary Branding',
          tags: ['logo', 'primary'],
          contentType: 'image/png',
          fileData,
          usageRules: {
            placement: 'Header',
            sizing: {
              minWidth: 100,
              maxWidth: 500
            },
            restrictions: ['No modifications']
          }
        })
      };

      // Mock brand exists check
      ddbMock.on(GetItemCommand).resolves({
        Item: marshall({
          pk: `${tenantId}#${brandId}`,
          sk: 'metadata',
          brandId,
          tenantId,
          name: 'Test Brand'
        })
      });

      // Mock S3 upload
      s3Mock.on(PutObjectCommand).resolves({});

      // Mock DynamoDB asset creation
      ddbMock.on(PutItemCommand).resolves({});

      const response = await uploadAssetHandler(event);

      expect(response.statusCode).toBe(201);

      const responseBody = JSON.parse(response.body);
      expect(responseBody.name).toBe('Test Logo');
      expect(responseBody.type).toBe('logo');
      expect(responseBody.category).toBe('Primary Branding');
      expect(responseBody.tenantId).toBe(tenantId);
      expect(responseBody.brandId).toBe(brandId);
      expect(responseBody.assetId).toMatch(/^asset_[A-Z0-9]{26}$/);
      expect(responseBody.s3Bucket).toBe('test-assets-bucket');
      expect(responseBody.s3Key).toMatch(new RegExp(`^${tenantId}/${brandId}/asset_[A-Z0-9]{26}$`));
      expect(responseBody.fileSize).toBeGreaterThan(0);

      // Verify S3 upload was called
      expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(1);
      const s3Call = s3Mock.commandCalls(PutObjectCommand)[0];
      expect(s3Call.args[0].input.Bucket).toBe('test-assets-bucket');
      expect(s3Call.args[0].input.ContentType).toBe('image/png');

      // Verify DynamoDB put was called
      expect(ddbMock.commandCalls(PutItemCommand)).toHaveLength(1);
    });

    it('should return 401 when tenant is missing', async () => {
      const event = {
        requestContext: {
          authorizer: {}
        },
        pathParameters: { brandId: 'brand_456' },
        body: JSON.stringify({
          name: 'Test Logo',
          type: 'logo',
          category: 'Primary',
          tags: [],
          contentType: 'image/png',
          fileData: 'dGVzdA==',
          usageRules: { placement: 'Header', sizing: {}, restrictions: [] }
        })
      };

      const response = await uploadAssetHandler(event);

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body).message).toBe('Unauthorized');
    });

    it('should return 400 when brandId is missing', async () => {
      const event = {
        requestContext: {
          authorizer: { tenantId: 'tenant_123' }
        },
        pathParameters: {},
        body: JSON.stringify({
          name: 'Test Logo',
          type: 'logo',
          category: 'Primary',
          tags: [],
          contentType: 'image/png',
          fileData: 'dGVzdA==',
          usageRules: { placement: 'Header', sizing: {}, restrictions: [] }
        })
      };

      const response = await uploadAssetHandler(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toBe('Missing brandId parameter');
    });

    it('should return 404 when brand does not exist', async () => {
      const event = {
        requestContext: {
          authorizer: { tenantId: 'tenant_123' }
        },
        pathParameters: { brandId: 'brand_456' },
        body: JSON.stringify({
          name: 'Test Logo',
          type: 'logo',
          category: 'Primary',
          tags: [],
          contentType: 'image/png',
          fileData: 'dGVzdA==',
          usageRules: { placement: 'Header', sizing: {}, restrictions: [] }
        })
      };

      // Mock brand not found
      ddbMock.on(GetItemCommand).resolves({});

      const response = await uploadAssetHandler(event);

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body).message).toBe('Brand not found');
    });

    it('should return 400 when file data is missing', async () => {
      const event = {
        requestContext: {
          authorizer: { tenantId: 'tenant_123' }
        },
        pathParameters: { brandId: 'brand_456' },
        body: JSON.stringify({
          name: 'Test Logo',
          type: 'logo',
          category: 'Primary',
          tags: [],
          contentType: 'image/png',
          usageRules: { placement: 'Header', sizing: {}, restrictions: [] }
        })
      };

      // Mock brand exists
      ddbMock.on(GetItemCommand).resolves({
        Item: marshall({ pk: 'tenant_123#brand_456', sk: 'metadata' })
      });

      const response = await uploadAssetHandler(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toBe('Validation error: fileData: Required');
    });

    it('should handle various file types', async () => {
      const testCases = [
        { type: 'logo', contentType: 'image/svg+xml' },
        { type: 'template', contentType: 'application/pdf' },
        { type: 'image', contentType: 'image/jpeg' },
        { type: 'document', contentType: 'application/msword' }
      ];

      for (const testCase of testCases) {
        ddbMock.reset();
        s3Mock.reset();

        const event = {
          requestContext: {
            authorizer: { tenantId: 'tenant_123' }
          },
          pathParameters: { brandId: 'brand_456' },
          body: JSON.stringify({
            name: `Test ${testCase.type}`,
            type: testCase.type,
            category: 'Primary',
            tags: [testCase.type],
            contentType: testCase.contentType,
            fileData: Buffer.from('test content').toString('base64'),
            usageRules: { placement: 'Header', sizing: {}, restrictions: [] }
          })
        };

        // Mock brand exists
        ddbMock.on(GetItemCommand).resolves({
          Item: marshall({ pk: 'tenant_123#brand_456', sk: 'metadata' })
        });
        s3Mock.on(PutObjectCommand).resolves({});
        ddbMock.on(PutItemCommand).resolves({});

        const response = await uploadAssetHandler(event);

        expect(response.statusCode).toBe(201);
        const responseBody = JSON.parse(response.body);
        expect(responseBody.type).toBe(testCase.type);
        expect(responseBody.contentType).toBe(testCase.contentType);
      }
    });
  });

  describe('List Assets', () => {
    it('should list assets for a brand', async () => {
      const tenantId = 'tenant_123';
      const brandId = 'brand_456';

      const event = {
        requestContext: {
          authorizer: { tenantId }
        },
        pathParameters: { brandId },
        queryStringParameters: {}
      };

      const mockAssets = [
        {
          pk: `${tenantId}#${brandId}`,
          sk: 'ASSET#asset_1',
          GSI1PK: `${tenantId}#${brandId}`,
          GSI1SK: 'ASSET#logo#2023-01-01T00:00:00.000Z',
          assetId: 'asset_1',
          brandId,
          tenantId,
          name: 'Logo 1',
          type: 'logo',
          category: 'Primary',
          tags: ['logo'],
          s3Bucket: 'test-bucket',
          s3Key: `${tenantId}/${brandId}/asset_1`,
          contentType: 'image/png',
          fileSize: 1024,
          usageRules: { placement: 'Header', sizing: {}, restrictions: [] },
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z'
        },
        {
          pk: `${tenantId}#${brandId}`,
          sk: 'ASSET#asset_2',
          GSI1PK: `${tenantId}#${brandId}`,
          GSI1SK: 'ASSET#template#2023-01-02T00:00:00.000Z',
          assetId: 'asset_2',
          brandId,
          tenantId,
          name: 'Template 1',
          type: 'template',
          category: 'Secondary',
          tags: ['template'],
          s3Bucket: 'test-bucket',
          s3Key: `${tenantId}/${brandId}/asset_2`,
          contentType: 'application/pdf',
          fileSize: 2048,
          usageRules: { placement: 'Body', sizing: {}, restrictions: [] },
          createdAt: '2023-01-02T00:00:00.000Z',
          updatedAt: '2023-01-02T00:00:00.000Z'
        }
      ];

      ddbMock.on(QueryCommand).resolves({
        Items: mockAssets.map(asset => marshall(asset)),
        Count: 2
      });

      const response = await listAssetsHandler(event);

      expect(response.statusCode).toBe(200);

      const responseBody = JSON.parse(response.body);
      expect(responseBody.assets).toHaveLength(2);
      expect(responseBody.count).toBe(2);

      // Verify assets don't contain DynamoDB keys
      responseBody.assets.forEach(asset => {
        expect(asset.pk).toBeUndefined();
        expect(asset.sk).toBeUndefined();
        expect(asset.GSI1PK).toBeUndefined();
        expect(asset.GSI1SK).toBeUndefined();
      });

      expect(responseBody.assets[0].name).toBe('Logo 1');
      expect(responseBody.assets[1].name).toBe('Template 1');
    });

    it('should filter assets by type', async () => {
      const tenantId = 'tenant_123';
      const brandId = 'brand_456';

      const event = {
        requestContext: {
          authorizer: { tenantId }
        },
        pathParameters: { brandId },
        queryStringParameters: { type: 'logo' }
      };

      ddbMock.on(QueryCommand).resolves({
        Items: [marshall({
          assetId: 'asset_1',
          name: 'Logo 1',
          type: 'logo'
        })],
        Count: 1
      });

      const response = await listAssetsHandler(event);

      expect(response.statusCode).toBe(200);

      const responseBody = JSON.parse(response.body);
      expect(responseBody.assets).toHaveLength(1);
      expect(responseBody.assets[0].type).toBe('logo');

      // Verify query was called with type filter
      const queryCall = ddbMock.commandCalls(QueryCommand)[0];
      expect(queryCall.args[0].input.KeyConditionExpression).toContain('begins_with(GSI1SK, :typePrefix)');
    });

    it('should filter assets by category', async () => {
      const tenantId = 'tenant_123';
      const brandId = 'brand_456';

      const event = {
        requestContext: {
          authorizer: { tenantId }
        },
        pathParameters: { brandId },
        queryStringParameters: { category: 'Primary' }
      };

      ddbMock.on(QueryCommand).resolves({
        Items: [marshall({
          assetId: 'asset_1',
          name: 'Logo 1',
          category: 'Primary'
        })],
        Count: 1
      });

      const response = await listAssetsHandler(event);

      expect(response.statusCode).toBe(200);

      const responseBody = JSON.parse(response.body);
      expect(responseBody.assets).toHaveLength(1);

      // Verify query was called with category filter
      const queryCall = ddbMock.commandCalls(QueryCommand)[0];
      expect(queryCall.args[0].input.FilterExpression).toBe('#category = :category');
    });

    it('should handle pagination', async () => {
      const tenantId = 'tenant_123';
      const brandId = 'brand_456';
      const nextToken = Buffer.from(JSON.stringify({ pk: 'test', sk: 'test' })).toString('base64');

      const event = {
        requestContext: {
          authorizer: { tenantId }
        },
        pathParameters: { brandId },
        queryStringParameters: {
          limit: '1',
          nextToken
        }
      };

      ddbMock.on(QueryCommand).resolves({
        Items: [marshall({ assetId: 'asset_1', name: 'Asset 1' })],
        Count: 1,
        LastEvaluatedKey: marshall({ pk: 'next', sk: 'next' })
      });

      const response = await listAssetsHandler(event);

      expect(response.statusCode).toBe(200);

      const responseBody = JSON.parse(response.body);
      expect(responseBody.assets).toHaveLength(1);
      expect(responseBody.nextToken).toBeDefined();

      // Verify pagination parameters were used
      const queryCall = ddbMock.commandCalls(QueryCommand)[0];
      expect(queryCall.args[0].input.Limit).toBe(1);
      expect(queryCall.args[0].input.ExclusiveStartKey).toBeDefined();
    });

    it('should return 401 when tenant is missing', async () => {
      const event = {
        requestContext: {
          authorizer: {}
        },
        pathParameters: { brandId: 'brand_456' },
        queryStringParameters: {}
      };

      const response = await listAssetsHandler(event);

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body).message).toBe('Unauthorized');
    });

    it('should return 400 when brandId is missing', async () => {
      const event = {
        requestContext: {
          authorizer: { tenantId: 'tenant_123' }
        },
        pathParameters: {},
        queryStringParameters: {}
      };

      const response = await listAssetsHandler(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toBe('Missing brandId parameter');
    });
  });

  describe('Delete Asset', () => {
    it('should delete asset successfully', async () => {
      const tenantId = 'tenant_123';
      const brandId = 'brand_456';
      const assetId = 'asset_789';

      const event = {
        requestContext: {
          authorizer: { tenantId }
        },
        pathParameters: { brandId, assetId }
      };

      const mockAsset = {
        pk: `${tenantId}#${brandId}`,
        sk: `ASSET#${assetId}`,
        assetId,
        brandId,
        tenantId,
        s3Bucket: 'test-bucket',
        s3Key: `${tenantId}/${brandId}/${assetId}`,
        name: 'Test Asset'
      };

      // Mock asset exists
      ddbMock.on(GetItemCommand).resolves({
        Item: marshall(mockAsset)
      });

      // Mock S3 deletion
      s3Mock.on(DeleteObjectCommand).resolves({});

      // Mock DynamoDB deletion
      ddbMock.on(DeleteItemCommand).resolves({});

      const response = await deleteAssetHandler(event);

      expect(response.statusCode).toBe(204);

      // Verify S3 deletion was called
      expect(s3Mock.commandCalls(DeleteObjectCommand)).toHaveLength(1);
      const s3Call = s3Mock.commandCalls(DeleteObjectCommand)[0];
      expect(s3Call.args[0].input.Bucket).toBe('test-bucket');
      expect(s3Call.args[0].input.Key).toBe(`${tenantId}/${brandId}/${assetId}`);

      // Verify DynamoDB deletion was called
      expect(ddbMock.commandCalls(DeleteItemCommand)).toHaveLength(1);
      const ddbCall = ddbMock.commandCalls(DeleteItemCommand)[0];
      expect(ddbCall.args[0].input.Key).toEqual(marshall({
        pk: `${tenantId}#${brandId}`,
        sk: `ASSET#${assetId}`
      }));
    });

    it('should return 404 when asset does not exist', async () => {
      const event = {
        requestContext: {
          authorizer: { tenantId: 'tenant_123' }
        },
        pathParameters: { brandId: 'brand_456', assetId: 'asset_789' }
      };

      // Mock asset not found
      ddbMock.on(GetItemCommand).resolves({});

      const response = await deleteAssetHandler(event);

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body).message).toBe('Asset not found');
    });

    it('should continue with DynamoDB deletion even if S3 deletion fails', async () => {
      const tenantId = 'tenant_123';
      const brandId = 'brand_456';
      const assetId = 'asset_789';

      const event = {
        requestContext: {
          authorizer: { tenantId }
        },
        pathParameters: { brandId, assetId }
      };

      const mockAsset = {
        pk: `${tenantId}#${brandId}`,
        sk: `ASSET#${assetId}`,
        assetId,
        brandId,
        tenantId,
        s3Bucket: 'test-bucket',
        s3Key: `${tenantId}/${brandId}/${assetId}`
      };

      // Mock asset exists
      ddbMock.on(GetItemCommand).resolves({
        Item: marshall(mockAsset)
      });

      // Mock S3 deletion failure
      s3Mock.on(DeleteObjectCommand).rejects(new Error('S3 error'));

      // Mock DynamoDB deletion success
      ddbMock.on(DeleteItemCommand).resolves({});

      const response = await deleteAssetHandler(event);

      expect(response.statusCode).toBe(204);

      // Verify both operations were attempted
      expect(s3Mock.commandCalls(DeleteObjectCommand)).toHaveLength(1);
      expect(ddbMock.commandCalls(DeleteItemCommand)).toHaveLength(1);
    });

    it('should return 401 when tenant is missing', async () => {
      const event = {
        requestContext: {
          authorizer: {}
        },
        pathParameters: { brandId: 'brand_456', assetId: 'asset_789' }
      };

      const response = await deleteAssetHandler(event);

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body).message).toBe('Unauthorized');
    });

    it('should return 400 when parameters are missing', async () => {
      const event1 = {
        requestContext: {
          authorizer: { tenantId: 'tenant_123' }
        },
        pathParameters: { assetId: 'asset_789' }
      };

      const response1 = await deleteAssetHandler(event1);
      expect(response1.statusCode).toBe(400);
      expect(JSON.parse(response1.body).message).toBe('Missing brandId or assetId parameter');

      const event2 = {
        requestContext: {
          authorizer: { tenantId: 'tenant_123' }
        },
        pathParameters: { brandId: 'brand_456' }
      };

      const response2 = await deleteAssetHandler(event2);
      expect(response2.statusCode).toBe(400);
      expect(JSON.parse(response2.body).message).toBe('Missing brandId or assetId parameter');
    });
  });

  describe('Error Handling', () => {
    it('should handle DynamoDB errors gracefully', async () => {
      const event = {
        requestContext: {
          authorizer: { tenantId: 'tenant_123' }
        },
        pathParameters: { brandId: 'brand_456' },
        body: JSON.stringify({
          name: 'Test Logo',
          type: 'logo',
          category: 'Primary',
          tags: [],
          contentType: 'image/png',
          fileData: 'dGVzdA==',
          usageRules: { placement: 'Header', sizing: {}, restrictions: [] }
        })
      };

      // Mock DynamoDB error
      ddbMock.on(GetItemCommand).rejects(new Error('DynamoDB error'));

      const response = await uploadAssetHandler(event);

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body).message).toBe('Internal server error');
    });

    it('should handle S3 errors gracefully', async () => {
      const event = {
        requestContext: {
          authorizer: { tenantId: 'tenant_123' }
        },
        pathParameters: { brandId: 'brand_456' },
        body: JSON.stringify({
          name: 'Test Logo',
          type: 'logo',
          category: 'Primary',
          tags: [],
          contentType: 'image/png',
          fileData: 'dGVzdA==',
          usageRules: { placement: 'Header', sizing: {}, restrictions: [] }
        })
      };

      // Mock brand exists
      ddbMock.on(GetItemCommand).resolves({
        Item: marshall({ pk: 'tenant_123#brand_456', sk: 'metadata' })
      });

      // Mock S3 error
      s3Mock.on(PutObjectCommand).rejects(new Error('S3 error'));

      const response = await uploadAssetHandler(event);

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body).message).toBe('Asset upload failed');
    });
  });
});
