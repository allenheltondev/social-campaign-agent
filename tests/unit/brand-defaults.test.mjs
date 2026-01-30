import { describe, it, expect } from "vitest";
import { getBrandDefaults } from "../../utils/defaults.mjs";
import { BrandSchema } from "../../models/brand.mjs";

describe("Brand Defaults Generation", () => {
  describe("Executives Audience", () => {
    it("should return correct defaults for executives audience", () => {
      const defaults = getBrandDefaults("executives");
      expect(defaults.voiceGuidelines.tone).toEqual(["professional", "authoritative", "strategic"]);
      expect(defaults.platformGuidelines.enabled).toEqual(["linkedin", "twitter"]);
      expect(defaults.approvalPolicy.threshold).toBe(0.8);
    });
  });

  describe("Professionals Audience", () => {
    it("should return correct defaults for professionals audience", () => {
      const defaults = getBrandDefaults("professionals");
      expect(defaults.voiceGuidelines.tone).toEqual(["approachable", "knowledgeable", "helpful"]);
      expect(defaults.platformGuidelines.enabled).toEqual(["linkedin", "twitter", "facebook"]);
      expect(defaults.approvalPolicy.threshold).toBe(0.7);
    });
  });

  describe("Consumers Audience", () => {
    it("should return correct defaults for consumers audience", () => {
      const defaults = getBrandDefaults("consumers");
      expect(defaults.voiceGuidelines.tone).toEqual(["friendly", "enthusiastic", "helpful"]);
      expect(defaults.platformGuidelines.enabled).toEqual(["instagram", "facebook", "twitter"]);
      expect(defaults.approvalPolicy.threshold).toBe(0.6);
    });
  });

  describe("Technical Audience", () => {
    it("should return correct defaults for technical audience", () => {
      const defaults = getBrandDefaults("technical");
      expect(defaults.voiceGuidelines.tone).toEqual(["precise", "technical", "authoritative"]);
      expect(defaults.platformGuidelines.enabled).toEqual(["twitter", "linkedin"]);
      expect(defaults.approvalPolicy.threshold).toBe(0.8);
    });
  });

  describe("Creative Audience", () => {
    it("should return correct defaults for creative audience", () => {
      const defaults = getBrandDefaults("creative");
      expect(defaults.voiceGuidelines.tone).toEqual(["inspiring", "innovative", "expressive"]);
      expect(defaults.platformGuidelines.enabled).toEqual(["instagram", "twitter", "facebook"]);
      expect(defaults.approvalPolicy.threshold).toBe(0.7);
    });
  });

  describe("Invalid Audience", () => {
    it("should throw error for invalid audience type", () => {
      expect(() => getBrandDefaults("invalid")).toThrow("Invalid primaryAudience: invalid");
    });
  });

  describe("Schema Validation", () => {
    const audiences = ["executives", "professionals", "consumers", "technical", "creative"];

    audiences.forEach(audience => {
      it(`should return defaults that pass schema validation when combined with required fields for ${audience}`, () => {
        const defaults = getBrandDefaults(audience);

        const completeBrand = {
          brandId: "brand_test123",
          tenantId: "tenant_test456",
          name: "Test Brand",
          ethos: "Test brand ethos that describes our core mission and values",
          coreValues: ["Innovation", "Quality", "Customer Focus"],
          primaryAudience: audience,
          voiceGuidelines: defaults.voiceGuidelines,
          contentStandards: defaults.contentStandards,
          visualIdentity: defaults.visualIdentity,
          platformGuidelines: defaults.platformGuidelines,
          claimsPolicy: defaults.claimsPolicy,
          approvalPolicy: defaults.approvalPolicy,
          assetLibraryStats: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: "active"
        };

        expect(() => BrandSchema.parse(completeBrand)).not.toThrow();
      });
    });
  });
});
