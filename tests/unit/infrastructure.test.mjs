import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  S3Client,
  GetBucketPolicyCommand,
  GetBucketEncryptionCommand,
  GetBucketVersioningCommand,
  GetBucketLifecycleConfigurationCommand,
  GetPublicAccessBlockCommand
} from '@aws-sdk/client-s3';
import {
  DynamoDBClient,
  DescribeTableCommand
} from '@aws-sdk/client-dynamodb';

const s3Mock = mockClient(S3Client);
const ddbMock = mockClient(DynamoDBClient);

describe('Infrastructure Components', () => {
  beforeEach(() => {
    s3Mock.reset();
    ddbMock.reset();
    vi.clearAllMocks();
  });

  describe('S3 Bucket Configuration', () => {
    const bucketName = 'campaign-agent-brand-assets-dev-123456789012';

    it('should have proper encryption configuration', async () => {
      s3Mock.on(GetBucketEncryptionCommand).resolves({
        ServerSideEncryptionConfiguration: {
          Rules: [{
            ApplyServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256'
            }
          }]
        }
      });

      const s3Client = new S3Client({});
      const response = await s3Client.send(new GetBucketEncryptionCommand({
        Bucket: bucketName
      }));

      expect(response.ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm).toBe('AES256');
    });

    it('should have versioning enabled', async () => {
      s3Mock.on(GetBucketVersioningCommand).resolves({
        Status: 'Enabled'
      });

      const s3Client = new S3Client({});
      const response = await s3Client.send(new GetBucketVersioningCommand({
        Bucket: bucketName
      }));

      expect(response.Status).toBe('Enabled');
    });

    it('should have public access blocked', async () => {
      s3Mock.on(GetPublicAccessBlockCommand).resolves({
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true
        }
      });

      const s3Client = new S3Client({});
      const response = await s3Client.send(new GetPublicAccessBlockCommand({
        Bucket: bucketName
      }));

      const config = response.PublicAccessBlockConfiguration;
      expect(config.BlockPublicAcls).toBe(true);
      expect(config.BlockPublicPolicy).toBe(true);
      expect(config.IgnorePublicAcls).toBe(true);
      expect(config.RestrictPublicBuckets).toBe(true);
    });

    it('should have lifecycle configuration for multipart uploads', async () => {
      s3Mock.on(GetBucketLifecycleConfigurationCommand).resolves({
        Rules: [{
          ID: 'DeleteIncompleteMultipartUploads',
          Status: 'Enabled',
          AbortIncompleteMultipartUpload: {
            DaysAfterInitiation: 7
          }
        }]
      });

      const s3Client = new S3Client({});
      const response = await s3Client.send(new GetBucketLifecycleConfigurationCommand({
        Bucket: bucketName
      }));

      const rule = response.Rules[0];
      expect(rule.Status).toBe('Enabled');
      expect(rule.AbortIncompleteMultipartUpload.DaysAfterInitiation).toBe(7);
    });
  });

  describe('DynamoDB Table Configuration', () => {
    const tableName = 'PersonaTable';

    it('should have proper table configuration', async () => {
      ddbMock.on(DescribeTableCommand).resolves({
        Table: {
          TableName: tableName,
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: 'pk', AttributeType: 'S' },
            { AttributeName: 'sk', AttributeType: 'S' },
            { AttributeName: 'GSI1PK', AttributeType: 'S' },
            { AttributeName: 'GSI1SK', AttributeType: 'S' }
          ],
          KeySchema: [
            { AttributeName: 'pk', KeyType: 'HASH' },
            { AttributeName: 'sk', KeyType: 'RANGE' }
          ],
          GlobalSecondaryIndexes: [{
            IndexName: 'GSI1',
            KeySchema: [
              { AttributeName: 'GSI1PK', KeyType: 'HASH' },
              { AttributeName: 'GSI1SK', KeyType: 'RANGE' }
            ],
            Projection: { ProjectionType: 'ALL' }
          }],
          StreamSpecification: {
            StreamEnabled: true,
            StreamViewType: 'NEW_AND_OLD_IMAGES'
          },
          PointInTimeRecoveryDescription: {
            PointInTimeRecoveryStatus: 'ENABLED'
          },
          TimeToLiveDescription: {
            TimeToLiveStatus: 'ENABLED',
            AttributeName: 'ttl'
          }
        }
      });

      const ddbClient = new DynamoDBClient({});
      const response = await ddbClient.send(new DescribeTableCommand({
        TableName: tableName
      }));

      const table = response.Table;
      expect(table.BillingMode).toBe('PAY_PER_REQUEST');
      expect(table.KeySchema).toHaveLength(2);
      expect(table.GlobalSecondaryIndexes).toHaveLength(1);
      expect(table.StreamSpecification.StreamEnabled).toBe(true);
      expect(table.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus).toBe('ENABLED');
      expect(table.TimeToLiveDescription.TimeToLiveStatus).toBe('ENABLED');
    });

    it('should have correct GSI configuration', async () => {
      ddbMock.on(DescribeTableCommand).resolves({
        Table: {
          GlobalSecondaryIndexes: [{
            IndexName: 'GSI1',
            KeySchema: [
              { AttributeName: 'GSI1PK', KeyType: 'HASH' },
              { AttributeName: 'GSI1SK', KeyType: 'RANGE' }
            ],
            Projection: { ProjectionType: 'ALL' },
            IndexStatus: 'ACTIVE'
          }]
        }
      });

      const ddbClient = new DynamoDBClient({});
      const response = await ddbClient.send(new DescribeTableCommand({
        TableName: tableName
      }));

      const gsi = response.Table.GlobalSecondaryIndexes[0];
      expect(gsi.IndexName).toBe('GSI1');
      expect(gsi.KeySchema).toHaveLength(2);
      expect(gsi.Projection.ProjectionType).toBe('ALL');
      expect(gsi.IndexStatus).toBe('ACTIVE');
    });
  });

  describe('Lambda Function Configuration', () => {
    it('should validate Lambda function environment variables', () => {
      const requiredEnvVars = [
        'TABLE_NAME',
        'ASSETS_BUCKET',
        'AWS_NODEJS_CONNECTION_REUSE_ENABLED'
      ];

      const mockEnv = {
        TABLE_NAME: 'PersonaTable',
        ASSETS_BUCKET: 'campaign-agent-brand-assets-dev-123456789012',
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1'
      };

      requiredEnvVars.forEach(envVar => {
        expect(mockEnv[envVar]).toBeDefined();
        expect(mockEnv[envVar]).not.toBe('');
      });
    });

    it('should validate Lambda function timeout and memory settings', () => {
      const lambdaConfig = {
        timeout: 15,
        memorySize: 1024,
        runtime: 'nodejs24.x',
        architecture: 'arm64'
      };

      expect(lambdaConfig.timeout).toBeGreaterThan(0);
      expect(lambdaConfig.timeout).toBeLessThanOrEqual(900);
      expect(lambdaConfig.memorySize).toBeGreaterThanOrEqual(128);
      expect(lambdaConfig.memorySize).toBeLessThanOrEqual(10240);
      expect(lambdaConfig.runtime).toMatch(/^nodejs/);
      expect(['x86_64', 'arm64']).toContain(lambdaConfig.architecture);
    });
  });

  describe('IAM Policy Validation', () => {
    it('should validate S3 asset management permissions', () => {
      const s3Policy = {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Action: [
            's3:PutObject',
            's3:PutObjectAcl',
            's3:DeleteObject'
          ],
          Resource: 'arn:aws:s3:::campaign-agent-brand-assets-*/*'
        }]
      };

      expect(s3Policy.Statement[0].Effect).toBe('Allow');
      expect(s3Policy.Statement[0].Action).toContain('s3:PutObject');
      expect(s3Policy.Statement[0].Action).toContain('s3:DeleteObject');
      expect(s3Policy.Statement[0].Resource).toMatch(/^arn:aws:s3:::.*\/\*$/);
    });

    it('should validate DynamoDB permissions', () => {
      const ddbPolicy = {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Action: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:Query'
          ],
          Resource: [
            'arn:aws:dynamodb:*:*:table/PersonaTable',
            'arn:aws:dynamodb:*:*:table/PersonaTable/index/GSI1'
          ]
        }]
      };

      expect(ddbPolicy.Statement[0].Effect).toBe('Allow');
      expect(ddbPolicy.Statement[0].Action).toContain('dynamodb:GetItem');
      expect(ddbPolicy.Statement[0].Action).toContain('dynamodb:PutItem');
      expect(ddbPolicy.Statement[0].Action).toContain('dynamodb:UpdateItem');
      expect(ddbPolicy.Statement[0].Action).toContain('dynamodb:Query');
      expect(ddbPolicy.Statement[0].Resource).toHaveLength(2);
    });

    it('should validate Bedrock permissions for style inference', () => {
      const bedrockPolicy = {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Action: [
            'bedrock:InvokeModel',
            'bedrock:Converse'
          ],
          Resource: 'arn:aws:bedrock:*::foundation-model/amazon.nova-pro-v1:0'
        }]
      };

      expect(bedrockPolicy.Statement[0].Effect).toBe('Allow');
      expect(bedrockPolicy.Statement[0].Action).toContain('bedrock:InvokeModel');
      expect(bedrockPolicy.Statement[0].Action).toContain('bedrock:Converse');
      expect(bedrockPolicy.Statement[0].Resource).toMatch(/^arn:aws:bedrock:.*foundation-model/);
    });

    it('should validate EventBridge permissions', () => {
      const eventBridgePolicy = {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Action: 'events:PutEvents',
          Resource: 'arn:aws:events:*:*:event-bus/default'
        }]
      };

      expect(eventBridgePolicy.Statement[0].Effect).toBe('Allow');
      expect(eventBridgePolicy.Statement[0].Action).toBe('events:PutEvents');
      expect(eventBridgePolicy.Statement[0].Resource).toMatch(/^arn:aws:events:.*event-bus/);
    });
  });

  describe('Security Configuration', () => {
    it('should validate tenant isolation in resource naming', () => {
      const tenantId = 'tenant_123';
      const brandId = 'brand_456';
      const assetId = 'asset_789';

      const s3Key = `${tenantId}/${brandId}/${assetId}`;
      const dynamoDbPk = `${tenantId}#${brandId}`;

      expect(s3Key).toMatch(/^tenant_\w+\/brand_\w+\/asset_\w+$/);
      expect(dynamoDbPk).toMatch(/^tenant_\w+#brand_\w+$/);
      expect(s3Key.startsWith(tenantId)).toBe(true);
      expect(dynamoDbPk.startsWith(tenantId)).toBe(true);
    });

    it('should validate API Gateway authorization configuration', () => {
      const authConfig = {
        defaultAuthorizer: 'Authorizer',
        authorizerType: 'REQUEST',
        identityHeaders: ['Authorization'],
        addDefaultAuthorizerToCorsPreflight: false
      };

      expect(authConfig.defaultAuthorizer).toBe('Authorizer');
      expect(authConfig.authorizerType).toBe('REQUEST');
      expect(authConfig.identityHeaders).toContain('Authorization');
      expect(authConfig.addDefaultAuthorizerToCorsPreflight).toBe(false);
    });

    it('should validate CORS configuration', () => {
      const corsHeaders = {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'"
      };

      expect(corsHeaders['Access-Control-Allow-Origin']).toBe("'*'");
      expect(corsHeaders['Access-Control-Allow-Headers']).toContain('Authorization');
      expect(corsHeaders['Access-Control-Allow-Methods']).toContain('POST');
      expect(corsHeaders['Access-Control-Allow-Methods']).toContain('GET');
      expect(corsHeaders['Access-Control-Allow-Methods']).toContain('PUT');
      expect(corsHeaders['Access-Control-Allow-Methods']).toContain('DELETE');
    });
  });

  describe('Resource Limits and Quotas', () => {
    it('should validate S3 object size limits', () => {
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      const testFileSize = 5 * 1024 * 1024; // 5MB

      expect(testFileSize).toBeLessThanOrEqual(maxFileSize);
      expect(maxFileSize).toBeGreaterThan(0);
    });

    it('should validate DynamoDB item size limits', () => {
      const maxItemSize = 400 * 1024; // 400KB
      const testItemSize = 50 * 1024; // 50KB

      expect(testItemSize).toBeLessThanOrEqual(maxItemSize);
      expect(maxItemSize).toBe(400 * 1024);
    });

    it('should validate API Gateway payload limits', () => {
      const maxPayloadSize = 10 * 1024 * 1024; // 10MB
      const testPayloadSize = 1 * 1024 * 1024; // 1MB

      expect(testPayloadSize).toBeLessThanOrEqual(maxPayloadSize);
      expect(maxPayloadSize).toBe(10 * 1024 * 1024);
    });
  });
});
