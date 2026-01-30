use crate::domain::entities::{AssetReference, Brand};
use crate::domain::errors::ApiError;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBrandRequest {
    pub name: String,
    pub ethos: String,
    pub core_values: Vec<String>,
    pub primary_audience: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voice_guidelines: Option<crate::domain::entities::VoiceGuidelines>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_standards: Option<crate::domain::entities::ContentStandards>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub visual_identity: Option<crate::domain::entities::VisualIdentity>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_threshold: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBrandRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ethos: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub core_values: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary_audience: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voice_guidelines: Option<crate::domain::entities::VoiceGuidelines>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_standards: Option<crate::domain::entities::ContentStandards>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub visual_identity: Option<crate::domain::entities::VisualIdentity>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_threshold: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadBrandAssetRequest {
    pub filename: String,
    pub content_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage_intent: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_default: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadBrandAssetResponse {
    pub asset_id: String,
    pub upload_url: String,
    pub upload_method: String,
    pub s3_key: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrandListResponse {
    pub brands: Vec<Brand>,
}

#[async_trait]
pub trait BrandsUseCase: Send + Sync {
    async fn list_brands(&self, tenant_id: &str) -> Result<Vec<Brand>, ApiError>;

    async fn get_brand(&self, tenant_id: &str, brand_id: &str) -> Result<Brand, ApiError>;

    async fn create_brand(
        &self,
        tenant_id: &str,
        req: CreateBrandRequest,
    ) -> Result<String, ApiError>;

    async fn update_brand(
        &self,
        tenant_id: &str,
        brand_id: &str,
        req: UpdateBrandRequest,
    ) -> Result<(), ApiError>;

    async fn delete_brand(&self, tenant_id: &str, brand_id: &str) -> Result<(), ApiError>;

    async fn list_brand_assets(
        &self,
        tenant_id: &str,
        brand_id: &str,
    ) -> Result<Vec<AssetReference>, ApiError>;

    async fn upload_brand_asset(
        &self,
        tenant_id: &str,
        brand_id: &str,
        req: UploadBrandAssetRequest,
    ) -> Result<UploadBrandAssetResponse, ApiError>;

    async fn delete_brand_asset(
        &self,
        tenant_id: &str,
        brand_id: &str,
        asset_id: &str,
    ) -> Result<(), ApiError>;
}
