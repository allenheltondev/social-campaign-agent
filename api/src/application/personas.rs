use crate::domain::entities::{Persona, WritingExample};
use crate::domain::errors::ApiError;
use crate::inbound::ports::personas::{
    CreatePersonaRequest, CreateWritingExampleRequest, PersonasUseCase, UpdatePersonaRequest,
};
use crate::outbound::ports::repositories::{PersonaRepository, WritingExampleRepository};
use crate::outbound::ports::services::{Event, EventPublisher};
use async_trait::async_trait;
use serde_json::json;
use std::sync::Arc;
use ulid::Ulid;

pub struct PersonasUseCaseImpl {
    persona_repo: Arc<dyn PersonaRepository>,
    example_repo: Arc<dyn WritingExampleRepository>,
    events: Arc<dyn EventPublisher>,
}

impl PersonasUseCaseImpl {
    pub fn new(
        persona_repo: Arc<dyn PersonaRepository>,
        example_repo: Arc<dyn WritingExampleRepository>,
        events: Arc<dyn EventPublisher>,
    ) -> Self {
        Self {
            persona_repo,
            example_repo,
            events,
        }
    }
}

#[async_trait]
impl PersonasUseCase for PersonasUseCaseImpl {
    async fn list_personas(&self, tenant_id: &str) -> Result<Vec<Persona>, ApiError> {
        self.persona_repo.list_by_tenant(tenant_id).await
    }

    async fn get_persona(&self, tenant_id: &str, persona_id: &str) -> Result<Persona, ApiError> {
        self.persona_repo.get(tenant_id, persona_id).await
    }

    async fn create_persona(
        &self,
        tenant_id: &str,
        req: CreatePersonaRequest,
    ) -> Result<String, ApiError> {
        let persona_id = Ulid::new().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        let persona = Persona {
            id: persona_id.clone(),
            tenant_id: tenant_id.to_string(),
            name: req.name,
            role: req.role,
            company: req.company,
            primary_audience: req.primary_audience,
            voice_traits: req.voice_traits,
            writing_habits: req.writing_habits,
            opinions: req.opinions,
            language: req.language,
            cta_style: req.cta_style,
            inferred_style: None,
            created_at: now.clone(),
            updated_at: now,
            status: "active".to_string(),
        };

        self.persona_repo.create(persona).await?;
        Ok(persona_id)
    }

    async fn update_persona(
        &self,
        tenant_id: &str,
        persona_id: &str,
        req: UpdatePersonaRequest,
    ) -> Result<(), ApiError> {
        let mut persona = self.persona_repo.get(tenant_id, persona_id).await?;

        if let Some(name) = req.name {
            persona.name = name;
        }
        if let Some(role) = req.role {
            persona.role = role;
        }
        if let Some(company) = req.company {
            persona.company = company;
        }
        if let Some(primary_audience) = req.primary_audience {
            persona.primary_audience = primary_audience;
        }
        if let Some(voice_traits) = req.voice_traits {
            persona.voice_traits = Some(voice_traits);
        }
        if let Some(writing_habits) = req.writing_habits {
            persona.writing_habits = Some(writing_habits);
        }
        if let Some(opinions) = req.opinions {
            persona.opinions = Some(opinions);
        }
        if let Some(language) = req.language {
            persona.language = Some(language);
        }
        if let Some(cta_style) = req.cta_style {
            persona.cta_style = Some(cta_style);
        }

        persona.updated_at = chrono::Utc::now().to_rfc3339();

        self.persona_repo.update(persona).await
    }

    async fn delete_persona(&self, tenant_id: &str, persona_id: &str) -> Result<(), ApiError> {
        self.persona_repo.delete(tenant_id, persona_id).await
    }

    async fn trigger_style_analysis(
        &self,
        tenant_id: &str,
        persona_id: &str,
    ) -> Result<(), ApiError> {
        self.events
            .publish(Event {
                source: "api.personas".to_string(),
                detail_type: "StyleAnalysisRequested".to_string(),
                detail: json!({
                    "tenantId": tenant_id,
                    "personaId": persona_id,
                }),
            })
            .await
    }

    async fn list_writing_examples(
        &self,
        tenant_id: &str,
        persona_id: &str,
    ) -> Result<Vec<WritingExample>, ApiError> {
        self.example_repo
            .list_by_persona(tenant_id, persona_id)
            .await
    }

    async fn create_writing_example(
        &self,
        tenant_id: &str,
        persona_id: &str,
        req: CreateWritingExampleRequest,
    ) -> Result<String, ApiError> {
        let example_id = Ulid::new().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        let example = WritingExample {
            id: example_id.clone(),
            persona_id: persona_id.to_string(),
            tenant_id: tenant_id.to_string(),
            content: req.content,
            platform: req.platform,
            context: req.context,
            created_at: now,
            status: "active".to_string(),
        };

        self.example_repo.create(example).await?;
        Ok(example_id)
    }

    async fn delete_writing_example(
        &self,
        tenant_id: &str,
        persona_id: &str,
        example_id: &str,
    ) -> Result<(), ApiError> {
        self.example_repo
            .delete(tenant_id, persona_id, example_id)
            .await
    }
}
