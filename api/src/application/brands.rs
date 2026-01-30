use crate::domain::entities::{AssetReference, Brand};
use crate::domain::errors::ApiError;
use crate::inbound::ports::brands::{
    BrandsUseCase, CreateBrandRequest, UpdateBrandRequest, UploadBrandAssetRequest,
    UploadBrandAssetResponse,
};
use crate::outbound::ports::repositories::BrandRepository;
use crate::outbound::ports::services::{BucketType, ObjectStorage};
use async_trait::async_trait;
use std::sync::Arc;
use ulid::Ulid;

pub struct BrandsUseCaseImpl {
    brand_repo: Arc<dyn BrandRepository>,
    object_storage: Arc<dyn ObjectStorage>,
}

impl BrandsUseCaseImpl {
    pub fn new(
        brand_repo: Arc<dyn BrandRepository>,
        object_storage: Arc<dyn ObjectStorage>,
    ) -> Self {
        Self {
            brand_repo,
            object_storage,
        }
    }
}

#[async_trait]
impl BrandsUseCase for BrandsUseCaseImpl {
    async fn list_brands(&self, tenant_id: &str) -> Result<Vec<Brand>, ApiError> {
        tracing::info!(tenant_id = %tenant_id, "BrandsUseCase: list_brands called");
        let result = self.brand_repo.list_by_tenant(tenant_id).await;
        match &result {
            Ok(brands) => tracing::info!(count = brands.len(), "BrandsUseCase: Retrieved brands"),
            Err(e) => tracing::error!(error = ?e, "BrandsUseCase: Error retrieving brands"),
        }
        result
    }

    async fn get_brand(&self, tenant_id: &str, brand_id: &str) -> Result<Brand, ApiError> {
        self.brand_repo.get(tenant_id, brand_id).await
    }

    async fn create_brand(
        &self,
        tenant_id: &str,
        req: CreateBrandRequest,
    ) -> Result<String, ApiError> {
        let brand_id = Ulid::new().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        let brand = Brand {
            id: brand_id.clone(),
            tenant_id: tenant_id.to_string(),
            name: req.name,
            ethos: req.ethos,
            core_values: req.core_values,
            primary_audience: req.primary_audience,
            voice_guidelines: req.voice_guidelines,
            content_standards: req.content_standards,
            visual_identity: req.visual_identity,
            approval_threshold: req.approval_threshold,
            assets: None,
            created_at: now.clone(),
            updated_at: now,
            status: "active".to_string(),
        };

        self.brand_repo.create(brand).await?;
        Ok(brand_id)
    }

    async fn update_brand(
        &self,
        tenant_id: &str,
        brand_id: &str,
        req: UpdateBrandRequest,
    ) -> Result<(), ApiError> {
        let mut brand = self.brand_repo.get(tenant_id, brand_id).await?;

        if let Some(name) = req.name {
            brand.name = name;
        }
        if let Some(ethos) = req.ethos {
            brand.ethos = ethos;
        }
        if let Some(core_values) = req.core_values {
            brand.core_values = core_values;
        }
        if let Some(primary_audience) = req.primary_audience {
            brand.primary_audience = primary_audience;
        }
        if let Some(voice_guidelines) = req.voice_guidelines {
            brand.voice_guidelines = Some(voice_guidelines);
        }
        if let Some(content_standards) = req.content_standards {
            brand.content_standards = Some(content_standards);
        }
        if let Some(visual_identity) = req.visual_identity {
            brand.visual_identity = Some(visual_identity);
        }
        if let Some(approval_threshold) = req.approval_threshold {
            brand.approval_threshold = Some(approval_threshold);
        }

        brand.updated_at = chrono::Utc::now().to_rfc3339();

        self.brand_repo.update(brand).await
    }

    async fn delete_brand(&self, tenant_id: &str, brand_id: &str) -> Result<(), ApiError> {
        self.brand_repo.delete(tenant_id, brand_id).await
    }

    async fn list_brand_assets(
        &self,
        tenant_id: &str,
        brand_id: &str,
    ) -> Result<Vec<AssetReference>, ApiError> {
        let brand = self.brand_repo.get(tenant_id, brand_id).await?;
        Ok(brand.assets.unwrap_or_default())
    }

    async fn upload_brand_asset(
        &self,
        tenant_id: &str,
        brand_id: &str,
        req: UploadBrandAssetRequest,
    ) -> Result<UploadBrandAssetResponse, ApiError> {
        let brand = self.brand_repo.get(tenant_id, brand_id).await?;

        let asset_id = Ulid::new().to_string();

        let presigned = self
            .object_storage
            .generate_upload_url(
                tenant_id,
                &req.filename,
                &req.content_type,
                BucketType::BrandAssets,
            )
            .await?;

        let asset_ref = AssetReference {
            asset_type: "brand".to_string(),
            asset_id: Some(asset_id.clone()),
            url: Some(presigned.url.clone()),
            description: req.description,
            content_type: Some(req.content_type),
            usage_intent: req.usage_intent,
            is_default: req.is_default,
            category: req.category,
        };

        let mut updated_brand = brand;
        let mut assets = updated_brand.assets.unwrap_or_default();
        assets.push(asset_ref);
        updated_brand.assets = Some(assets);
        updated_brand.updated_at = chrono::Utc::now().to_rfc3339();

        self.brand_repo.update(updated_brand).await?;

        Ok(UploadBrandAssetResponse {
            asset_id,
            upload_url: presigned.url,
            upload_method: presigned.method,
            s3_key: presigned.key,
        })
    }

    async fn delete_brand_asset(
        &self,
        tenant_id: &str,
        brand_id: &str,
        asset_id: &str,
    ) -> Result<(), ApiError> {
        let brand = self.brand_repo.get(tenant_id, brand_id).await?;

        let mut updated_brand = brand;
        if let Some(assets) = updated_brand.assets {
            updated_brand.assets = Some(
                assets
                    .into_iter()
                    .filter(|a| a.asset_id.as_deref() != Some(asset_id))
                    .collect(),
            );
        }
        updated_brand.updated_at = chrono::Utc::now().to_rfc3339();

        self.brand_repo.update(updated_brand).await
    }
}
