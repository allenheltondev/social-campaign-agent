use crate::domain::errors::ApiError;
use crate::outbound::ports::services::{BucketType, ObjectStorage, PresignedUploadUrl};
use async_trait::async_trait;
use aws_sdk_s3::presigning::PresigningConfig;
use std::time::Duration;

pub struct S3ObjectStorage {
    client: aws_sdk_s3::Client,
    brand_assets_bucket: String,
    assets_bucket: String,
}

impl S3ObjectStorage {
    pub fn new(
        client: aws_sdk_s3::Client,
        brand_assets_bucket: String,
        assets_bucket: String,
    ) -> Self {
        Self {
            client,
            brand_assets_bucket,
            assets_bucket,
        }
    }

    fn generate_id() -> String {
        ulid::Ulid::new().to_string()
    }
}

#[async_trait]
impl ObjectStorage for S3ObjectStorage {
    async fn generate_upload_url(
        &self,
        tenant_id: &str,
        file_name: &str,
        content_type: &str,
        bucket_type: BucketType,
    ) -> Result<PresignedUploadUrl, ApiError> {
        let bucket = match bucket_type {
            BucketType::BrandAssets => &self.brand_assets_bucket,
            BucketType::Assets => &self.assets_bucket,
        };

        let key = format!("{}/{}/{}", tenant_id, Self::generate_id(), file_name);

        let presigning_config =
            PresigningConfig::expires_in(Duration::from_secs(3600)).map_err(|e| {
                eprintln!("Presigning config failed: {}", e);
                ApiError::internal("Presigning configuration failed")
            })?;

        let presigned = self
            .client
            .put_object()
            .bucket(bucket)
            .key(&key)
            .content_type(content_type)
            .presigned(presigning_config)
            .await
            .map_err(|e| {
                eprintln!("Presigning failed: {}", e);
                ApiError::internal("Presigning failed")
            })?;

        Ok(PresignedUploadUrl {
            method: "PUT".to_string(),
            url: presigned.uri().to_string(),
            key,
        })
    }
}
