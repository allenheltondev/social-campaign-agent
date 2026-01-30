use crate::domain::entities::{Asset, Brand, Campaign, Persona, WritingExample};
use crate::domain::errors::ApiError;
use aws_sdk_dynamodb::types::AttributeValue;
use std::collections::HashMap;

pub fn serialize_persona(persona: &Persona) -> Result<HashMap<String, AttributeValue>, ApiError> {
    let mut item = HashMap::new();

    item.insert(
        "pk".to_string(),
        AttributeValue::S(format!("{}#{}", persona.tenant_id, persona.id)),
    );
    item.insert("sk".to_string(), AttributeValue::S("metadata".to_string()));
    item.insert(
        "GSI1PK".to_string(),
        AttributeValue::S(persona.tenant_id.clone()),
    );
    item.insert(
        "GSI1SK".to_string(),
        AttributeValue::S(format!("PERSONA#{}", persona.created_at)),
    );

    item.insert("id".to_string(), AttributeValue::S(persona.id.clone()));
    item.insert("name".to_string(), AttributeValue::S(persona.name.clone()));
    item.insert("role".to_string(), AttributeValue::S(persona.role.clone()));
    item.insert(
        "company".to_string(),
        AttributeValue::S(persona.company.clone()),
    );
    item.insert(
        "primaryAudience".to_string(),
        AttributeValue::S(persona.primary_audience.clone()),
    );
    item.insert(
        "createdAt".to_string(),
        AttributeValue::S(persona.created_at.clone()),
    );
    item.insert(
        "updatedAt".to_string(),
        AttributeValue::S(persona.updated_at.clone()),
    );
    item.insert(
        "status".to_string(),
        AttributeValue::S(persona.status.clone()),
    );

    if let Some(ref voice_traits) = persona.voice_traits {
        let traits: Vec<AttributeValue> = voice_traits
            .iter()
            .map(|t| AttributeValue::S(t.clone()))
            .collect();
        item.insert("voiceTraits".to_string(), AttributeValue::L(traits));
    }

    if let Some(ref writing_habits) = persona.writing_habits {
        let json_str = serde_json::to_string(writing_habits).map_err(|e| {
            ApiError::internal(format!("Failed to serialize writing habits: {}", e))
        })?;
        item.insert("writingHabits".to_string(), AttributeValue::S(json_str));
    }

    if let Some(ref opinions) = persona.opinions {
        let json_str = serde_json::to_string(opinions)
            .map_err(|e| ApiError::internal(format!("Failed to serialize opinions: {}", e)))?;
        item.insert("opinions".to_string(), AttributeValue::S(json_str));
    }

    if let Some(ref language) = persona.language {
        let json_str = serde_json::to_string(language)
            .map_err(|e| ApiError::internal(format!("Failed to serialize language: {}", e)))?;
        item.insert("language".to_string(), AttributeValue::S(json_str));
    }

    if let Some(ref cta_style) = persona.cta_style {
        let json_str = serde_json::to_string(cta_style)
            .map_err(|e| ApiError::internal(format!("Failed to serialize cta_style: {}", e)))?;
        item.insert("ctaStyle".to_string(), AttributeValue::S(json_str));
    }

    if let Some(ref inferred_style) = persona.inferred_style {
        let json_str = serde_json::to_string(inferred_style).map_err(|e| {
            ApiError::internal(format!("Failed to serialize inferred_style: {}", e))
        })?;
        item.insert("inferredStyle".to_string(), AttributeValue::S(json_str));
    }

    Ok(item)
}

pub fn deserialize_persona(item: &HashMap<String, AttributeValue>) -> Result<Persona, ApiError> {
    let id = get_string(item, "id")?;
    let tenant_id = extract_tenant_from_pk(get_string(item, "pk")?)?;
    let name = get_string(item, "name")?;
    let role = get_string(item, "role")?;
    let company = get_string(item, "company")?;
    let primary_audience = get_string(item, "primaryAudience")?;
    let created_at = get_string(item, "createdAt")?;
    let updated_at = get_string(item, "updatedAt")?;
    let status = get_string(item, "status")?;

    let voice_traits = get_optional_string_list(item, "voiceTraits");

    let writing_habits = get_optional_json(item, "writingHabits")?;
    let opinions = get_optional_json(item, "opinions")?;
    let language = get_optional_json(item, "language")?;
    let cta_style = get_optional_json(item, "ctaStyle")?;
    let inferred_style = get_optional_json(item, "inferredStyle")?;

    Ok(Persona {
        id,
        tenant_id,
        name,
        role,
        company,
        primary_audience,
        voice_traits,
        writing_habits,
        opinions,
        language,
        cta_style,
        inferred_style,
        created_at,
        updated_at,
        status,
    })
}

