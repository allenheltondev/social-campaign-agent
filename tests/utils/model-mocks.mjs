import { vi } from 'vitest';

/**
 * Test utilities for mocking model methods independently
 * Enables unit testing without actual DynamoDB access
 */

export class ModelMockFactory {
  /**
   * Creates a mock for any model class with standard CRUD methods
   * @param {string} modelName - Name of the model for debugging
   * @returns {Object} Mock model with all standard methods
   */
  static createModelMock(modelName = 'MockModel') {
    return {
      // Core CRUD operations
      findById: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),

      // Validation methods
      validateEntity: vi.fn(),
      validateUpdateData: vi.fn(),

      // Internal transformation methods
      _transformFromDynamoDB: vi.fn(),
      _transformToDynamoDB: vi.fn(),

      // Model-specific methods that might exist
      list: vi.fn(),
      findByIds: vi.fn(),
      findByCampaign: vi.fn(),
      findByPersona: vi.fn(),

      // Utility methods
      generateId: vi.fn(() => `mock-${modelName.toLowerCase()}-id-${Date.now()}`),

      // Meta information for testing
      __mockName: modelName,
      __isMock: true
    };
  }

  /**
   * Creates a mock for the Brand model with specific methods
   * @returns {Object} Mock Brand model
   */
  static createBrandMock() {
    const baseMock = this.createModelMock('Brand');

    return {
      ...baseMock,
      getDefaultBrandConfiguration: vi.fn(() => ({
        id: null,
        platformGuidelines: {
          enabled: ['twitter', 'linkedin', 'instagram', 'facebook'],
          defaults: {
            twitter: { defaultAsset: 'none', linkPolicy: 'allowed' },
            linkedin: { defaultAsset: 'none', linkPolicy: 'allowed' },
            instagram: { defaultAsset: 'image', linkPolicy: 'discouraged' },
            facebook: { defaultAsset: 'none', linkPolicy: 'allowed' }
          }
        }
      })),
      transformFromDynamoDB: vi.fn(),
      transformToDynamoDB: vi.fn(),
      extractCadenceDefaults: vi.fn(),
      extractAssetRequirements: vi.fn(),
      extractContentRestrictions: vi.fn()
    };
  }

  /**
   * Creates a mock for the Persona model with specific methods
   * @returns {Object} Mock Persona model
   */
  static createPersonaMock() {
    const baseMock = this.createModelMock('Persona');

    return {
      ...baseMock,
      list: vi.fn(),
      findByIds: vi.fn(),
      transformFromDynamoDB: vi.fn(),
      enrichForCampaign: vi.fn(),
      mergeEffectiveRestrictions: vi.fn()
    };
  }

  /**
   * Creates a mock for the Campaign model with specific methods
   * @returns {Object} Mock Campaign model
   */
  static createCampaignMock() {
    const baseMock = this.createModelMock('Campaign');

    return {
      ...baseMock,
      loadFullConfiguration: vi.fn()
    };
  }

  /**
   * Creates a mock for the SocialPost model with specific methods
   * @returns {Object} Mock SocialPost model
   */
  static createSocialPostMock() {
    const baseMock = this.createModelMock('SocialPost');

    return {
      ...baseMock,
      findByCampaign: vi.fn(),
      findByPersona: vi.fn(),
      updateStatus: vi.fn(),
      updateContent: vi.fn(),
      createSocialPosts: vi.fn()
    };
  }

  /**
   * Sets up default successful responses for a model mock
   * @param {Object} modelMock - The mock model to configure
   * @param {Object} sampleData - Sample data to return from methods
   */
  static setupSuccessfulResponses(modelMock, sampleData = {}) {
    const defaultEntity = {
      id: 'mock-id-123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...sampleData
    };

    modelMock.findById.mockResolvedValue(defaultEntity);
    modelMock.save.mockResolvedValue(defaultEntity);
    modelMock.update.mockResolvedValue(defaultEntity);
    modelMock.delete.mockResolvedValue({ success: true });
    modelMock.validateEntity.mockReturnValue(defaultEntity);
    modelMock.validateUpdateData.mockReturnValue(sampleData);

    if (modelMock.list) {
      modelMock.list.mockResolvedValue({
        items: [defaultEntity],
        pagination: { limit: 20, hasNextPage: false, nextToken: null }
      });
    }

    if (modelMock.findByIds) {
      modelMock.findByIds.mockResolvedValue([defaultEntity]);
    }
  }

  /**
   * Sets up error responses for a model mock
   * @param {Object} modelMock - The mock model to configure
   * @param {string} errorType - Type of error to simulate
   */
  static setupErrorResponses(modelMock, errorType = 'ValidationError') {
    const error = new Error('Mock validation error');
    error.name = errorType;
    error.details = { errors: [{ field: 'test', message: 'Mock error' }] };

    modelMock.findById.mockRejectedValue(error);
    modelMock.save.mockRejectedValue(error);
    modelMock.update.mockRejectedValue(error);
    modelMock.delete.mockRejectedValue(error);
    modelMock.validateEntity.mockImplementation(() => { throw error; });
    modelMock.validateUpdateData.mockImplementation(() => { throw error; });
  }

  /**
   * Verifies that a model mock can be used independently without DynamoDB
   * @param {Object} modelMock - The mock model to verify
   * @returns {boolean} True if the mock is properly isolated
   */
  static verifyMockIsolation(modelMock) {
    // Check that all methods are mocked
    const requiredMethods = ['findById', 'save', 'update', 'delete', 'validateEntity'];

    for (const method of requiredMethods) {
      if (!vi.isMockFunction(modelMock[method])) {
        return false;
      }
    }

    // Check that mock is marked as such
    return modelMock.__isMock === true;
  }

  /**
   * Creates a complete mock suite for all models
   * @returns {Object} Object containing mocks for all models
   */
  static createAllModelMocks() {
    return {
      Brand: this.createBrandMock(),
      Persona: this.createPersonaMock(),
      Campaign: this.createCampaignMock(),
      SocialPost: this.createSocialPostMock()
    };
  }

  /**
   * Resets all mocks in a model mock object
   * @param {Object} modelMock - The mock model to reset
   */
  static resetMock(modelMock) {
    Object.values(modelMock).forEach(method => {
      if (vi.isMockFunction(method)) {
        method.mockReset();
      }
    });
  }

  /**
   * Resets all mocks in a collection of model mocks
   * @param {Object} modelMocks - Object containing multiple model mocks
   */
  static resetAllMocks(modelMocks) {
    Object.values(modelMocks).forEach(mock => {
      this.resetMock(mock);
    });
  }
}

