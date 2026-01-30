use campaign_api::application::assets::AssetsUseCaseImpl;
use campaign_api::domain::entities::Asset;
use campaign_api::inbound::ports::assets::{
    ApproveAssetRequest, AssetsUseCase, CreateAssetRequest, UpdateAssetRequest,
};
use campaign_api::outbound::fakes::{FakeAssetRepository, FakeObjectStorage};
use campaign_api::outbound::ports::repositories::AssetRepository;
use std::sync::Arc;

#[tokio::test]
async fn test_list_assets_returns_all_assets_for_tenant() {
    let asset_repo = Arc::new(FakeAssetRepository::new());
    let object_storage = Arc::new(FakeObjectStorage::new());

    let asset = Asset {
        id: "asset1".to_string(),
        tenant_id: "tenant1".to_string(),
        filename: "logo.png".to_string(),
        content_type: "image/png".to_string(),
        size_bytes: 1024,
        description: Some("Company logo".to_string()),
        category: Some("logo".to_string()),
        approval_status: "approved".to_string(),
        s3_key: "tenant1/asset1/logo.png".to_string(),
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
        status: "active".to_string(),
    };

    asset_repo.create(asset).await.unwrap();

    let use_case = AssetsUseCaseImpl::new(asset_repo, object_storage);

    let result = use_case.list_assets("tenant1").await.unwrap();

    assert_eq!(result.len(), 1);
    assert_eq!(result[0].id, "asset1");
    assert_eq!(result[0].filename, "logo.png");
}

#[tokio::test]
async fn test_get_asset_returns_correct_asset() {
    let asset_repo = Arc::new(FakeAssetRepository::new());
    let object_storage = Arc::new(FakeObjectStorage::new());

    let asset = Asset {
        id: "asset1".to_string(),
        tenant_id: "tenant1".to_string(),
        filename: "logo.png".to_string(),
        content_type: "image/png".to_string(),
        size_bytes: 1024,
        description: Some("Company logo".to_string()),
        category: Some("logo".to_string()),
        approval_status: "approved".to_string(),
        s3_key: "tenant1/asset1/logo.png".to_string(),
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
        status: "active".to_string(),
    };

    asset_repo.create(asset).await.unwrap();

    let use_case = AssetsUseCaseImpl::new(asset_repo, object_storage);

    let result = use_case.get_asset("tenant1", "asset1").await.unwrap();

    assert_eq!(result.id, "asset1");
    assert_eq!(result.filename, "logo.png");
    assert_eq!(result.approval_status, "approved");
}

#[tokio::test]
async fn test_create_asset_generates_id_and_presigned_url() {
    let asset_repo = Arc::new(FakeAssetRepository::new());
    let object_storage = Arc::new(FakeObjectStorage::new());

    let use_case = AssetsUseCaseImpl::new(asset_repo.clone(), object_storage);

    let request = CreateAssetRequest {
        filename: "logo.png".to_string(),
        content_type: "image/png".to_string(),
        description: Some("Company logo".to_string()),
        category: Some("logo".to_string()),
    };

    let response = use_case.create_asset("tenant1", request).await.unwrap();

    assert!(!response.asset_id.is_empty());
    assert!(!response.upload_url.is_empty());
    assert_eq!(response.upload_method, "PUT");
    assert!(!response.s3_key.is_empty());

    let stored_asset = asset_repo.get("tenant1", &response.asset_id).await.unwrap();
    assert_eq!(stored_asset.id, response.asset_id);
    assert_eq!(stored_asset.filename, "logo.png");
    assert_eq!(stored_asset.approval_status, "pending");
}

