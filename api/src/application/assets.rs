use crate::domain::entities::Asset;
use crate::domain::errors::ApiError;
use crate::inbound::ports::assets::{
    ApproveAssetRequest, AssetsUseCase, CreateAssetRequest, CreateAssetResponse, UpdateAssetRequest,
};
use crate::outbound::ports::repositories::AssetRepository;
use crate::outbound::ports::services::{BucketType, ObjectStorage};
use async_trait::async_trait;
use std::sync::Arc;
use ulid::Ulid;

pub struct AssetsUseCaseImpl {
    asset_repo: Arc<dyn AssetRepository>,
    object_storage: Arc<dyn ObjectStorage>,
}

impl AssetsUseCaseImpl {
    pub fn new(
        asset_repo: Arc<dyn AssetRepository>,
        object_storage: Arc<dyn ObjectStorage>,
    ) -> Self {
        Self {
            asset_repo,
            object_storage,
        }
    }
}

#[async_trait]
impl AssetsUseCase for AssetsUseCaseImpl {
    async fn list_assets(&self, tenant_id: &str) -> Result<Vec<Asset>, ApiError> {
        self.asset_repo.list_by_tenant(tenant_id).await
    }

    async fn get_asset(&self, tenant_id: &str, asset_id: &str) -> Result<Asset, ApiError> {
        self.asset_repo.get(tenant_id, asset_id).await
    }

    async fn create_asset(
        &self,
        tenant_id: &str,
        req: CreateAssetRequest,
    ) -> Result<CreateAssetResponse, ApiError> {
        let asset_id = Ulid::new().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        let presigned = self
            .object_storage
            .generate_upload_url(
                tenant_id,
                &req.filename,
                &req.content_type,
                BucketType::Assets,
            )
            .await?;

        let asset = Asset {
            id: asset_id.clone(),
            tenant_id: tenant_id.to_string(),
            filename: req.filename,
            content_type: req.content_type,
            size_bytes: 0,
            description: req.description,
            category: req.category,
            approval_status: "pending".to_string(),
            s3_key: presigned.key.clone(),
            created_at: now.clone(),
            updated_at: now,
            status: "active".to_string(),
        };

        self.asset_repo.create(asset).await?;

        Ok(CreateAssetResponse {
            asset_id,
            upload_url: presigned.url,
            upload_method: presigned.method,
            s3_key: presigned.key,
        })
    }

    async fn update_asset(
        &self,
        tenant_id: &str,
        asset_id: &str,
        req: UpdateAssetRequest,
    ) -> Result<(), ApiError> {
        let mut asset = self.asset_repo.get(tenant_id, asset_id).await?;

        if let Some(description) = req.description {
            asset.description = Some(description);
        }
        if let Some(category) = req.category {
            asset.category = Some(category);
        }
        if let Some(approval_status) = req.approval_status {
            asset.approval_status = approval_status;
        }

        asset.updated_at = chrono::Utc::now().to_rfc3339();

        self.asset_repo.update(asset).await
    }

    async fn delete_asset(&self, tenant_id: &str, asset_id: &str) -> Result<(), ApiError> {
        self.asset_repo.delete(tenant_id, asset_id).await
    }

    async fn approve_asset(
        &self,
        tenant_id: &str,
        asset_id: &str,
        req: ApproveAssetRequest,
    ) -> Result<(), ApiError> {
        let mut asset = self.asset_repo.get(tenant_id, asset_id).await?;

        asset.approval_status = if req.approved {
            "approved".to_string()
        } else {
            "rejected".to_string()
        };

        asset.updated_at = chrono::Utc::now().to_rfc3339();

        self.asset_repo.update(asset).await
    }
}