/**
 * Helper function to create a mock model with realistic data
 * @param {string} modelType - Type of model (Brand, Persona, Campaign, SocialPost)
 * @param {Object} overrides - Data to override defaults
 * @returns {Object} Mock model with realistic data
 */
export function createMockModel(modelType, overrides = {}) {
  const factory = ModelMockFactory;

  switch (modelType) {
    case 'Brand':
      return factory.createBrandMock();
    case 'Persona':
      return factory.createPersonaMock();
    case 'Campaign':
      return factory.createCampaignMock();
    case 'SocialPost':
      return factory.createSocialPostMock();
    default:
      return factory.createModelMock(modelType);
  }
}

/**
 * Helper function to mock a model module for testing
 * @param {string} modelPath - Path to the model module
 * @param {string} modelType - Type of model to mock
 * @returns {Object} Mock module
 */
export function mockModelModule(modelPath, modelType) {
  const mockModel = createMockModel(modelType);

  return {
    [modelType]: mockModel,
    // Export any schemas or utilities that might be imported
    [`${modelType}Schema`]: {},
    [`Create${modelType}RequestSchema`]: {},
    [`Update${modelType}RequestSchema`]: {},
    validateRequestBody: vi.fn(),
    validateQueryParams: vi.fn(),
    [`generate${modelType}Id`]: vi.fn(() => `mock-${modelType.toLowerCase()}-id`)
  };
}
