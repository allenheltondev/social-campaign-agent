#![allow(dead_code)]

use crate::domain::entities::{Asset, Brand, Campaign, Persona, WritingExample};
use crate::domain::errors::ApiError;
use crate::inbound::ports::campaigns::CampaignPost;
use crate::outbound::ports::repositories::{
    AssetRepository, BrandRepository, CampaignPostRepository, CampaignRepository,
    PersonaRepository, WritingExampleRepository,
};
use crate::outbound::ports::services::{
    BucketType, Event, EventPublisher, ObjectStorage, PresignedUploadUrl,
};
use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
#[allow(dead_code)]
pub struct FakePersonaRepository {
    storage: Arc<Mutex<HashMap<String, Persona>>>,
}

impl FakePersonaRepository {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {
            storage: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    #[allow(dead_code)]
    fn make_key(tenant_id: &str, persona_id: &str) -> String {
        format!("{}#{}", tenant_id, persona_id)
    }
}

#[async_trait]
impl PersonaRepository for FakePersonaRepository {
    async fn list_by_tenant(&self, tenant_id: &str) -> Result<Vec<Persona>, ApiError> {
        let storage = self.storage.lock().unwrap();
        let personas: Vec<Persona> = storage
            .values()
            .filter(|p| p.tenant_id == tenant_id)
            .cloned()
            .collect();
        Ok(personas)
    }

    async fn get(&self, tenant_id: &str, persona_id: &str) -> Result<Persona, ApiError> {
        let storage = self.storage.lock().unwrap();
        let key = Self::make_key(tenant_id, persona_id);
        storage
            .get(&key)
            .cloned()
            .ok_or_else(|| ApiError::not_found("Persona not found"))
    }

    async fn create(&self, persona: Persona) -> Result<(), ApiError> {
        let mut storage = self.storage.lock().unwrap();
        let key = Self::make_key(&persona.tenant_id, &persona.id);
        if storage.contains_key(&key) {
            return Err(ApiError::conflict("Persona already exists"));
        }
        storage.insert(key, persona);
        Ok(())
    }

    async fn update(&self, persona: Persona) -> Result<(), ApiError> {
        let mut storage = self.storage.lock().unwrap();
        let key = Self::make_key(&persona.tenant_id, &persona.id);
        if !storage.contains_key(&key) {
            return Err(ApiError::not_found("Persona not found"));
        }
        storage.insert(key, persona);
        Ok(())
    }

    async fn delete(&self, tenant_id: &str, persona_id: &str) -> Result<(), ApiError> {
        let mut storage = self.storage.lock().unwrap();
        let key = Self::make_key(tenant_id, persona_id);
        storage
            .remove(&key)
            .ok_or_else(|| ApiError::not_found("Persona not found"))?;
        Ok(())
    }
}

#[derive(Clone)]
#[allow(dead_code)]
pub struct FakeBrandRepository {
    storage: Arc<Mutex<HashMap<String, Brand>>>,
}

impl FakeBrandRepository {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {
            storage: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    #[allow(dead_code)]
    fn make_key(tenant_id: &str, brand_id: &str) -> String {
        format!("{}#{}", tenant_id, brand_id)
    }
}

#[async_trait]
impl BrandRepository for FakeBrandRepository {
    async fn list_by_tenant(&self, tenant_id: &str) -> Result<Vec<Brand>, ApiError> {
        let storage = self.storage.lock().unwrap();
        let brands: Vec<Brand> = storage
            .values()
            .filter(|b| b.tenant_id == tenant_id)
            .cloned()
            .collect();
        Ok(brands)
    }

    async fn get(&self, tenant_id: &str, brand_id: &str) -> Result<Brand, ApiError> {
        let storage = self.storage.lock().unwrap();
        let key = Self::make_key(tenant_id, brand_id);
        storage
            .get(&key)
            .cloned()
            .ok_or_else(|| ApiError::not_found("Brand not found"))
    }

    async fn create(&self, brand: Brand) -> Result<(), ApiError> {
        let mut storage = self.storage.lock().unwrap();
        let key = Self::make_key(&brand.tenant_id, &brand.id);
        if storage.contains_key(&key) {
            return Err(ApiError::conflict("Brand already exists"));
        }
        storage.insert(key, brand);
        Ok(())
    }

    async fn update(&self, brand: Brand) -> Result<(), ApiError> {
        let mut storage = self.storage.lock().unwrap();
        let key = Self::make_key(&brand.tenant_id, &brand.id);
        if !storage.contains_key(&key) {
            return Err(ApiError::not_found("Brand not found"));
        }
        storage.insert(key, brand);
        Ok(())
    }

