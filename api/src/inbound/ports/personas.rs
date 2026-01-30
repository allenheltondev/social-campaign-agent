use crate::domain::entities::{Persona, WritingExample};
use crate::domain::errors::ApiError;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePersonaRequest {
    pub name: String,
    pub role: String,
    pub company: String,
    pub primary_audience: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voice_traits: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub writing_habits: Option<crate::domain::entities::WritingHabits>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opinions: Option<crate::domain::entities::Opinions>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<crate::domain::entities::Language>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cta_style: Option<crate::domain::entities::CtaStyle>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePersonaRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub company: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary_audience: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voice_traits: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub writing_habits: Option<crate::domain::entities::WritingHabits>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opinions: Option<crate::domain::entities::Opinions>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<crate::domain::entities::Language>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cta_style: Option<crate::domain::entities::CtaStyle>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWritingExampleRequest {
    pub content: String,
    pub platform: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonaListResponse {
    pub personas: Vec<Persona>,
}

#[async_trait]
pub trait PersonasUseCase: Send + Sync {
    async fn list_personas(&self, tenant_id: &str) -> Result<Vec<Persona>, ApiError>;

    async fn get_persona(&self, tenant_id: &str, persona_id: &str) -> Result<Persona, ApiError>;

    async fn create_persona(
        &self,
        tenant_id: &str,
        req: CreatePersonaRequest,
    ) -> Result<String, ApiError>;

    async fn update_persona(
        &self,
        tenant_id: &str,
        persona_id: &str,
        req: UpdatePersonaRequest,
    ) -> Result<(), ApiError>;

    async fn delete_persona(&self, tenant_id: &str, persona_id: &str) -> Result<(), ApiError>;

    async fn trigger_style_analysis(
        &self,
        tenant_id: &str,
        persona_id: &str,
    ) -> Result<(), ApiError>;

    async fn list_writing_examples(
        &self,
        tenant_id: &str,
        persona_id: &str,
    ) -> Result<Vec<WritingExample>, ApiError>;

    async fn create_writing_example(
        &self,
        tenant_id: &str,
        persona_id: &str,
        req: CreateWritingExampleRequest,
    ) -> Result<String, ApiError>;

    async fn delete_writing_example(
        &self,
        tenant_id: &str,
        persona_id: &str,
        example_id: &str,
    ) -> Result<(), ApiError>;
}
