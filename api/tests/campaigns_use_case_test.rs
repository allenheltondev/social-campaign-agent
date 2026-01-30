use campaign_api::application::campaigns::CampaignsUseCaseImpl;
use campaign_api::domain::entities::{Campaign, CampaignStatus};
use campaign_api::inbound::ports::campaigns::{CampaignsUseCase, CreateCampaignRequest};
use campaign_api::outbound::fakes::{
    FakeCampaignPostRepository, FakeCampaignRepository, FakeEventPublisher,
};
use campaign_api::outbound::ports::repositories::CampaignRepository;
use std::sync::Arc;

#[tokio::test]
async fn test_list_campaigns_returns_all_campaigns_for_tenant() {
    let campaign_repo = Arc::new(FakeCampaignRepository::new());
    let post_repo = Arc::new(FakeCampaignPostRepository::new());
    let events = Arc::new(FakeEventPublisher::new());

    let campaign = Campaign {
        id: "campaign1".to_string(),
        tenant_id: "tenant1".to_string(),
        name: "Summer Campaign".to_string(),
        brand_id: "brand1".to_string(),
        persona_ids: vec!["persona1".to_string()],
        platforms: vec!["twitter".to_string()],
        start_date: "2024-06-01".to_string(),
        end_date: "2024-08-31".to_string(),
        post_frequency: "daily".to_string(),
        themes: None,
        assets: None,
        status: CampaignStatus::Draft,
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
    };

    campaign_repo.create(campaign).await.unwrap();

    let use_case = CampaignsUseCaseImpl::new(campaign_repo, post_repo, events);

    let result = use_case.list_campaigns("tenant1").await.unwrap();

    assert_eq!(result.len(), 1);
    assert_eq!(result[0].id, "campaign1");
}

#[tokio::test]
async fn test_create_campaign_generates_id_and_stores_campaign() {
    let campaign_repo = Arc::new(FakeCampaignRepository::new());
    let post_repo = Arc::new(FakeCampaignPostRepository::new());
    let events = Arc::new(FakeEventPublisher::new());

    let use_case = CampaignsUseCaseImpl::new(campaign_repo.clone(), post_repo, events);

    let request = CreateCampaignRequest {
        name: "Summer Campaign".to_string(),
        brand_id: "brand1".to_string(),
        persona_ids: vec!["persona1".to_string()],
        platforms: vec!["twitter".to_string()],
        start_date: "2024-06-01".to_string(),
        end_date: "2024-08-31".to_string(),
        post_frequency: "daily".to_string(),
        themes: None,
        assets: None,
    };

    let campaign_id = use_case.create_campaign("tenant1", request).await.unwrap();

    assert!(!campaign_id.is_empty());

    let stored_campaign = campaign_repo.get("tenant1", &campaign_id).await.unwrap();
    assert_eq!(stored_campaign.id, campaign_id);
    assert_eq!(stored_campaign.name, "Summer Campaign");
    assert_eq!(stored_campaign.status, CampaignStatus::Draft);
}

#[tokio::test]
async fn test_build_campaign_publishes_event() {
    let campaign_repo = Arc::new(FakeCampaignRepository::new());
    let post_repo = Arc::new(FakeCampaignPostRepository::new());
    let events = Arc::new(FakeEventPublisher::new());

    let campaign = Campaign {
        id: "campaign1".to_string(),
        tenant_id: "tenant1".to_string(),
        name: "Summer Campaign".to_string(),
        brand_id: "brand1".to_string(),
        persona_ids: vec!["persona1".to_string()],
        platforms: vec!["twitter".to_string()],
        start_date: "2024-06-01".to_string(),
        end_date: "2024-08-31".to_string(),
        post_frequency: "daily".to_string(),
        themes: None,
        assets: None,
        status: CampaignStatus::Draft,
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
    };

    campaign_repo.create(campaign).await.unwrap();

    let use_case = CampaignsUseCaseImpl::new(campaign_repo.clone(), post_repo, events.clone());

    use_case
        .build_campaign("tenant1", "campaign1")
        .await
        .unwrap();

    let published_events = events.get_events();
    assert_eq!(published_events.len(), 1);
    assert_eq!(published_events[0].source, "api.campaigns");
    assert_eq!(published_events[0].detail_type, "CampaignBuildRequested");

    let updated_campaign = campaign_repo.get("tenant1", "campaign1").await.unwrap();
    assert_eq!(updated_campaign.status, CampaignStatus::Building);
}
