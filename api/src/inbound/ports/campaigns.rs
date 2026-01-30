#![allow(dead_code)]

use crate::domain::entities::{AssetReference, Campaign, CampaignStatus};
use crate::domain::errors::ApiError;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCampaignRequest {
    pub name: String,
    pub brand_id: String,
    pub persona_ids: Vec<String>,
    pub platforms: Vec<String>,
    pub start_date: String,
    pub end_date: String,
    pub post_frequency: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub themes: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assets: Option<Vec<AssetReference>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCampaignRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub brand_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub persona_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub platforms: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub post_frequency: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub themes: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assets: Option<Vec<AssetReference>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<CampaignStatus>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CampaignPost {
    pub id: String,
    pub campaign_id: String,
    pub tenant_id: String,
    pub persona_id: String,
    pub platform: String,
    pub content: String,
    pub scheduled_date: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_concept: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assets: Option<Vec<AssetReference>>,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CampaignListResponse {
    pub campaigns: Vec<Campaign>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CampaignPostsResponse {
    pub posts: Vec<CampaignPost>,
}

#[async_trait]
pub trait CampaignsUseCase: Send + Sync {
    async fn list_campaigns(&self, tenant_id: &str) -> Result<Vec<Campaign>, ApiError>;

    async fn get_campaign(&self, tenant_id: &str, campaign_id: &str) -> Result<Campaign, ApiError>;

    async fn create_campaign(
        &self,
        tenant_id: &str,
        req: CreateCampaignRequest,
    ) -> Result<String, ApiError>;

    async fn update_campaign(
        &self,
        tenant_id: &str,
        campaign_id: &str,
        req: UpdateCampaignRequest,
    ) -> Result<(), ApiError>;

    async fn delete_campaign(&self, tenant_id: &str, campaign_id: &str) -> Result<(), ApiError>;

    async fn list_campaign_posts(
        &self,
        tenant_id: &str,
        campaign_id: &str,
    ) -> Result<Vec<CampaignPost>, ApiError>;

    #[allow(dead_code)]
    async fn build_campaign(&self, tenant_id: &str, campaign_id: &str) -> Result<(), ApiError>;

    #[allow(dead_code)]
    async fn update_campaign_status(
        &self,
        tenant_id: &str,
        campaign_id: &str,
        status: CampaignStatus,
    ) -> Result<(), ApiError>;

    #[allow(dead_code)]
    async fn update_post_status(
        &self,
        tenant_id: &str,
        campaign_id: &str,
        post_id: &str,
        status: String,
        updates: Option<Value>,
    ) -> Result<(), ApiError>;
}
