import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({
    send: mockSend
  })),
  QueryCommand: vi.fn()
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: vi.fn((obj) => obj),
  unmarshall: vi.fn((item) => {
    const result = {};
    for (const [key, value] of Object.entries(item)) {
      if (value.S) result[key] = value.S;
      else if (value.N) result[key] = parseInt(value.N);
      else if (value.L) result[key] = value.L.map(v => v.S || parseInt(v.N) || v);
      else if (value.M) {
        result[key] = {};
        for (const [subKey, subValue] of Object.entries(value.M)) {
          if (subValue.S) result[key][subKey] = subValue.S;
          else if (subValue.N) result[key][subKey] = parseInt(subValue.N);
          else if (subValue.L) result[key][subKey] = subValue.L.map(v => v.S || parseInt(v.N) || v);
          else result[key][subKey] = subValue;
        }
      }
      else result[key] = value;
    }
    return result;
  })
}));

vi.mock('../../utils/api-response.mjs', () => ({
  formatResponse: vi.fn((statusCode, body) => ({
    statusCode,
    body: typeof body === 'string' ? body : JSON.stringify(body)
  }))
}));

const { handler: listBrands } = await import('../../functions/brand/list-brands.mjs');

describe('Brand Search and Discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TABLE_NAME = 'test-table';
  });

  describe('List Brands Function', () => {
    const mockBrands = [
      {
        brandId: 'brand_01234567890123456789012345',
        tenantId: 'test-tenant',
        name: 'Tech Innovators',
        ethos: 'Innovation through technology',
        coreValues: ['Innovation', 'Quality', 'Excellence'],
        personalityTraits: { formal: 4, innovative: 5, trustworthy: 4, playful: 2 },
        contentStandards: {
          toneOfVoice: 'Professional',
          primaryAudience: 'professionals',
          approvalThreshold: 8
        },
        visualGuidelines: {},
        status: 'active',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        version: 1
      },
      {
        brandId: 'brand_01234567890123456789012346',
        tenantId: 'test-tenant',
        name: 'Creative Solutions',
        ethos: 'Creativity meets business',
        coreValues: ['Creativity', 'Innovation', 'Results'],
        personalityTraits: { formal: 2, innovative: 5, trustworthy: 4, playful: 4 },
        contentStandards: {
          toneOfVoice: 'Casual',
          primaryAudience: 'creative',
          approvalThreshold: 6
        },
        visualGuidelines: {},
        status: 'active',
        createdAt: '2024-01-02T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        version: 1
      }
    ];

    it('should list all brands for a tenant', async () => {
      mockSend.mockResolvedValue({
        Items: mockBrands.map(brand => ({
          brandId: { S: brand.brandId },
          tenantId: { S: brand.tenantId },
          name: { S: brand.name },
          ethos: { S: brand.ethos },
          coreValues: { L: brand.coreValues.map(v => ({ S: v })) },
          personalityTraits: {
            M: {
              formal: { N: brand.personalityTraits.formal.toString() },
              innovative: { N: brand.personalityTraits.innovative.toString() },
              trustworthy: { N: brand.personalityTraits.trustworthy.toString() },
              playful: { N: brand.personalityTraits.playful.toString() }
            }
          },
          contentStandards: {
            M: {
              toneOfVoice: { S: brand.contentStandards.toneOfVoice },
              primaryAudience: { S: brand.contentStandards.primaryAudience },
              approvalThreshold: { N: brand.contentStandards.approvalThreshold.toString() }
            }
          },
          visualGuidelines: { M: {} },
          status: { S: brand.status },
          createdAt: { S: brand.createdAt },
          updatedAt: { S: brand.updatedAt },
          version: { N: brand.version.toString() }
        })),
        LastEvaluatedKey: null
      });

      const event = {
        tenantId: 'test-tenant',
        queryStringParameters: {}
      };

      const result = await listBrands(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.brands).toHaveLength(2);
      expect(body.brands[0].name).toBe('Tech Innovators');
      expect(body.brands[1].name).toBe('Creative Solutions');
      expect(body.pagination.hasNextPage).toBe(false);
    });

    it('should filter brands by status', async () => {
      const inactiveBrand = { ...mockBrands[0], status: 'inactive' };

      mockSend.mockResolvedValue({
        Items: [mockBrands[1]].map(brand => ({
          brandId: { S: brand.brandId },
          tenantId: { S: brand.tenantId },
          name: { S: brand.name },
          ethos: { S: brand.ethos },
          coreValues: { L: brand.coreValues.map(v => ({ S: v })) },
          personalityTraits: {
            M: {
              formal: { N: brand.personalityTraits.formal.toString() },
              innovative: { N: brand.personalityTraits.innovative.toString() },
              trustworthy: { N: brand.personalityTraits.trustworthy.toString() },
              playful: { N: brand.personalityTraits.playful.toString() }
            }
          },
          contentStandards: {
            M: {
              toneOfVoice: { S: brand.contentStandards.toneOfVoice },
              primaryAudience: { S: brand.contentStandards.primaryAudience },
              approvalThreshold: { N: brand.contentStandards.approvalThreshold.toString() }
            }
          },
          visualGuidelines: { M: {} },
          status: { S: brand.status },
          createdAt: { S: brand.createdAt },
          updatedAt: { S: brand.updatedAt },
          version: { N: brand.version.toString() }
        })),
        LastEvaluatedKey: null
      });

      const event = {
        tenantId: 'test-tenant',
        queryStringParameters: {
          status: 'active'
        }
      };

      const result = await listBrands(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.brands).toHaveLength(1);
      expect(body.brands[0].status).toBe('active');
    });

    it('should filter brands by primary audience', async () => {
      mockSend.mockResolvedValue({
        Items: [mockBrands[0]].map(brand => ({
          brandId: { S: brand.brandId },
          tenantId: { S: brand.tenantId },
          name: { S: brand.name },
          ethos: { S: brand.ethos },
          coreValues: { L: brand.coreValues.map(v => ({ S: v })) },
          personalityTraits: {
            M: {
              formal: { N: brand.personalityTraits.formal.toString() },
              innovative: { N: brand.personalityTraits.innovative.toString() },
              trustworthy: { N: brand.personalityTraits.trustworthy.toString() },
              playful: { N: brand.personalityTraits.playful.toString() }
            }
          },
          contentStandards: {
            M: {
              toneOfVoice: { S: brand.contentStandards.toneOfVoice },
              primaryAudience: { S: brand.contentStandards.primaryAudience },
              approvalThreshold: { N: brand.contentStandards.approvalThreshold.toString() }
            }
          },
          visualGuidelines: { M: {} },
          status: { S: brand.status },
          createdAt: { S: brand.createdAt },
          updatedAt: { S: brand.updatedAt },
          version: { N: brand.version.toString() }
        })),
        LastEvaluatedKey: null
      });

      const event = {
        tenantId: 'test-tenant',
        queryStringParameters: {
          primaryAudience: 'professionals'
        }
      };

      const result = await listBrands(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.brands).toHaveLength(1);
      expect(body.brands[0].contentStandards.primaryAudience).toBe('professionals');
    });

    it('should search brands by text', async () => {
      mockSend.mockResolvedValue({
        Items: mockBrands.map(brand => ({
          brandId: { S: brand.brandId },
          tenantId: { S: brand.tenantId },
          name: { S: brand.name },
          ethos: { S: brand.ethos },
          coreValues: { L: brand.coreValues.map(v => ({ S: v })) },
          personalityTraits: {
            M: {
              formal: { N: brand.personalityTraits.formal.toString() },
              innovative: { N: brand.personalityTraits.innovative.toString() },
              trustworthy: { N: brand.personalityTraits.trustworthy.toString() },
              playful: { N: brand.personalityTraits.playful.toString() }
            }
          },
          contentStandards: {
            M: {
              toneOfVoice: { S: brand.contentStandards.toneOfVoice },
              primaryAudience: { S: brand.contentStandards.primaryAudience },
              approvalThreshold: { N: brand.contentStandards.approvalThreshold.toString() }
            }
          },
          visualGuidelines: { M: {} },
          status: { S: brand.status },
          createdAt: { S: brand.createdAt },
          updatedAt: { S: brand.updatedAt },
          version: { N: brand.version.toString() }
        })),
        LastEvaluatedKey: null
      });

      const event = {
        tenantId: 'test-tenant',
        queryStringParameters: {
          search: 'innovation'
        }
      };

      const result = await listBrands(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.brands).toHaveLength(2);
      body.brands.forEach(brand => {
        const coreValuesArray = Array.isArray(brand.coreValues) ? brand.coreValues : [];
        const searchableText = [brand.name, brand.ethos, ...coreValuesArray].join(' ').toLowerCase();
        expect(searchableText.includes('innovation')).toBe(true);
      });
    });

    it('should handle pagination correctly', async () => {
      const lastEvaluatedKey = {
        pk: { S: 'test-tenant#brand_01234567890123456789012345' },
        sk: { S: 'metadata' },
        GSI1PK: { S: 'test-tenant' },
        GSI1SK: { S: 'BRAND#2024-01-01T00:00:00.000Z' }
      };

      mockSend.mockResolvedValue({
        Items: [mockBrands[0]].map(brand => ({
          brandId: { S: brand.brandId },
          tenantId: { S: brand.tenantId },
          name: { S: brand.name },
          ethos: { S: brand.ethos },
          coreValues: { L: brand.coreValues.map(v => ({ S: v })) },
          personalityTraits: {
            M: {
              formal: { N: brand.personalityTraits.formal.toString() },
              innovative: { N: brand.personalityTraits.innovative.toString() },
              trustworthy: { N: brand.personalityTraits.trustworthy.toString() },
              playful: { N: brand.personalityTraits.playful.toString() }
            }
          },
          contentStandards: {
            M: {
              toneOfVoice: { S: brand.contentStandards.toneOfVoice },
              primaryAudience: { S: brand.contentStandards.primaryAudience },
              approvalThreshold: { N: brand.contentStandards.approvalThreshold.toString() }
            }
          },
          visualGuidelines: { M: {} },
          status: { S: brand.status },
          createdAt: { S: brand.createdAt },
          updatedAt: { S: brand.updatedAt },
          version: { N: brand.version.toString() }
        })),
        LastEvaluatedKey: lastEvaluatedKey
      });

      const event = {
        tenantId: 'test-tenant',
        queryStringParameters: {
          limit: '1'
        }
      };

      const result = await listBrands(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.brands).toHaveLength(1);
      expect(body.pagination.hasNextPage).toBe(true);
      expect(body.pagination.lastEvaluatedKey).toBeDefined();
    });

    it('should filter by approval threshold range', async () => {
      mockSend.mockResolvedValue({
        Items: [mockBrands[1]].map(brand => ({
          brandId: { S: brand.brandId },
          tenantId: { S: brand.tenantId },
          name: { S: brand.name },
          ethos: { S: brand.ethos },
          coreValues: { L: brand.coreValues.map(v => ({ S: v })) },
          personalityTraits: {
            M: {
              formal: { N: brand.personalityTraits.formal.toString() },
              innovative: { N: brand.personalityTraits.innovative.toString() },
              trustworthy: { N: brand.personalityTraits.trustworthy.toString() },
              playful: { N: brand.personalityTraits.playful.toString() }
            }
          },
          contentStandards: {
            M: {
              toneOfVoice: { S: brand.contentStandards.toneOfVoice },
              primaryAudience: { S: brand.contentStandards.primaryAudience },
              approvalThreshold: { N: brand.contentStandards.approvalThreshold.toString() }
            }
          },
          visualGuidelines: { M: {} },
          status: { S: brand.status },
          createdAt: { S: brand.createdAt },
          updatedAt: { S: brand.updatedAt },
          version: { N: brand.version.toString() }
        })),
        LastEvaluatedKey: null
      });

      const event = {
        tenantId: 'test-tenant',
        queryStringParameters: {
          minApprovalThreshold: '5',
          maxApprovalThreshold: '7'
        }
      };

      const result = await listBrands(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.brands).toHaveLength(1);
      expect(body.brands[0].contentStandards.approvalThreshold).toBe(6);
    });

    it('should return 400 when tenant ID is missing', async () => {
      const event = {
        queryStringParameters: {}
      };

      const result = await listBrands(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).message).toBe('Tenant ID is required');
    });

    it('should handle DynamoDB errors', async () => {
      mockSend.mockRejectedValue(new Error('DynamoDB error'));

      const event = {
        tenantId: 'test-tenant',
        queryStringParameters: {}
      };

      const result = await listBrands(event);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).message).toBe('Internal server error');
    });

    it('should handle empty results', async () => {
      mockSend.mockResolvedValue({
        Items: [],
        LastEvaluatedKey: null
      });

      const event = {
        tenantId: 'test-tenant',
        queryStringParameters: {}
      };

      const result = await listBrands(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.brands).toHaveLength(0);
      expect(body.pagination.hasNextPage).toBe(false);
    });

    it('should combine search and filters correctly', async () => {
      mockSend.mockResolvedValue({
        Items: [mockBrands[0]].map(brand => ({
          brandId: { S: brand.brandId },
          tenantId: { S: brand.tenantId },
          name: { S: brand.name },
          ethos: { S: brand.ethos },
          coreValues: { L: brand.coreValues.map(v => ({ S: v })) },
          personalityTraits: {
            M: {
              formal: { N: brand.personalityTraits.formal.toString() },
              innovative: { N: brand.personalityTraits.innovative.toString() },
              trustworthy: { N: brand.personalityTraits.trustworthy.toString() },
              playful: { N: brand.personalityTraits.playful.toString() }
            }
          },
          contentStandards: {
            M: {
              toneOfVoice: { S: brand.contentStandards.toneOfVoice },
              primaryAudience: { S: brand.contentStandards.primaryAudience },
              approvalThreshold: { N: brand.contentStandards.approvalThreshold.toString() }
            }
          },
          visualGuidelines: { M: {} },
          status: { S: brand.status },
          createdAt: { S: brand.createdAt },
          updatedAt: { S: brand.updatedAt },
          version: { N: brand.version.toString() }
        })),
        LastEvaluatedKey: null
      });

      const event = {
        tenantId: 'test-tenant',
        queryStringParameters: {
          search: 'tech',
          status: 'active',
          primaryAudience: 'professionals'
        }
      };

      const result = await listBrands(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.brands).toHaveLength(1);
      expect(body.brands[0].name).toBe('Tech Innovators');
      expect(body.brands[0].status).toBe('active');
      expect(body.brands[0].contentStandards.primaryAudience).toBe('professionals');
    });
  });
});
