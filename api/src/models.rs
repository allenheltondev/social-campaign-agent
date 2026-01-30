#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Persona {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub role: String,
    pub company: String,
    pub primary_audience: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voice_traits: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub writing_habits: Option<WritingHabits>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opinions: Option<Opinions>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<Language>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cta_style: Option<CtaStyle>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inferred_style: Option<HashMap<String, serde_json::Value>>,
    pub created_at: String,
    pub updated_at: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WritingHabits {
    pub paragraphs: String,
    pub questions: String,
    pub emojis: String,
    pub structure: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Opinions {
    pub strong_beliefs: Vec<String>,
    pub avoids_topics: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Language {
    pub avoid: Vec<String>,
    pub prefer: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CtaStyle {
    pub aggressiveness: String,
    pub patterns: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Brand {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub ethos: String,
    pub core_values: Vec<String>,
    pub primary_audience: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voice_guidelines: Option<VoiceGuidelines>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_standards: Option<ContentStandards>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub visual_identity: Option<VisualIdentity>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_threshold: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assets: Option<Vec<AssetReference>>,
    pub created_at: String,
    pub updated_at: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VoiceGuidelines {
    pub tone: Vec<String>,
    pub style: Vec<String>,
    pub messaging: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ContentStandards {
    pub quality_requirements: Vec<String>,
    pub restrictions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VisualIdentity {
    pub color_palette: Vec<String>,
    pub typography: Vec<String>,
    pub imagery: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AssetReference {
    #[serde(rename = "type")]
    pub asset_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage_intent: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_default: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Campaign {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub brand_id: String,
    pub persona_ids: Vec<String>,
    pub platforms: Vec<String>,
    pub start_date: String,
    pub end_date: String,
    pub post_frequency: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub themes: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assets: Option<Vec<AssetReference>>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    pub id: String,
    pub tenant_id: String,
    pub filename: String,
    pub content_type: String,
    pub size_bytes: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    pub approval_status: String,
    pub s3_key: String,
    pub created_at: String,
    pub updated_at: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WritingExample {
    pub id: String,
    pub persona_id: String,
    pub tenant_id: String,
    pub content: String,
    pub platform: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<String>,
    pub created_at: String,
    pub status: String,
}
