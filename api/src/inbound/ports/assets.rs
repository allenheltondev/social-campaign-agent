#![allow(dead_code)]

use crate::domain::entities::Asset;
use crate::domain::errors::ApiError;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAssetRequest {
    pub filename: String,
    pub content_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAssetRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct ApproveAssetRequest {
    pub approved: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAssetResponse {
    pub asset_id: String,
    pub upload_url: String,
    pub upload_method: String,
    pub s3_key: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetListResponse {
    pub assets: Vec<Asset>,
}

#[async_trait]
pub trait AssetsUseCase: Send + Sync {
    async fn list_assets(&self, tenant_id: &str) -> Result<Vec<Asset>, ApiError>;

    async fn get_asset(&self, tenant_id: &str, asset_id: &str) -> Result<Asset, ApiError>;

    async fn create_asset(
        &self,
        tenant_id: &str,
        req: CreateAssetRequest,
    ) -> Result<CreateAssetResponse, ApiError>;

    async fn update_asset(
        &self,
        tenant_id: &str,
        asset_id: &str,
        req: UpdateAssetRequest,
    ) -> Result<(), ApiError>;

    async fn delete_asset(&self, tenant_id: &str, asset_id: &str) -> Result<(), ApiError>;

    #[allow(dead_code)]
    async fn approve_asset(
        &self,
        tenant_id: &str,
        asset_id: &str,
        req: ApproveAssetRequest,
    ) -> Result<(), ApiError>;
}
