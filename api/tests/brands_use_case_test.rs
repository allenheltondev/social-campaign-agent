use campaign_api::application::brands::BrandsUseCaseImpl;
use campaign_api::domain::entities::Brand;
use campaign_api::inbound::ports::brands::{BrandsUseCase, CreateBrandRequest};
use campaign_api::outbound::fakes::{FakeBrandRepository, FakeObjectStorage};
use campaign_api::outbound::ports::repositories::BrandRepository;
use std::sync::Arc;

#[tokio::test]
async fn test_list_brands_returns_all_brands_for_tenant() {
    let brand_repo = Arc::new(FakeBrandRepository::new());
    let object_storage = Arc::new(FakeObjectStorage::new());

    let brand = Brand {
        id: "brand1".to_string(),
        tenant_id: "tenant1".to_string(),
        name: "Acme Corp".to_string(),
        ethos: "Innovation first".to_string(),
        core_values: vec!["Quality".to_string()],
        primary_audience: "Developers".to_string(),
        voice_guidelines: None,
        content_standards: None,
        visual_identity: None,
        approval_threshold: None,
        assets: None,
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
        status: "active".to_string(),
    };

    brand_repo.create(brand).await.unwrap();

    let use_case = BrandsUseCaseImpl::new(brand_repo, object_storage);

    let result = use_case.list_brands("tenant1").await.unwrap();

    assert_eq!(result.len(), 1);
    assert_eq!(result[0].id, "brand1");
}

#[tokio::test]
async fn test_create_brand_generates_id_and_stores_brand() {
    let brand_repo = Arc::new(FakeBrandRepository::new());
    let object_storage = Arc::new(FakeObjectStorage::new());

    let use_case = BrandsUseCaseImpl::new(brand_repo.clone(), object_storage);

    let request = CreateBrandRequest {
        name: "Acme Corp".to_string(),
        ethos: "Innovation first".to_string(),
        core_values: vec!["Quality".to_string()],
        primary_audience: "Developers".to_string(),
        voice_guidelines: None,
        content_standards: None,
        visual_identity: None,
        approval_threshold: None,
    };

    let brand_id = use_case.create_brand("tenant1", request).await.unwrap();

    assert!(!brand_id.is_empty());

    let stored_brand = brand_repo.get("tenant1", &brand_id).await.unwrap();
    assert_eq!(stored_brand.id, brand_id);
    assert_eq!(stored_brand.name, "Acme Corp");
}