pub fn serialize_brand(brand: &Brand) -> Result<HashMap<String, AttributeValue>, ApiError> {
    let mut item = HashMap::new();

    item.insert(
        "pk".to_string(),
        AttributeValue::S(format!("{}#{}", brand.tenant_id, brand.id)),
    );
    item.insert("sk".to_string(), AttributeValue::S("metadata".to_string()));
    item.insert(
        "GSI1PK".to_string(),
        AttributeValue::S(brand.tenant_id.clone()),
    );
    item.insert(
        "GSI1SK".to_string(),
        AttributeValue::S(format!("BRAND#{}", brand.created_at)),
    );

    item.insert("brandId".to_string(), AttributeValue::S(brand.id.clone()));
    item.insert("name".to_string(), AttributeValue::S(brand.name.clone()));
    item.insert("ethos".to_string(), AttributeValue::S(brand.ethos.clone()));

    let core_values: Vec<AttributeValue> = brand
        .core_values
        .iter()
        .map(|v| AttributeValue::S(v.clone()))
        .collect();
    item.insert("coreValues".to_string(), AttributeValue::L(core_values));

    item.insert(
        "primaryAudience".to_string(),
        AttributeValue::S(brand.primary_audience.clone()),
    );
    item.insert(
        "createdAt".to_string(),
        AttributeValue::S(brand.created_at.clone()),
    );
    item.insert(
        "updatedAt".to_string(),
        AttributeValue::S(brand.updated_at.clone()),
    );
    item.insert(
        "status".to_string(),
        AttributeValue::S(brand.status.clone()),
    );

    if let Some(ref voice_guidelines) = brand.voice_guidelines {
        let json_str = serde_json::to_string(voice_guidelines).map_err(|e| {
            ApiError::internal(format!("Failed to serialize voice_guidelines: {}", e))
        })?;
        item.insert("voiceGuidelines".to_string(), AttributeValue::S(json_str));
    }

    if let Some(ref content_standards) = brand.content_standards {
        let json_str = serde_json::to_string(content_standards).map_err(|e| {
            ApiError::internal(format!("Failed to serialize content_standards: {}", e))
        })?;
        item.insert("contentStandards".to_string(), AttributeValue::S(json_str));
    }

    if let Some(ref visual_identity) = brand.visual_identity {
        let json_str = serde_json::to_string(visual_identity).map_err(|e| {
            ApiError::internal(format!("Failed to serialize visual_identity: {}", e))
        })?;
        item.insert("visualIdentity".to_string(), AttributeValue::S(json_str));
    }

    if let Some(approval_threshold) = brand.approval_threshold {
        item.insert(
            "approvalThreshold".to_string(),
            AttributeValue::N(approval_threshold.to_string()),
        );
    }

    if let Some(ref assets) = brand.assets {
        let json_str = serde_json::to_string(assets)
            .map_err(|e| ApiError::internal(format!("Failed to serialize assets: {}", e)))?;
        item.insert("assets".to_string(), AttributeValue::S(json_str));
    }

    Ok(item)
}

pub fn deserialize_brand(item: &HashMap<String, AttributeValue>) -> Result<Brand, ApiError> {
    let id = get_string(item, "brandId")?;
    let tenant_id = extract_tenant_from_pk(get_string(item, "pk")?)?;
    let name = get_string(item, "name")?;
    let ethos = get_string(item, "ethos")?;
    let core_values = get_string_list(item, "coreValues")?;
    let primary_audience = get_string(item, "primaryAudience")?;
    let created_at = get_string(item, "createdAt")?;
    let updated_at = get_string(item, "updatedAt")?;
    let status = get_string(item, "status")?;

    let voice_guidelines = get_optional_json_lenient(item, "voiceGuidelines");
    let content_standards = get_optional_json_lenient(item, "contentStandards");
    let visual_identity = get_optional_json_lenient(item, "visualIdentity");
    let approval_threshold = get_optional_number(item, "approvalThreshold")
        .ok()
        .flatten();
    let assets = get_optional_json_lenient(item, "assets");

    Ok(Brand {
        id,
        tenant_id,
        name,
        ethos,
        core_values,
        primary_audience,
        voice_guidelines,
        content_standards,
        visual_identity,
        approval_threshold,
        assets,
        created_at,
        updated_at,
        status,
    })
}