    async fn delete(&self, tenant_id: &str, brand_id: &str) -> Result<(), ApiError> {
        let mut storage = self.storage.lock().unwrap();
        let key = Self::make_key(tenant_id, brand_id);
        storage
            .remove(&key)
            .ok_or_else(|| ApiError::not_found("Brand not found"))?;
        Ok(())
    }
}

#[derive(Clone)]
#[allow(dead_code)]
pub struct FakeCampaignRepository {
    storage: Arc<Mutex<HashMap<String, Campaign>>>,
}

impl FakeCampaignRepository {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {
            storage: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    #[allow(dead_code)]
    fn make_key(tenant_id: &str, campaign_id: &str) -> String {
        format!("{}#{}", tenant_id, campaign_id)
    }
}

#[async_trait]
impl CampaignRepository for FakeCampaignRepository {
    async fn list_by_tenant(&self, tenant_id: &str) -> Result<Vec<Campaign>, ApiError> {
        let storage = self.storage.lock().unwrap();
        let campaigns: Vec<Campaign> = storage
            .values()
            .filter(|c| c.tenant_id == tenant_id)
            .cloned()
            .collect();
        Ok(campaigns)
    }

    async fn get(&self, tenant_id: &str, campaign_id: &str) -> Result<Campaign, ApiError> {
        let storage = self.storage.lock().unwrap();
        let key = Self::make_key(tenant_id, campaign_id);
        storage
            .get(&key)
            .cloned()
            .ok_or_else(|| ApiError::not_found("Campaign not found"))
    }

    async fn create(&self, campaign: Campaign) -> Result<(), ApiError> {
        let mut storage = self.storage.lock().unwrap();
        let key = Self::make_key(&campaign.tenant_id, &campaign.id);
        if storage.contains_key(&key) {
            return Err(ApiError::conflict("Campaign already exists"));
        }
        storage.insert(key, campaign);
        Ok(())
    }

    async fn update(&self, campaign: Campaign) -> Result<(), ApiError> {
        let mut storage = self.storage.lock().unwrap();
        let key = Self::make_key(&campaign.tenant_id, &campaign.id);
        if !storage.contains_key(&key) {
            return Err(ApiError::not_found("Campaign not found"));
        }
        storage.insert(key, campaign);
        Ok(())
    }

    async fn delete(&self, tenant_id: &str, campaign_id: &str) -> Result<(), ApiError> {
        let mut storage = self.storage.lock().unwrap();
        let key = Self::make_key(tenant_id, campaign_id);
        storage
            .remove(&key)
            .ok_or_else(|| ApiError::not_found("Campaign not found"))?;
        Ok(())
    }
}

#[derive(Clone)]
#[allow(dead_code)]
pub struct FakeAssetRepository {
    storage: Arc<Mutex<HashMap<String, Asset>>>,
}

impl FakeAssetRepository {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {
            storage: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    #[allow(dead_code)]
    fn make_key(tenant_id: &str, asset_id: &str) -> String {
        format!("{}#{}", tenant_id, asset_id)
    }
}

#[async_trait]
impl AssetRepository for FakeAssetRepository {
    async fn list_by_tenant(&self, tenant_id: &str) -> Result<Vec<Asset>, ApiError> {
        let storage = self.storage.lock().unwrap();
        let assets: Vec<Asset> = storage
            .values()
            .filter(|a| a.tenant_id == tenant_id)
            .cloned()
            .collect();
        Ok(assets)
    }

    async fn get(&self, tenant_id: &str, asset_id: &str) -> Result<Asset, ApiError> {
        let storage = self.storage.lock().unwrap();
        let key = Self::make_key(tenant_id, asset_id);
        storage
            .get(&key)
            .cloned()
            .ok_or_else(|| ApiError::not_found("Asset not found"))
    }

    async fn create(&self, asset: Asset) -> Result<(), ApiError> {
        let mut storage = self.storage.lock().unwrap();
        let key = Self::make_key(&asset.tenant_id, &asset.id);
        if storage.contains_key(&key) {
            return Err(ApiError::conflict("Asset already exists"));
        }
        storage.insert(key, asset);
        Ok(())
    }

    async fn update(&self, asset: Asset) -> Result<(), ApiError> {
        let mut storage = self.storage.lock().unwrap();
        let key = Self::make_key(&asset.tenant_id, &asset.id);
        if !storage.contains_key(&key) {
            return Err(ApiError::not_found("Asset not found"));
        }
        storage.insert(key, asset);
        Ok(())
    }

    async fn delete(&self, tenant_id: &str, asset_id: &str) -> Result<(), ApiError> {
        let mut storage = self.storage.lock().unwrap();
        let key = Self::make_key(tenant_id, asset_id);
        storage
            .remove(&key)
            .ok_or_else(|| ApiError::not_found("Asset not found"))?;
        Ok(())
    }
}

#[derive(Clone)]
#[allow(dead_code)]
pub struct FakeWritingExampleRepository {
    storage: Arc<Mutex<HashMap<String, WritingExample>>>,
}

impl FakeWritingExampleRepository {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {
            storage: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    #[allow(dead_code)]
    fn make_key(tenant_id: &str, persona_id: &str, example_id: &str) -> String {
        format!("{}#{}#{}", tenant_id, persona_id, example_id)
    }
}

#[async_trait]
impl WritingExampleRepository for FakeWritingExampleRepository {
    async fn list_by_persona(
        &self,
        tenant_id: &str,
        persona_id: &str,
    ) -> Result<Vec<WritingExample>, ApiError> {
        let storage = self.storage.lock().unwrap();
        let examples: Vec<WritingExample> = storage
            .values()
            .filter(|e| e.tenant_id == tenant_id && e.persona_id == persona_id)
            .cloned()
            .collect();
        Ok(examples)
    }

