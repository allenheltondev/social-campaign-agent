#![allow(dead_code)]

use crate::domain::entities::{Asset, Brand, Campaign, Persona, WritingExample};
use crate::domain::errors::ApiError;
use crate::inbound::ports::campaigns::CampaignPost;
use async_trait::async_trait;
use serde_json::Value;

#[async_trait]
pub trait PersonaRepository: Send + Sync {
    async fn list_by_tenant(&self, tenant_id: &str) -> Result<Vec<Persona>, ApiError>;
    async fn get(&self, tenant_id: &str, persona_id: &str) -> Result<Persona, ApiError>;
    async fn create(&self, persona: Persona) -> Result<(), ApiError>;
    async fn update(&self, persona: Persona) -> Result<(), ApiError>;
    async fn delete(&self, tenant_id: &str, persona_id: &str) -> Result<(), ApiError>;
}

#[async_trait]
pub trait BrandRepository: Send + Sync {
    async fn list_by_tenant(&self, tenant_id: &str) -> Result<Vec<Brand>, ApiError>;
    async fn get(&self, tenant_id: &str, brand_id: &str) -> Result<Brand, ApiError>;
    async fn create(&self, brand: Brand) -> Result<(), ApiError>;
    async fn update(&self, brand: Brand) -> Result<(), ApiError>;
    async fn delete(&self, tenant_id: &str, brand_id: &str) -> Result<(), ApiError>;
}

#[async_trait]
pub trait CampaignRepository: Send + Sync {
    async fn list_by_tenant(&self, tenant_id: &str) -> Result<Vec<Campaign>, ApiError>;
    async fn get(&self, tenant_id: &str, campaign_id: &str) -> Result<Campaign, ApiError>;
    async fn create(&self, campaign: Campaign) -> Result<(), ApiError>;
    async fn update(&self, campaign: Campaign) -> Result<(), ApiError>;
    async fn delete(&self, tenant_id: &str, campaign_id: &str) -> Result<(), ApiError>;
}

#[async_trait]
pub trait AssetRepository: Send + Sync {
    async fn list_by_tenant(&self, tenant_id: &str) -> Result<Vec<Asset>, ApiError>;
    async fn get(&self, tenant_id: &str, asset_id: &str) -> Result<Asset, ApiError>;
    async fn create(&self, asset: Asset) -> Result<(), ApiError>;
    async fn update(&self, asset: Asset) -> Result<(), ApiError>;
    async fn delete(&self, tenant_id: &str, asset_id: &str) -> Result<(), ApiError>;
}

#[async_trait]
pub trait WritingExampleRepository: Send + Sync {
    async fn list_by_persona(
        &self,
        tenant_id: &str,
        persona_id: &str,
    ) -> Result<Vec<WritingExample>, ApiError>;
    #[allow(dead_code)]
    async fn get(
        &self,
        tenant_id: &str,
        persona_id: &str,
        example_id: &str,
    ) -> Result<WritingExample, ApiError>;
    async fn create(&self, example: WritingExample) -> Result<(), ApiError>;
    async fn delete(
        &self,
        tenant_id: &str,
        persona_id: &str,
        example_id: &str,
    ) -> Result<(), ApiError>;
}

#[async_trait]
pub trait CampaignPostRepository: Send + Sync {
    async fn list_by_campaign(
        &self,
        tenant_id: &str,
        campaign_id: &str,
    ) -> Result<Vec<CampaignPost>, ApiError>;
    #[allow(dead_code)]
    async fn get(
        &self,
        tenant_id: &str,
        campaign_id: &str,
        post_id: &str,
    ) -> Result<CampaignPost, ApiError>;
    #[allow(dead_code)]
    async fn update_status(
        &self,
        tenant_id: &str,
        campaign_id: &str,
        post_id: &str,
        status: String,
        updates: Option<Value>,
    ) -> Result<(), ApiError>;
}
