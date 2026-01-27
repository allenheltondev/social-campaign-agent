import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SocialPost } from '../../models/social-post.mjs';

vi.mock('@aws-sdk/client-dynamodb');
vi.mock('../../utils/logger.mjs', () => ({
  campaignLogger: {
    error: vi.fn()
  }
}));

describe('Asset Selection Reasoning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Posts with assigned assets', () => {
    it('should include selection reasoning for posts with assets', () => {
      const postWithAsset = {
        id: 'post_123',
        campaignId: 'campaign_123',
        personaId: 'persona_123',
        platform: 'linkedin',
        scheduledAt: '2024-01-15T10:00:00Z',
        topic: 'Product launch announcement',
        intent: 'announce',
        assignedAsset: {
          type: 'internal',
          assetId: 'asset_123',
          url: null,
          description: 'Product hero image',
          contentType: 'image/jpeg',
          source: 'brand',
          isDefault: false,
          selectionReason: {
            primaryFactor: 'usage-intent',
            confidence: 'high',
            explanation: 'Asset usage intent matches platform (linkedin) and theme (product)',
            alternativesConsidered: ['asset_456', 'asset_789']
          },
          assignedAt: '2024-01-15T09:00:00Z'
        },
        status: 'planned',
        lastError: null,
        createdAt: '2024-01-15T09:00:00Z',
        updatedAt: '2024-01-15T09:00:00Z'
      };

      const validated = SocialPost.validateEntity(postWithAsset);

      expect(validated.assignedAsset).toBeDefined();
      expect(validated.assignedAsset.selectionReason).toBeDefined();
      expect(validated.assignedAsset.selectionReason.primaryFactor).toBe('usage-intent');
      expect(validated.assignedAsset.selectionReason.confidence).toBe('high');
      expect(validated.assignedAsset.selectionReason.explanation).toBeTruthy();
      expect(validated.assignedAsset.selectionReason.alternativesConsidered).toHaveLength(2);
    });

    it('should validate all primary factor types', () => {
      const factors = ['usage-intent', 'description-match', 'platform-fit', 'default-required', 'persona-alignment'];

      factors.forEach(factor => {
        const post = {
          id: 'post_123',
          campaignId: 'campaign_123',
          personaId: 'persona_123',
          platform: 'twitter',
          scheduledAt: '2024-01-15T10:00:00Z',
          topic: 'Test topic',
          intent: 'educate',
          assignedAsset: {
            type: 'external',
            assetId: null,
            url: 'https://example.com/image.jpg',
            description: 'Test image',
            contentType: 'image/jpeg',
            source: 'campaign',
            isDefault: false,
            selectionReason: {
              primaryFactor: factor,
              confidence: 'medium',
              explanation: `Selected based on ${factor}`,
              alternativesConsidered: []
            },
            assignedAt: '2024-01-15T09:00:00Z'
          },
          status: 'planned',
          lastError: null,
          createdAt: '2024-01-15T09:00:00Z',
          updatedAt: '2024-01-15T09:00:00Z'
        };

        const validated = SocialPost.validateEntity(post);
        expect(validated.assignedAsset.selectionReason.primaryFactor).toBe(factor);
      });
    });

    it('should validate all confidence levels', () => {
      const confidenceLevels = ['high', 'medium', 'low'];

      confidenceLevels.forEach(confidence => {
        const post = {
          id: 'post_123',
          campaignId: 'campaign_123',
          personaId: 'persona_123',
          platform: 'twitter',
          scheduledAt: '2024-01-15T10:00:00Z',
          topic: 'Test topic',
          intent: 'opinion',
          assignedAsset: {
            type: 'internal',
            assetId: 'asset_123',
            url: null,
            description: 'Test asset',
            contentType: 'image/png',
            source: 'brand',
            isDefault: false,
            selectionReason: {
              primaryFactor: 'description-match',
              confidence: confidence,
              explanation: 'Asset description matches post topic',
              alternativesConsidered: []
            },
            assignedAt: '2024-01-15T09:00:00Z'
          },
          status: 'planned',
          lastError: null,
          createdAt: '2024-01-15T09:00:00Z',
          updatedAt: '2024-01-15T09:00:00Z'
        };

        const validated = SocialPost.validateEntity(post);
        expect(validated.assignedAsset.selectionReason.confidence).toBe(confidence);
      });
    });

    it('should require explanation for selection reasoning', () => {
      const postWithoutExplanation = {
        id: 'post_123',
        campaignId: 'campaign_123',
        personaId: 'persona_123',
        platform: 'instagram',
        scheduledAt: '2024-01-15T10:00:00Z',
        topic: 'Test topic',
        intent: 'social_proof',
        assignedAsset: {
          type: 'internal',
          assetId: 'asset_123',
          url: null,
          description: 'Test asset',
          contentType: 'image/jpeg',
          source: 'brand',
          isDefault: false,
          selectionReason: {
            primaryFactor: 'platform-fit',
            confidence: 'high',
            explanation: 'Short',
            alternativesConsidered: []
          },
          assignedAt: '2024-01-15T09:00:00Z'
        },
        status: 'planned',
        lastError: null,
        createdAt: '2024-01-15T09:00:00Z',
        updatedAt: '2024-01-15T09:00:00Z'
      };

      expect(() => SocialPost.validateEntity(postWithoutExplanation)).toThrow();
    });

    it('should handle default assets with required reasoning', () => {
      const postWithDefaultAsset = {
        id: 'post_123',
        campaignId: 'campaign_123',
        personaId: 'persona_123',
        platform: 'linkedin',
        scheduledAt: '2024-01-15T10:00:00Z',
        topic: 'Brand announcement',
        intent: 'announce',
        assignedAsset: {
          type: 'internal',
          assetId: 'asset_123',
          url: null,
          description: 'Brand logo',
          contentType: 'image/png',
          source: 'brand',
          isDefault: true,
          selectionReason: {
            primaryFactor: 'default-required',
            confidence: 'high',
            explanation: 'This is a default brand asset that must be included in all campaigns',
            alternativesConsidered: []
          },
          assignedAt: '2024-01-15T09:00:00Z'
        },
        status: 'planned',
        lastError: null,
        createdAt: '2024-01-15T09:00:00Z',
        updatedAt: '2024-01-15T09:00:00Z'
      };

      const validated = SocialPost.validateEntity(postWithDefaultAsset);

      expect(validated.assignedAsset.isDefault).toBe(true);
      expect(validated.assignedAsset.selectionReason.primaryFactor).toBe('default-required');
    });
  });

  describe('Posts without assets', () => {
    it('should include explanation for posts without assets', () => {
      const postWithoutAsset = {
        id: 'post_123',
        campaignId: 'campaign_123',
        personaId: 'persona_123',
        platform: 'twitter',
        scheduledAt: '2024-01-15T10:00:00Z',
        topic: 'Thought leadership post',
        intent: 'opinion',
        noAssetReason: {
          reason: 'content-better-without',
          explanation: 'This thought leadership post is more impactful as pure text without visual distractions'
        },
        status: 'planned',
        lastError: null,
        createdAt: '2024-01-15T09:00:00Z',
        updatedAt: '2024-01-15T09:00:00Z'
      };

      const validated = SocialPost.validateEntity(postWithoutAsset);

      expect(validated.noAssetReason).toBeDefined();
      expect(validated.noAssetReason.reason).toBe('content-better-without');
      expect(validated.noAssetReason.explanation).toBeTruthy();
      expect(validated.noAssetReason.explanation.length).toBeGreaterThanOrEqual(10);
    });

    it('should validate all no-asset reason types', () => {
      const reasons = ['no-suitable-match', 'insufficient-assets', 'content-better-without', 'all-assets-used'];

      reasons.forEach(reason => {
        const post = {
          id: 'post_123',
          campaignId: 'campaign_123',
          personaId: 'persona_123',
          platform: 'facebook',
          scheduledAt: '2024-01-15T10:00:00Z',
          topic: 'Test topic',
          intent: 'educate',
          noAssetReason: {
            reason: reason,
            explanation: `Post has no asset because: ${reason}`
          },
          status: 'planned',
          lastError: null,
          createdAt: '2024-01-15T09:00:00Z',
          updatedAt: '2024-01-15T09:00:00Z'
        };

        const validated = SocialPost.validateEntity(post);
        expect(validated.noAssetReason.reason).toBe(reason);
      });
    });

    it('should require explanation for no-asset reason', () => {
      const postWithoutExplanation = {
        id: 'post_123',
        campaignId: 'campaign_123',
        personaId: 'persona_123',
        platform: 'instagram',
        scheduledAt: '2024-01-15T10:00:00Z',
        topic: 'Test topic',
        intent: 'invite_discussion',
        noAssetReason: {
          reason: 'no-suitable-match',
          explanation: 'Short'
        },
        status: 'planned',
        lastError: null,
        createdAt: '2024-01-15T09:00:00Z',
        updatedAt: '2024-01-15T09:00:00Z'
      };

      expect(() => SocialPost.validateEntity(postWithoutExplanation)).toThrow();
    });
  });

  describe('Alternative assets tracking', () => {
    it('should list alternative assets that were considered', () => {
      const postWithAlternatives = {
        id: 'post_123',
        campaignId: 'campaign_123',
        personaId: 'persona_123',
        platform: 'linkedin',
        scheduledAt: '2024-01-15T10:00:00Z',
        topic: 'Product feature highlight',
        intent: 'educate',
        assignedAsset: {
          type: 'internal',
          assetId: 'asset_123',
          url: null,
          description: 'Feature screenshot',
          contentType: 'image/png',
          source: 'campaign',
          isDefault: false,
          selectionReason: {
            primaryFactor: 'description-match',
            confidence: 'high',
            explanation: 'Screenshot directly shows the feature being discussed in the post',
            alternativesConsidered: ['asset_456', 'asset_789', 'asset_101']
          },
          assignedAt: '2024-01-15T09:00:00Z'
        },
        status: 'planned',
        lastError: null,
        createdAt: '2024-01-15T09:00:00Z',
        updatedAt: '2024-01-15T09:00:00Z'
      };

      const validated = SocialPost.validateEntity(postWithAlternatives);

      expect(validated.assignedAsset.selectionReason.alternativesConsidered).toBeDefined();
      expect(validated.assignedAsset.selectionReason.alternativesConsidered).toHaveLength(3);
      expect(validated.assignedAsset.selectionReason.alternativesConsidered).toContain('asset_456');
    });

    it('should allow empty alternatives list', () => {
      const postWithNoAlternatives = {
        id: 'post_123',
        campaignId: 'campaign_123',
        personaId: 'persona_123',
        platform: 'twitter',
        scheduledAt: '2024-01-15T10:00:00Z',
        topic: 'Quick update',
        intent: 'announce',
        assignedAsset: {
          type: 'internal',
          assetId: 'asset_123',
          url: null,
          description: 'Only available asset',
          contentType: 'image/jpeg',
          source: 'brand',
          isDefault: false,
          selectionReason: {
            primaryFactor: 'description-match',
            confidence: 'medium',
            explanation: 'Only one asset available that matches the post topic',
            alternativesConsidered: []
          },
          assignedAt: '2024-01-15T09:00:00Z'
        },
        status: 'planned',
        lastError: null,
        createdAt: '2024-01-15T09:00:00Z',
        updatedAt: '2024-01-15T09:00:00Z'
      };

      const validated = SocialPost.validateEntity(postWithNoAlternatives);

      expect(validated.assignedAsset.selectionReason.alternativesConsidered).toBeDefined();
      expect(validated.assignedAsset.selectionReason.alternativesConsidered).toHaveLength(0);
    });
  });

  describe('Posts without asset fields', () => {
    it('should allow posts without assignedAsset or noAssetReason', () => {
      const basicPost = {
        id: 'post_123',
        campaignId: 'campaign_123',
        personaId: 'persona_123',
        platform: 'facebook',
        scheduledAt: '2024-01-15T10:00:00Z',
        topic: 'General post',
        intent: 'educate',
        status: 'planned',
        lastError: null,
        createdAt: '2024-01-15T09:00:00Z',
        updatedAt: '2024-01-15T09:00:00Z'
      };

      const validated = SocialPost.validateEntity(basicPost);

      expect(validated.assignedAsset).toBeUndefined();
      expect(validated.noAssetReason).toBeUndefined();
    });
  });
});