pub fn serialize_campaign(
    campaign: &Campaign,
) -> Result<HashMap<String, AttributeValue>, ApiError> {
    let mut item = HashMap::new();

    item.insert(
        "pk".to_string(),
        AttributeValue::S(format!("{}#{}", campaign.tenant_id, campaign.id)),
    );
    item.insert("sk".to_string(), AttributeValue::S("metadata".to_string()));
    item.insert(
        "GSI1PK".to_string(),
        AttributeValue::S(campaign.tenant_id.clone()),
    );
    item.insert(
        "GSI1SK".to_string(),
        AttributeValue::S(format!("CAMPAIGN#{}", campaign.created_at)),
    );

    item.insert("id".to_string(), AttributeValue::S(campaign.id.clone()));
    item.insert("name".to_string(), AttributeValue::S(campaign.name.clone()));
    item.insert(
        "brandId".to_string(),
        AttributeValue::S(campaign.brand_id.clone()),
    );

    let persona_ids: Vec<AttributeValue> = campaign
        .persona_ids
        .iter()
        .map(|id| AttributeValue::S(id.clone()))
        .collect();
    item.insert("personaIds".to_string(), AttributeValue::L(persona_ids));

    let platforms: Vec<AttributeValue> = campaign
        .platforms
        .iter()
        .map(|p| AttributeValue::S(p.clone()))
        .collect();
    item.insert("platforms".to_string(), AttributeValue::L(platforms));

    item.insert(
        "startDate".to_string(),
        AttributeValue::S(campaign.start_date.clone()),
    );
    item.insert(
        "endDate".to_string(),
        AttributeValue::S(campaign.end_date.clone()),
    );
    item.insert(
        "postFrequency".to_string(),
        AttributeValue::S(campaign.post_frequency.clone()),
    );

    let status_str = match campaign.status {
        crate::domain::entities::CampaignStatus::Draft => "draft",
        crate::domain::entities::CampaignStatus::Building => "building",
        crate::domain::entities::CampaignStatus::Ready => "ready",
        crate::domain::entities::CampaignStatus::Published => "published",
    };
    item.insert(
        "status".to_string(),
        AttributeValue::S(status_str.to_string()),
    );

    item.insert(
        "createdAt".to_string(),
        AttributeValue::S(campaign.created_at.clone()),
    );
    item.insert(
        "updatedAt".to_string(),
        AttributeValue::S(campaign.updated_at.clone()),
    );

    if let Some(ref themes) = campaign.themes {
        let theme_list: Vec<AttributeValue> = themes
            .iter()
            .map(|t| AttributeValue::S(t.clone()))
            .collect();
        item.insert("themes".to_string(), AttributeValue::L(theme_list));
    }

    if let Some(ref assets) = campaign.assets {
        let json_str = serde_json::to_string(assets)
            .map_err(|e| ApiError::internal(format!("Failed to serialize assets: {}", e)))?;
        item.insert("assets".to_string(), AttributeValue::S(json_str));
    }

    Ok(item)
}

pub fn deserialize_campaign(item: &HashMap<String, AttributeValue>) -> Result<Campaign, ApiError> {
    let id = get_string(item, "id")?;
    let tenant_id = extract_tenant_from_pk(get_string(item, "pk")?)?;
    let name = get_string(item, "name")?;
    let brand_id = get_string(item, "brandId")?;
    let persona_ids = get_string_list(item, "personaIds")?;
    let platforms = get_string_list(item, "platforms")?;
    let start_date = get_string(item, "startDate")?;
    let end_date = get_string(item, "endDate")?;
    let post_frequency = get_string(item, "postFrequency")?;
    let status_str = get_string(item, "status")?;
    let created_at = get_string(item, "createdAt")?;
    let updated_at = get_string(item, "updatedAt")?;

    let status = match status_str.as_str() {
        "draft" => crate::domain::entities::CampaignStatus::Draft,
        "building" => crate::domain::entities::CampaignStatus::Building,
        "ready" => crate::domain::entities::CampaignStatus::Ready,
        "published" => crate::domain::entities::CampaignStatus::Published,
        _ => {
            return Err(ApiError::internal(format!(
                "Invalid campaign status: {}",
                status_str
            )))
        }
    };

    let themes = get_optional_string_list(item, "themes");
    let assets = get_optional_json(item, "assets")?;

    Ok(Campaign {
        id,
        tenant_id,
        name,
        brand_id,
        persona_ids,
        platforms,
        start_date,
        end_date,
        post_frequency,
        themes,
        assets,
        status,
        created_at,
        updated_at,
    })
}

