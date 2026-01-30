import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModelMockFactory, createMockModel } from '../utils/model-mocks.mjs';

describe('Model Mocking Example', () => {
  let mockBrand, mockPersona, mockCampaign;

  beforeEach(() => {
    vi.clearAllMocks();

    mockBrand = createMockModel('Brand');
    mockPersona = createMockModel('Persona');
    mockCampaign = createMockModel('Campaign');
  });

  it('should demonstrate basic model mocking for a Lambda function', async () => {
    const mockBrandData = {
      id: 'brand-123',
      name: 'Test Brand',
      status: 'active',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    };

    mockBrand.findById.mockResolvedValue(mockBrandData);

    const mockLambdaFunction = async (tenantId, brandId) => {
      const brand = await mockBrand.findById(tenantId, brandId);
      if (!brand) {
        return { statusCode: 404, body: JSON.stringify({ message: 'Brand not found' }) };
      }
      return { statusCode: 200, body: JSON.stringify(brand) };
    };

    const result = await mockLambdaFunction('tenant-123', 'brand-123');

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual(mockBrandData);
    expect(mockBrand.findById).toHaveBeenCalledWith('tenant-123', 'brand-123');
  });

  it('should demonstrate error handling with model mocks', async () => {
    const error = new Error('Brand not found');
    error.name = 'NotFoundError';
    mockBrand.findById.mockRejectedValue(error);

    const mockLambdaFunction = async (tenantId, brandId) => {
      try {
        const brand = await mockBrand.findById(tenantId, brandId);
        return { statusCode: 200, body: JSON.stringify(brand) };
      } catch (err) {
        if (err.name === 'NotFoundError') {
          return { statusCode: 404, body: JSON.stringify({ message: 'Brand not found' }) };
        }
        return { statusCode: 500, body: JSON.stringify({ message: 'Internal server error' }) };
      }
    };

    const result = await mockLambdaFunction('tenant-123', 'brand-123');

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).message).toBe('Brand not found');
  });

  it('should demonstrate mocking multiple model interactions', async () => {
    const mockBrandData = { id: 'brand-123', name: 'Test Brand' };
    const mockPersonaData = { id: 'persona-456', name: 'Test Persona' };
    const mockCampaignData = {
      id: 'campaign-789',
      name: 'Test Campaign',
      brandId: 'brand-123',
      participants: { personaIds: ['persona-456'] }
    };

    mockBrand.findById.mockResolvedValue(mockBrandData);
    mockPersona.findByIds.mockResolvedValue([mockPersonaData]);
    mockCampaign.save.mockResolvedValue(mockCampaignData);

    const mockCreateCampaignFunction = async (tenantId, campaignData) => {
      const brand = await mockBrand.findById(tenantId, campaignData.brandId);
      if (!brand) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Brand not found' }) };
      }

      const personas = await mockPersona.findByIds(tenantId, campaignData.participants.personaIds);
      if (personas.length !== campaignData.participants.personaIds.length) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Some personas not found' }) };
      }

      const campaign = await mockCampaign.save(tenantId, campaignData);
      return { statusCode: 201, body: JSON.stringify(campaign) };
    };

    const result = await mockCreateCampaignFunction('tenant-123', mockCampaignData);

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body)).toEqual(mockCampaignData);

    expect(mockBrand.findById).toHaveBeenCalledWith('tenant-123', 'brand-123');
    expect(mockPersona.findByIds).toHaveBeenCalledWith('tenant-123', ['persona-456']);
    expect(mockCampaign.save).toHaveBeenCalledWith('tenant-123', mockCampaignData);
  });

  it('should demonstrate using ModelMockFactory for setup', () => {
    const allMocks = ModelMockFactory.createAllModelMocks();

    expect(allMocks.Brand).toBeDefined();
    expect(allMocks.Persona).toBeDefined();
    expect(allMocks.Campaign).toBeDefined();
    expect(allMocks.SocialPost).toBeDefined();

    ModelMockFactory.setupSuccessfulResponses(allMocks.Brand, { name: 'Test Brand' });
    ModelMockFactory.setupSuccessfulResponses(allMocks.Persona, { name: 'Test Persona' });

    expect(allMocks.Brand.findById).toBeDefined();
    expect(allMocks.Persona.findById).toBeDefined();

    ModelMockFactory.resetAllMocks(allMocks);

    expect(allMocks.Brand.findById.mock.calls.length).toBe(0);
    expect(allMocks.Persona.findById.mock.calls.length).toBe(0);
  });
});
