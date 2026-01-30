use crate::domain::entities::{Campaign, CampaignStatus};
use crate::domain::errors::ApiError;
use crate::inbound::ports::campaigns::{
    CampaignPost, CampaignsUseCase, CreateCampaignRequest, UpdateCampaignRequest,
};
use crate::outbound::ports::repositories::{CampaignPostRepository, CampaignRepository};
use crate::outbound::ports::services::{Event, EventPublisher};
use async_trait::async_trait;
use serde_json::{json, Value};
use std::sync::Arc;
use ulid::Ulid;

pub struct CampaignsUseCaseImpl {
    campaign_repo: Arc<dyn CampaignRepository>,
    post_repo: Arc<dyn CampaignPostRepository>,
    #[allow(dead_code)]
    events: Arc<dyn EventPublisher>,
}

impl CampaignsUseCaseImpl {
    pub fn new(
        campaign_repo: Arc<dyn CampaignRepository>,
        post_repo: Arc<dyn CampaignPostRepository>,
        events: Arc<dyn EventPublisher>,
    ) -> Self {
        Self {
            campaign_repo,
            post_repo,
            events,
        }
    }
}

#[async_trait]
impl CampaignsUseCase for CampaignsUseCaseImpl {
    async fn list_campaigns(&self, tenant_id: &str) -> Result<Vec<Campaign>, ApiError> {
        self.campaign_repo.list_by_tenant(tenant_id).await
    }

    async fn get_campaign(&self, tenant_id: &str, campaign_id: &str) -> Result<Campaign, ApiError> {
        self.campaign_repo.get(tenant_id, campaign_id).await
    }

    async fn create_campaign(
        &self,
        tenant_id: &str,
        req: CreateCampaignRequest,
    ) -> Result<String, ApiError> {
        let campaign_id = Ulid::new().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        let campaign = Campaign {
            id: campaign_id.clone(),
            tenant_id: tenant_id.to_string(),
            name: req.name,
            brand_id: req.brand_id,
            persona_ids: req.persona_ids,
            platforms: req.platforms,
            start_date: req.start_date,
            end_date: req.end_date,
            post_frequency: req.post_frequency,
            themes: req.themes,
            assets: req.assets,
            status: CampaignStatus::Draft,
            created_at: now.clone(),
            updated_at: now,
        };

        self.campaign_repo.create(campaign).await?;
        Ok(campaign_id)
    }

    async fn update_campaign(
        &self,
        tenant_id: &str,
        campaign_id: &str,
        req: UpdateCampaignRequest,
    ) -> Result<(), ApiError> {
        let mut campaign = self.campaign_repo.get(tenant_id, campaign_id).await?;

        if let Some(name) = req.name {
            campaign.name = name;
        }
        if let Some(brand_id) = req.brand_id {
            campaign.brand_id = brand_id;
        }
        if let Some(persona_ids) = req.persona_ids {
            campaign.persona_ids = persona_ids;
        }
        if let Some(platforms) = req.platforms {
            campaign.platforms = platforms;
        }
        if let Some(start_date) = req.start_date {
            campaign.start_date = start_date;
        }
        if let Some(end_date) = req.end_date {
            campaign.end_date = end_date;
        }
        if let Some(post_frequency) = req.post_frequency {
            campaign.post_frequency = post_frequency;
        }
        if let Some(themes) = req.themes {
            campaign.themes = Some(themes);
        }
        if let Some(assets) = req.assets {
            campaign.assets = Some(assets);
        }
        if let Some(status) = req.status {
            campaign.status = status;
        }

        campaign.updated_at = chrono::Utc::now().to_rfc3339();

        self.campaign_repo.update(campaign).await
    }

    async fn delete_campaign(&self, tenant_id: &str, campaign_id: &str) -> Result<(), ApiError> {
        self.campaign_repo.delete(tenant_id, campaign_id).await
    }

    async fn list_campaign_posts(
        &self,
        tenant_id: &str,
        campaign_id: &str,
    ) -> Result<Vec<CampaignPost>, ApiError> {
        self.post_repo
            .list_by_campaign(tenant_id, campaign_id)
            .await
    }

    async fn build_campaign(&self, tenant_id: &str, campaign_id: &str) -> Result<(), ApiError> {
        let mut campaign = self.campaign_repo.get(tenant_id, campaign_id).await?;

        campaign.status = CampaignStatus::Building;
        campaign.updated_at = chrono::Utc::now().to_rfc3339();
        self.campaign_repo.update(campaign).await?;

        self.events
            .publish(Event {
                source: "api.campaigns".to_string(),
                detail_type: "CampaignBuildRequested".to_string(),
                detail: json!({
                    "tenantId": tenant_id,
                    "campaignId": campaign_id,
                }),
            })
            .await
    }

    async fn update_campaign_status(
        &self,
        tenant_id: &str,
        campaign_id: &str,
        status: CampaignStatus,
    ) -> Result<(), ApiError> {
        let mut campaign = self.campaign_repo.get(tenant_id, campaign_id).await?;

        campaign.status = status;
        campaign.updated_at = chrono::Utc::now().to_rfc3339();

        self.campaign_repo.update(campaign).await
    }

    async fn update_post_status(
        &self,
        tenant_id: &str,
        campaign_id: &str,
        post_id: &str,
        status: String,
        updates: Option<Value>,
    ) -> Result<(), ApiError> {
        self.post_repo
            .update_status(tenant_id, campaign_id, post_id, status, updates)
            .await
    }
}