pub fn serialize_asset(asset: &Asset) -> Result<HashMap<String, AttributeValue>, ApiError> {
    let mut item = HashMap::new();

    item.insert(
        "pk".to_string(),
        AttributeValue::S(format!("{}#{}", asset.tenant_id, asset.id)),
    );
    item.insert("sk".to_string(), AttributeValue::S("metadata".to_string()));
    item.insert(
        "GSI1PK".to_string(),
        AttributeValue::S(asset.tenant_id.clone()),
    );
    item.insert(
        "GSI1SK".to_string(),
        AttributeValue::S(format!("ASSET#{}", asset.created_at)),
    );

    item.insert("id".to_string(), AttributeValue::S(asset.id.clone()));
    item.insert(
        "filename".to_string(),
        AttributeValue::S(asset.filename.clone()),
    );
    item.insert(
        "contentType".to_string(),
        AttributeValue::S(asset.content_type.clone()),
    );
    item.insert(
        "sizeBytes".to_string(),
        AttributeValue::N(asset.size_bytes.to_string()),
    );
    item.insert(
        "approvalStatus".to_string(),
        AttributeValue::S(asset.approval_status.clone()),
    );
    item.insert("s3Key".to_string(), AttributeValue::S(asset.s3_key.clone()));
    item.insert(
        "createdAt".to_string(),
        AttributeValue::S(asset.created_at.clone()),
    );
    item.insert(
        "updatedAt".to_string(),
        AttributeValue::S(asset.updated_at.clone()),
    );
    item.insert(
        "status".to_string(),
        AttributeValue::S(asset.status.clone()),
    );

    if let Some(ref description) = asset.description {
        item.insert(
            "description".to_string(),
            AttributeValue::S(description.clone()),
        );
    }

    if let Some(ref category) = asset.category {
        item.insert("category".to_string(), AttributeValue::S(category.clone()));
    }

    Ok(item)
}

pub fn deserialize_asset(item: &HashMap<String, AttributeValue>) -> Result<Asset, ApiError> {
    let id = get_string(item, "id")?;
    let tenant_id = extract_tenant_from_pk(get_string(item, "pk")?)?;
    let filename = get_string(item, "filename")?;
    let content_type = get_string(item, "contentType")?;
    let size_bytes = get_number(item, "sizeBytes")?;
    let approval_status = get_string(item, "approvalStatus")?;
    let s3_key = get_string(item, "s3Key")?;
    let created_at = get_string(item, "createdAt")?;
    let updated_at = get_string(item, "updatedAt")?;
    let status = get_string(item, "status")?;

    let description = get_optional_string(item, "description");
    let category = get_optional_string(item, "category");

    Ok(Asset {
        id,
        tenant_id,
        filename,
        content_type,
        size_bytes,
        description,
        category,
        approval_status,
        s3_key,
        created_at,
        updated_at,
        status,
    })
}

pub fn serialize_writing_example(
    example: &WritingExample,
) -> Result<HashMap<String, AttributeValue>, ApiError> {
    let mut item = HashMap::new();

    item.insert(
        "pk".to_string(),
        AttributeValue::S(format!("{}#{}", example.tenant_id, example.persona_id)),
    );
    item.insert(
        "sk".to_string(),
        AttributeValue::S(format!("EXAMPLE#{}", example.id)),
    );

    item.insert("id".to_string(), AttributeValue::S(example.id.clone()));
    item.insert(
        "personaId".to_string(),
        AttributeValue::S(example.persona_id.clone()),
    );
    item.insert(
        "content".to_string(),
        AttributeValue::S(example.content.clone()),
    );
    item.insert(
        "platform".to_string(),
        AttributeValue::S(example.platform.clone()),
    );
    item.insert(
        "createdAt".to_string(),
        AttributeValue::S(example.created_at.clone()),
    );
    item.insert(
        "status".to_string(),
        AttributeValue::S(example.status.clone()),
    );

    if let Some(ref context) = example.context {
        item.insert("context".to_string(), AttributeValue::S(context.clone()));
    }

    Ok(item)
}

