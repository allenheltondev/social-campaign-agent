use campaign_api::application::personas::PersonasUseCaseImpl;
use campaign_api::domain::entities::Persona;
use campaign_api::inbound::ports::personas::{
    CreatePersonaRequest, CreateWritingExampleRequest, PersonasUseCase,
};
use campaign_api::outbound::fakes::{
    FakeEventPublisher, FakePersonaRepository, FakeWritingExampleRepository,
};
use campaign_api::outbound::ports::repositories::PersonaRepository;
use std::sync::Arc;

#[tokio::test]
async fn test_list_personas_returns_all_personas_for_tenant() {
    let persona_repo = Arc::new(FakePersonaRepository::new());
    let example_repo = Arc::new(FakeWritingExampleRepository::new());
    let events = Arc::new(FakeEventPublisher::new());

    let persona1 = Persona {
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

    let persona2 = Persona {
        id: "persona2".to_string(),
        tenant_id: "tenant1".to_string(),
        name: "Jane Smith".to_string(),
        role: "CTO".to_string(),
        company: "Acme Corp".to_string(),
        primary_audience: "Engineers".to_string(),
        voice_traits: None,
        writing_habits: None,
        opinions: None,
        language: None,
        cta_style: None,
        inferred_style: None,
        created_at: "2024-01-02T00:00:00Z".to_string(),
        updated_at: "2024-01-02T00:00:00Z".to_string(),
        status: "active".to_string(),
    };

    persona_repo.create(persona1.clone()).await.unwrap();
    persona_repo.create(persona2.clone()).await.unwrap();

    let use_case = PersonasUseCaseImpl::new(persona_repo, example_repo, events);

    let result = use_case.list_personas("tenant1").await.unwrap();

    assert_eq!(result.len(), 2);
    assert!(result.iter().any(|p| p.id == "persona1"));
    assert!(result.iter().any(|p| p.id == "persona2"));
}

#[tokio::test]
async fn test_list_personas_filters_by_tenant() {
    let persona_repo = Arc::new(FakePersonaRepository::new());
    let example_repo = Arc::new(FakeWritingExampleRepository::new());
    let events = Arc::new(FakeEventPublisher::new());

    let persona1 = Persona {
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

    let persona2 = Persona {
        id: "persona2".to_string(),
        tenant_id: "tenant2".to_string(),
        name: "Jane Smith".to_string(),
        role: "CTO".to_string(),
        company: "Other Corp".to_string(),
        primary_audience: "Engineers".to_string(),
        voice_traits: None,
        writing_habits: None,
        opinions: None,
        language: None,
        cta_style: None,
        inferred_style: None,
        created_at: "2024-01-02T00:00:00Z".to_string(),
        updated_at: "2024-01-02T00:00:00Z".to_string(),
        status: "active".to_string(),
    };

    persona_repo.create(persona1.clone()).await.unwrap();
    persona_repo.create(persona2.clone()).await.unwrap();

    let use_case = PersonasUseCaseImpl::new(persona_repo, example_repo, events);

    let result = use_case.list_personas("tenant1").await.unwrap();

    assert_eq!(result.len(), 1);
    assert_eq!(result[0].id, "persona1");
    assert_eq!(result[0].tenant_id, "tenant1");
}

#[tokio::test]
async fn test_get_persona_returns_correct_persona() {
    let persona_repo = Arc::new(FakePersonaRepository::new());
    let example_repo = Arc::new(FakeWritingExampleRepository::new());
    let events = Arc::new(FakeEventPublisher::new());

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

    persona_repo.create(persona.clone()).await.unwrap();

    let use_case = PersonasUseCaseImpl::new(persona_repo, example_repo, events);

    let result = use_case.get_persona("tenant1", "persona1").await.unwrap();

    assert_eq!(result.id, "persona1");
    assert_eq!(result.name, "John Doe");
    assert_eq!(result.role, "CEO");
}

#[tokio::test]
async fn test_get_persona_returns_not_found_for_nonexistent_persona() {
    let persona_repo = Arc::new(FakePersonaRepository::new());
    let example_repo = Arc::new(FakeWritingExampleRepository::new());
    let events = Arc::new(FakeEventPublisher::new());

    let use_case = PersonasUseCaseImpl::new(persona_repo, example_repo, events);

    let result = use_case.get_persona("tenant1", "nonexistent").await;

    assert!(result.is_err());
    assert_eq!(result.unwrap_err().message(), "Persona not found");
}

#[tokio::test]
async fn test_create_persona_generates_id_and_stores_persona() {
    let persona_repo = Arc::new(FakePersonaRepository::new());
    let example_repo = Arc::new(FakeWritingExampleRepository::new());
    let events = Arc::new(FakeEventPublisher::new());

    let use_case = PersonasUseCaseImpl::new(persona_repo.clone(), example_repo, events);

    let request = CreatePersonaRequest {
        name: "John Doe".to_string(),
        role: "CEO".to_string(),
        company: "Acme Corp".to_string(),
        primary_audience: "Developers".to_string(),
        voice_traits: None,
        writing_habits: None,
        opinions: None,
        language: None,
        cta_style: None,
    };

    let persona_id = use_case.create_persona("tenant1", request).await.unwrap();

    assert!(!persona_id.is_empty());

    let stored_persona = persona_repo.get("tenant1", &persona_id).await.unwrap();
    assert_eq!(stored_persona.id, persona_id);
    assert_eq!(stored_persona.name, "John Doe");
    assert_eq!(stored_persona.tenant_id, "tenant1");
    assert_eq!(stored_persona.status, "active");
}

#[tokio::test]
async fn test_trigger_style_analysis_publishes_correct_event() {
    let persona_repo = Arc::new(FakePersonaRepository::new());
    let example_repo = Arc::new(FakeWritingExampleRepository::new());
    let events = Arc::new(FakeEventPublisher::new());

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

    persona_repo.create(persona).await.unwrap();

    let use_case = PersonasUseCaseImpl::new(persona_repo, example_repo, events.clone());

    use_case
        .trigger_style_analysis("tenant1", "persona1")
        .await
        .unwrap();

    let published_events = events.get_events();
    assert_eq!(published_events.len(), 1);

    let event = &published_events[0];
    assert_eq!(event.source, "api.personas");
    assert_eq!(event.detail_type, "StyleAnalysisRequested");

    let detail = &event.detail;
    assert_eq!(detail["tenantId"], "tenant1");
    assert_eq!(detail["personaId"], "persona1");
}

#[tokio::test]
async fn test_list_writing_examples_returns_examples_for_persona() {
    let persona_repo = Arc::new(FakePersonaRepository::new());
    let example_repo = Arc::new(FakeWritingExampleRepository::new());
    let events = Arc::new(FakeEventPublisher::new());

    let use_case = PersonasUseCaseImpl::new(persona_repo, example_repo.clone(), events);

    let request = CreateWritingExampleRequest {
        content: "This is a test example".to_string(),
        platform: "twitter".to_string(),
        context: Some("Test context".to_string()),
    };

    let example_id = use_case
        .create_writing_example("tenant1", "persona1", request)
        .await
        .unwrap();

    let examples = use_case
        .list_writing_examples("tenant1", "persona1")
        .await
        .unwrap();

    assert_eq!(examples.len(), 1);
    assert_eq!(examples[0].id, example_id);
    assert_eq!(examples[0].content, "This is a test example");
}

#[tokio::test]
async fn test_delete_writing_example_removes_example() {
    let persona_repo = Arc::new(FakePersonaRepository::new());
    let example_repo = Arc::new(FakeWritingExampleRepository::new());
    let events = Arc::new(FakeEventPublisher::new());

    let use_case = PersonasUseCaseImpl::new(persona_repo, example_repo.clone(), events);

    let request = CreateWritingExampleRequest {
        content: "This is a test example".to_string(),
        platform: "twitter".to_string(),
        context: None,
    };

    let example_id = use_case
        .create_writing_example("tenant1", "persona1", request)
        .await
        .unwrap();

    use_case
        .delete_writing_example("tenant1", "persona1", &example_id)
        .await
        .unwrap();

    let examples = use_case
        .list_writing_examples("tenant1", "persona1")
        .await
        .unwrap();

    assert_eq!(examples.len(), 0);
}
