use campaign_api::domain::entities::{Asset, Brand, Campaign, CampaignStatus, Persona};
use campaign_api::outbound::dynamodb::serialization::{
    deserialize_asset, deserialize_brand, deserialize_campaign, deserialize_persona,
    serialize_asset, serialize_brand, serialize_campaign, serialize_persona,
};

#[test]
fn test_serialize_persona_creates_correct_dynamodb_item() {
    let persona = Persona {
        id: "persona1".to_string(),
        tenant_id: "tenant1".to_string(),
        name: "John Doe".to_string(),
        role: "CEO".to_string(),
        company: "Acme Corp".to_string(),
        primary_audience: "Developers".to_string(),
        voice_traits: None,
        writing_habits: None,
        opinions: None,
        language: None,
        cta_style: None,
        inferred_style: None,
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
        status: "active".to_string(),
    };

    let item = serialize_persona(&persona).unwrap();

    assert!(item.contains_key("pk"));
    assert!(item.contains_key("sk"));
    assert!(item.contains_key("GSI1PK"));
    assert!(item.contains_key("GSI1SK"));
    assert!(item.contains_key("id"));
    assert!(item.contains_key("name"));
}

#[test]
fn test_round_trip_serialization_preserves_data() {
    let original = Persona {
        id: "persona1".to_string(),
        tenant_id: "tenant1".to_string(),
        name: "John Doe".to_string(),
        role: "CEO".to_string(),
        company: "Acme Corp".to_string(),
        primary_audience: "Developers".to_string(),
        voice_traits: Some(vec!["casual".to_string()]),
        writing_habits: None,
        opinions: None,
        language: None,
        cta_style: None,
        inferred_style: None,
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
        status: "active".to_string(),
    };

    let item = serialize_persona(&original).unwrap();
    let deserialized = deserialize_persona(&item).unwrap();

    assert_eq!(deserialized.id, original.id);
    assert_eq!(deserialized.tenant_id, original.tenant_id);
    assert_eq!(deserialized.name, original.name);
    assert_eq!(deserialized.role, original.role);
    assert_eq!(deserialized.company, original.company);
}

#[test]
fn test_serialize_brand_creates_correct_dynamodb_item() {
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

    let item = serialize_brand(&brand).unwrap();

    assert!(item.contains_key("pk"));
    assert!(item.contains_key("sk"));
    assert!(item.contains_key("GSI1PK"));
    assert!(item.contains_key("GSI1SK"));
    assert!(item.contains_key("id"));
    assert!(item.contains_key("name"));
    assert!(item.contains_key("ethos"));
}

#[test]
fn test_brand_round_trip_serialization_preserves_data() {
    let original = Brand {
        id: "brand1".to_string(),
        tenant_id: "tenant1".to_string(),
        name: "Acme Corp".to_string(),
        ethos: "Innovation first".to_string(),
        core_values: vec!["Quality".to_string(), "Trust".to_string()],
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

    let item = serialize_brand(&original).unwrap();
    let deserialized = deserialize_brand(&item).unwrap();

    assert_eq!(deserialized.id, original.id);
    assert_eq!(deserialized.tenant_id, original.tenant_id);
    assert_eq!(deserialized.name, original.name);
    assert_eq!(deserialized.ethos, original.ethos);
    assert_eq!(deserialized.core_values, original.core_values);
}

#[test]
fn test_serialize_campaign_creates_correct_dynamodb_item() {
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

    let item = serialize_campaign(&campaign).unwrap();

    assert!(item.contains_key("pk"));
    assert!(item.contains_key("sk"));
    assert!(item.contains_key("GSI1PK"));
    assert!(item.contains_key("GSI1SK"));
    assert!(item.contains_key("id"));
    assert!(item.contains_key("name"));
    assert!(item.contains_key("brandId"));
    assert!(item.contains_key("status"));
}

#[test]
fn test_campaign_round_trip_serialization_preserves_data() {
    let original = Campaign {
        id: "campaign1".to_string(),
        tenant_id: "tenant1".to_string(),
        name: "Summer Campaign".to_string(),
        brand_id: "brand1".to_string(),
        persona_ids: vec!["persona1".to_string(), "persona2".to_string()],
        platforms: vec!["twitter".to_string(), "linkedin".to_string()],
        start_date: "2024-06-01".to_string(),
        end_date: "2024-08-31".to_string(),
        post_frequency: "daily".to_string(),
        themes: Some(vec!["innovation".to_string()]),
        assets: None,
        status: CampaignStatus::Building,
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
    };

    let item = serialize_campaign(&original).unwrap();
    let deserialized = deserialize_campaign(&item).unwrap();

    assert_eq!(deserialized.id, original.id);
    assert_eq!(deserialized.tenant_id, original.tenant_id);
    assert_eq!(deserialized.name, original.name);
    assert_eq!(deserialized.brand_id, original.brand_id);
    assert_eq!(deserialized.persona_ids, original.persona_ids);
    assert_eq!(deserialized.platforms, original.platforms);
    assert_eq!(deserialized.status, original.status);
}

#[test]
fn test_serialize_asset_creates_correct_dynamodb_item() {
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

    let item = serialize_asset(&asset).unwrap();

    assert!(item.contains_key("pk"));
    assert!(item.contains_key("sk"));
    assert!(item.contains_key("GSI1PK"));
    assert!(item.contains_key("GSI1SK"));
    assert!(item.contains_key("id"));
    assert!(item.contains_key("filename"));
    assert!(item.contains_key("approvalStatus"));
}

#[test]
fn test_asset_round_trip_serialization_preserves_data() {
    let original = Asset {
        id: "asset1".to_string(),
        tenant_id: "tenant1".to_string(),
        filename: "logo.png".to_string(),
        content_type: "image/png".to_string(),
        size_bytes: 2048,
        description: Some("Company logo".to_string()),
        category: Some("branding".to_string()),
        approval_status: "approved".to_string(),
        s3_key: "tenant1/asset1/logo.png".to_string(),
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
        status: "active".to_string(),
    };

    let item = serialize_asset(&original).unwrap();
    let deserialized = deserialize_asset(&item).unwrap();

    assert_eq!(deserialized.id, original.id);
    assert_eq!(deserialized.tenant_id, original.tenant_id);
    assert_eq!(deserialized.filename, original.filename);
    assert_eq!(deserialized.content_type, original.content_type);
    assert_eq!(deserialized.size_bytes, original.size_bytes);
    assert_eq!(deserialized.approval_status, original.approval_status);
}