pub fn deserialize_writing_example(
    item: &HashMap<String, AttributeValue>,
) -> Result<WritingExample, ApiError> {
    let id = get_string(item, "id")?;
    let persona_id = get_string(item, "personaId")?;
    let tenant_id = extract_tenant_from_pk(get_string(item, "pk")?)?;
    let content = get_string(item, "content")?;
    let platform = get_string(item, "platform")?;
    let created_at = get_string(item, "createdAt")?;
    let status = get_string(item, "status")?;

    let context = get_optional_string(item, "context");

    Ok(WritingExample {
        id,
        persona_id,
        tenant_id,
        content,
        platform,
        context,
        created_at,
        status,
    })
}

fn get_string(item: &HashMap<String, AttributeValue>, key: &str) -> Result<String, ApiError> {
    item.get(key)
        .and_then(|v| v.as_s().ok())
        .map(|s| s.to_string())
        .ok_or_else(|| ApiError::internal(format!("Missing or invalid field: {}", key)))
}

fn get_optional_string(item: &HashMap<String, AttributeValue>, key: &str) -> Option<String> {
    item.get(key)
        .and_then(|v| v.as_s().ok())
        .map(|s| s.to_string())
}

fn get_string_list(
    item: &HashMap<String, AttributeValue>,
    key: &str,
) -> Result<Vec<String>, ApiError> {
    item.get(key)
        .and_then(|v| v.as_l().ok())
        .map(|list| {
            list.iter()
                .filter_map(|v| v.as_s().ok().map(|s| s.to_string()))
                .collect()
        })
        .ok_or_else(|| ApiError::internal(format!("Missing or invalid field: {}", key)))
}

fn get_optional_string_list(
    item: &HashMap<String, AttributeValue>,
    key: &str,
) -> Option<Vec<String>> {
    item.get(key).and_then(|v| v.as_l().ok()).map(|list| {
        list.iter()
            .filter_map(|v| v.as_s().ok().map(|s| s.to_string()))
            .collect()
    })
}

fn get_number(item: &HashMap<String, AttributeValue>, key: &str) -> Result<i64, ApiError> {
    item.get(key)
        .and_then(|v| v.as_n().ok())
        .and_then(|s| s.parse::<i64>().ok())
        .ok_or_else(|| ApiError::internal(format!("Missing or invalid field: {}", key)))
}

fn get_optional_number(
    item: &HashMap<String, AttributeValue>,
    key: &str,
) -> Result<Option<f64>, ApiError> {
    match item.get(key) {
        Some(v) => {
            let num = v
                .as_n()
                .ok()
                .and_then(|s| s.parse::<f64>().ok())
                .ok_or_else(|| ApiError::internal(format!("Invalid number field: {}", key)))?;
            Ok(Some(num))
        }
        None => Ok(None),
    }
}

fn get_optional_json<T: serde::de::DeserializeOwned>(
    item: &HashMap<String, AttributeValue>,
    key: &str,
) -> Result<Option<T>, ApiError> {
    match item.get(key) {
        Some(v) => {
            let json_str = v
                .as_s()
                .ok()
                .ok_or_else(|| ApiError::internal(format!("Invalid JSON field: {}", key)))?;
            let parsed: T = serde_json::from_str(json_str).map_err(|e| {
                tracing::error!(
                    field = %key,
                    json_str = %json_str,
                    error = %e,
                    "Failed to parse JSON field"
                );
                ApiError::internal(format!("Failed to parse {}: {}", key, e))
            })?;
            Ok(Some(parsed))
        }
        None => Ok(None),
    }
}

fn get_optional_json_lenient<T: serde::de::DeserializeOwned>(
    item: &HashMap<String, AttributeValue>,
    key: &str,
) -> Option<T> {
    match item.get(key) {
        Some(v) => {
            let json_str = v.as_s().ok()?;
            match serde_json::from_str::<T>(json_str) {
                Ok(parsed) => Some(parsed),
                Err(e) => {
                    tracing::warn!(
                        field = %key,
                        json_str = %json_str,
                        error = %e,
                        "Failed to parse optional JSON field, skipping"
                    );
                    None
                }
            }
        }
        None => None,
    }
}

fn extract_tenant_from_pk(pk: String) -> Result<String, ApiError> {
    pk.split('#')
        .next()
        .map(|s| s.to_string())
        .ok_or_else(|| ApiError::internal("Invalid pk structure"))
}