    async fn get(
        &self,
        tenant_id: &str,
        persona_id: &str,
        example_id: &str,
    ) -> Result<WritingExample, ApiError> {
        let storage = self.storage.lock().unwrap();
        let key = Self::make_key(tenant_id, persona_id, example_id);
        storage
            .get(&key)
            .cloned()
            .ok_or_else(|| ApiError::not_found("Writing example not found"))
    }

    async fn create(&self, example: WritingExample) -> Result<(), ApiError> {
        let mut storage = self.storage.lock().unwrap();
        let key = Self::make_key(&example.tenant_id, &example.persona_id, &example.id);
        if storage.contains_key(&key) {
            return Err(ApiError::conflict("Writing example already exists"));
        }
        storage.insert(key, example);
        Ok(())
    }

    async fn delete(
        &self,
        tenant_id: &str,
        persona_id: &str,
        example_id: &str,
    ) -> Result<(), ApiError> {
        let mut storage = self.storage.lock().unwrap();
        let key = Self::make_key(tenant_id, persona_id, example_id);
        storage
            .remove(&key)
            .ok_or_else(|| ApiError::not_found("Writing example not found"))?;
        Ok(())
    }
}

#[derive(Clone)]
#[allow(dead_code)]
pub struct FakeCampaignPostRepository {
    storage: Arc<Mutex<HashMap<String, CampaignPost>>>,
}

impl FakeCampaignPostRepository {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {
            storage: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    #[allow(dead_code)]
    fn make_key(tenant_id: &str, campaign_id: &str, post_id: &str) -> String {
        format!("{}#{}#{}", tenant_id, campaign_id, post_id)
    }
}

#[async_trait]
impl CampaignPostRepository for FakeCampaignPostRepository {
    async fn list_by_campaign(
        &self,
        tenant_id: &str,
        campaign_id: &str,
    ) -> Result<Vec<CampaignPost>, ApiError> {
        let storage = self.storage.lock().unwrap();
        let posts: Vec<CampaignPost> = storage
            .values()
            .filter(|p| p.tenant_id == tenant_id && p.campaign_id == campaign_id)
            .cloned()
            .collect();
        Ok(posts)
    }

    async fn get(
        &self,
        tenant_id: &str,
        campaign_id: &str,
        post_id: &str,
    ) -> Result<CampaignPost, ApiError> {
        let storage = self.storage.lock().unwrap();
        let key = Self::make_key(tenant_id, campaign_id, post_id);
        storage
            .get(&key)
            .cloned()
            .ok_or_else(|| ApiError::not_found("Campaign post not found"))
    }

    async fn update_status(
        &self,
        tenant_id: &str,
        campaign_id: &str,
        post_id: &str,
        status: String,
        _updates: Option<Value>,
    ) -> Result<(), ApiError> {
        let mut storage = self.storage.lock().unwrap();
        let key = Self::make_key(tenant_id, campaign_id, post_id);
        let mut post = storage
            .get(&key)
            .cloned()
            .ok_or_else(|| ApiError::not_found("Campaign post not found"))?;
        post.status = status;
        storage.insert(key, post);
        Ok(())
    }
}

#[derive(Clone)]
#[allow(dead_code)]
pub struct FakeEventPublisher {
    events: Arc<Mutex<Vec<Event>>>,
}

impl FakeEventPublisher {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {
            events: Arc::new(Mutex::new(Vec::new())),
        }
    }

    #[allow(dead_code)]
    pub fn get_events(&self) -> Vec<Event> {
        self.events.lock().unwrap().clone()
    }

    #[allow(dead_code)]
    pub fn clear(&self) {
        self.events.lock().unwrap().clear();
    }
}

#[async_trait]
impl EventPublisher for FakeEventPublisher {
    async fn publish(&self, event: Event) -> Result<(), ApiError> {
        self.events.lock().unwrap().push(event);
        Ok(())
    }
}

#[derive(Clone)]
#[allow(dead_code)]
pub struct FakeObjectStorage {}

impl FakeObjectStorage {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {}
    }
}

#[async_trait]
impl ObjectStorage for FakeObjectStorage {
    async fn generate_upload_url(
        &self,
        tenant_id: &str,
        file_name: &str,
        _content_type: &str,
        bucket_type: BucketType,
    ) -> Result<PresignedUploadUrl, ApiError> {
        let bucket = match bucket_type {
            BucketType::BrandAssets => "fake-brand-assets-bucket",
            BucketType::Assets => "fake-assets-bucket",
        };
        let key = format!("{}/{}/{}", tenant_id, ulid::Ulid::new(), file_name);
        Ok(PresignedUploadUrl {
            method: "PUT".to_string(),
            url: format!("https://{}.s3.amazonaws.com/{}", bucket, key),
            key,
        })
    }
}