#[tokio::test]
async fn test_update_asset_modifies_fields() {
    let asset_repo = Arc::new(FakeAssetRepository::new());
    let object_storage = Arc::new(FakeObjectStorage::new());

    let asset = Asset {
        id: "asset1".to_string(),
        tenant_id: "tenant1".to_string(),
        filename: "logo.png".to_string(),
        content_type: "image/png".to_string(),
        size_bytes: 1024,
        description: Some("Old description".to_string()),
        category: Some("logo".to_string()),
        approval_status: "pending".to_string(),
        s3_key: "tenant1/asset1/logo.png".to_string(),
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
        status: "active".to_string(),
    };

    asset_repo.create(asset).await.unwrap();

    let use_case = AssetsUseCaseImpl::new(asset_repo.clone(), object_storage);

    let update_request = UpdateAssetRequest {
        description: Some("New description".to_string()),
        category: Some("branding".to_string()),
        approval_status: None,
    };

    use_case
        .update_asset("tenant1", "asset1", update_request)
        .await
        .unwrap();

    let updated_asset = asset_repo.get("tenant1", "asset1").await.unwrap();
    assert_eq!(
        updated_asset.description,
        Some("New description".to_string())
    );
    assert_eq!(updated_asset.category, Some("branding".to_string()));
    assert_eq!(updated_asset.approval_status, "pending");
}

#[tokio::test]
async fn test_delete_asset_removes_asset() {
    let asset_repo = Arc::new(FakeAssetRepository::new());
    let object_storage = Arc::new(FakeObjectStorage::new());

    let asset = Asset {
        id: "asset1".to_string(),
        tenant_id: "tenant1".to_string(),
        filename: "logo.png".to_string(),
        content_type: "image/png".to_string(),
        size_bytes: 1024,
        description: None,
        category: None,
        approval_status: "pending".to_string(),
        s3_key: "tenant1/asset1/logo.png".to_string(),
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
        status: "active".to_string(),
    };

    asset_repo.create(asset).await.unwrap();

    let use_case = AssetsUseCaseImpl::new(asset_repo.clone(), object_storage);

    use_case.delete_asset("tenant1", "asset1").await.unwrap();

    let result = asset_repo.get("tenant1", "asset1").await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_approve_asset_sets_approved_status() {
    let asset_repo = Arc::new(FakeAssetRepository::new());
    let object_storage = Arc::new(FakeObjectStorage::new());

    let asset = Asset {
        id: "asset1".to_string(),
        tenant_id: "tenant1".to_string(),
        filename: "logo.png".to_string(),
        content_type: "image/png".to_string(),
        size_bytes: 1024,
        description: None,
        category: None,
        approval_status: "pending".to_string(),
        s3_key: "tenant1/asset1/logo.png".to_string(),
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
        status: "active".to_string(),
    };

    asset_repo.create(asset).await.unwrap();

    let use_case = AssetsUseCaseImpl::new(asset_repo.clone(), object_storage);

    let approve_request = ApproveAssetRequest {
        approved: true,
        notes: None,
    };

    use_case
        .approve_asset("tenant1", "asset1", approve_request)
        .await
        .unwrap();

    let approved_asset = asset_repo.get("tenant1", "asset1").await.unwrap();
    assert_eq!(approved_asset.approval_status, "approved");
}

#[tokio::test]
async fn test_approve_asset_sets_rejected_status() {
    let asset_repo = Arc::new(FakeAssetRepository::new());
    let object_storage = Arc::new(FakeObjectStorage::new());

    let asset = Asset {
        id: "asset1".to_string(),
        tenant_id: "tenant1".to_string(),
        filename: "logo.png".to_string(),
        content_type: "image/png".to_string(),
        size_bytes: 1024,
        description: None,
        category: None,
        approval_status: "pending".to_string(),
        s3_key: "tenant1/asset1/logo.png".to_string(),
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
        status: "active".to_string(),
    };

    asset_repo.create(asset).await.unwrap();

    let use_case = AssetsUseCaseImpl::new(asset_repo.clone(), object_storage);

    let reject_request = ApproveAssetRequest {
        approved: false,
        notes: None,
    };

    use_case
        .approve_asset("tenant1", "asset1", reject_request)
        .await
        .unwrap();

    let rejected_asset = asset_repo.get("tenant1", "asset1").await.unwrap();
    assert_eq!(rejected_asset.approval_status, "rejected");
}
