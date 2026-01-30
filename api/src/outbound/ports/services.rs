use crate::domain::errors::ApiError;
use async_trait::async_trait;
use serde_json::Value;

#[derive(Debug, Clone)]
pub struct Event {
    pub source: String,
    pub detail_type: String,
    pub detail: Value,
}

#[async_trait]
pub trait EventPublisher: Send + Sync {
    async fn publish(&self, event: Event) -> Result<(), ApiError>;
}

#[derive(Debug, Clone)]
pub struct PresignedUploadUrl {
    pub method: String,
    pub url: String,
    pub key: String,
}

#[derive(Debug, Clone, Copy)]
pub enum BucketType {
    BrandAssets,
    Assets,
}

#[async_trait]
pub trait ObjectStorage: Send + Sync {
    async fn generate_upload_url(
        &self,
        tenant_id: &str,
        file_name: &str,
        content_type: &str,
        bucket_type: BucketType,
    ) -> Result<PresignedUploadUrl, ApiError>;
}
