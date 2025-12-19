import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModelMockFactory, createMockModel } from '../utils/model-mocks.mjs';

/**
 * Example test demonstrating how to use model mocking utilities
 * for testing Lambda functions without actual DynamoDB access
 */

describe('Model Mocking Example', () => {
  let mockBrand, mockPersona, mockCampaign;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mocks for all models
    mockBrand = createMockModel('Brand');
    mockPersona = createMockModel('Persona');
    mockCampaign = createMockModel('Campaign');
  });

  it('should demonstrate basic model mocking for a Lambda function', async () => {
    // Setup mock responses
    const mockBrandData = {
      id: 'brand-123',
      name: 'Test Brand',
      status: 'active',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    };

    mockBrand.findById.mockResolvedValue(mockBrandData);

    // Mock a simple Lambda function that uses the Brand model
    const mockLambdaFunction = async (tenantId, brandId) => {
      const brand = await mockBrand.findById(tenantId, brandId);
      if (!brand) {
        return { statusCode: 404, body: JSON.stringify({ message: 'Brand not found' }) };
      }
      return { statusCode: 200, body: JSON.stringify(brand) };
    };

    // Test the function
    const result = await mockLambdaFunction('tenant-123', 'brand-123');

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual(mockBrandData);
    expect(mockBrand.findById).toHaveBeenCalledWith('tenant-123', 'brand-123');
  });

  it('should demonstrate error handling with model mocks', async () => {
    // Setup error response
    const error = new Error('Brand not found');
    error.name = 'NotFoundError';
    mockBrand.findById.mockRejectedValue(error);

    // Mock Lambda function with error handling
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
    // Setup multiple mock responses
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

    // Mock a function that creates a campaign with brand and persona validation
    const mockCreateCampaignFunction = async (tenantId, campaignData) => {
      // Validate brand exists
      const brand = await mockBrand.findById(tenantId, campaignData.brandId);
      if (!brand) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Brand not found' }) };
      }

      // Validate personas exist
      const personas = await mockPersona.findByIds(tenantId, campaignData.participants.personaIds);
      if (personas.length !== campaignData.participants.personaIds.length) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Some personas not found' }) };
      }

      // Create campaign
      const campaign = await mockCampaign.save(tenantId, campaignData);
      return { statusCode: 201, body: JSON.stringify(campaign) };
    };

    const result = await mockCreateCampaignFunction('tenant-123', mockCampaignData);

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body)).toEqual(mockCampaignData);

    // Verify all models were called correctly
    expect(mockBrand.findById).toHaveBeenCalledWith('tenant-123', 'brand-123');
    expect(mockPersona.findByIds).toHaveBeenCalledWith('tenant-123', ['persona-456']);
    expect(mockCampaign.save).toHaveBeenCalledWith('tenant-123', mockCampaignData);
  });

  it('should demonstrate using ModelMockFactory for setup', () => {
    // Create all model mocks at once
    const allMocks = ModelMockFactory.createAllModelMocks();

    expect(allMocks.Brand).toBeDefined();
    expect(allMocks.Persona).toBeDefined();
    expect(allMocks.Campaign).toBeDefined();
    expect(allMocks.SocialPost).toBeDefined();

    // Setup successful responses for all models
    ModelMockFactory.setupSuccessfulResponses(allMocks.Brand, { name: 'Test Brand' });
    ModelMockFactory.setupSuccessfulResponses(allMocks.Persona, { name: 'Test Persona' });

    // Verify setup worked
    expect(allMocks.Brand.findById).toBeDefined();
    expect(allMocks.Persona.findById).toBeDefined();

    // Reset all mocks
    ModelMockFactory.resetAllMocks(allMocks);

    // Verify reset worked
    expect(allMocks.Brand.findById.mock.calls.length).toBe(0);
    expect(allMocks.Persona.findById.mock.calls.length).toBe(0);
  });

  it('should demonstrate validation mocking', () => {
    const testData = { name: 'Test Brand', status: 'active' };

    // Mock validation success
    mockBrand.validateEntity.mockReturnValue({ id: 'brand-123', ...testData });
    mockBrand.validateUpdateData.mockReturnValue(testData);

    const validatedEntity = mockBrand.validateEntity(testData);
    const validatedUpdate = mockBrand.validateUpdateData(testData);

    expect(validatedEntity.id).toBe('brand-123');
    expect(validatedEntity.name).toBe('Test Brand');
    expect(validatedUpdate).toEqual(testData);

    // Mock validation error
    const validationError = new Error('Validation failed');
    validationError.name = 'ValidationError';
    mockBrand.validateEntity.mockImplementation(() => { throw validationError; });

    expect(() => mockBrand.validateEntity({})).toThrow('Validation failed');
  });
});
