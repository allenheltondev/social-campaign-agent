import { vi } from 'vitest';

export class ModelMockFactory {
  static createModelMock(modelName = 'MockModel') {
    return {
      findById: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),

      validateEntity: vi.fn(),
      validateUpdateData: vi.fn(),

      _transformFromDynamoDB: vi.fn(),
      _transformToDynamoDB: vi.fn(),

      list: vi.fn(),
      findByIds: vi.fn(),
      findByCampaign: vi.fn(),
      findByPersona: vi.fn(),

      generateId: vi.fn(() => `mock-${modelName.toLowerCase()}-id-${Date.now()}`),

      __mockName: modelName,
      __isMock: true
    };
  }

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

  static createCampaignMock() {
    const baseMock = this.createModelMock('Campaign');

    return {
      ...baseMock,
      loadFullConfiguration: vi.fn()
    };
  }

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

  static setupErrorResponses(modelMock, errorType = 'ValidationError') {
    const error = new Error('Mock validation error');
    error.name = errorType;
    error.details = { errors: [{ field: 'test', message: 'Mock error' }] };

    modelMock.findById.mockRejectedValue(error);
    modelMock.save.mockRejectedValue(error);
    modelMock.update.mockRejectedValue(error);
    modelMock.delete.mockRejectedValue(error);
    modelMock.validateEntity.mockImplementation(() => {
      throw error;
    });
    modelMock.validateUpdateData.mockImplementation(() => {
      throw error;
    });
  }

  static verifyMockIsolation(modelMock) {
    const requiredMethods = ['findById', 'save', 'update', 'delete', 'validateEntity'];

    for (const method of requiredMethods) {
      if (!vi.isMockFunction(modelMock[method])) {
        return false;
      }
    }

    return modelMock.__isMock === true;
  }

  static createAllModelMocks() {
    return {
      Brand: this.createBrandMock(),
      Persona: this.createPersonaMock(),
      Campaign: this.createCampaignMock(),
      SocialPost: this.createSocialPostMock()
    };
  }

  static resetMock(modelMock) {
    Object.values(modelMock).forEach(method => {
      if (vi.isMockFunction(method)) {
        method.mockReset();
      }
    });
  }

  static resetAllMocks(modelMocks) {
    Object.values(modelMocks).forEach(mock => {
      this.resetMock(mock);
    });
  }
}

export function createMockModel(modelType, _overrides = {}) {
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

export function mockModelModule(modelType) {
  const mockModel = createMockModel(modelType);

  return {
    [modelType]: mockModel,
    [`${modelType}Schema`]: {},
    [`Create${modelType}RequestSchema`]: {},
    [`Update${modelType}RequestSchema`]: {},
    validateRequestBody: vi.fn(),
    validateQueryParams: vi.fn(),
    [`generate${modelType}Id`]: vi.fn(() => `mock-${modelType.toLowerCase()}-id`)
  };
}
