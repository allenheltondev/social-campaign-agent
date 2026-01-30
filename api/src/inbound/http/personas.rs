use crate::domain::errors::ApiError;
use crate::domain::responses::ApiResponse;
use crate::inbound::http::context::RequestCtx;
use crate::inbound::ports::personas::{
    CreatePersonaRequest, CreateWritingExampleRequest, PersonaListResponse, PersonasUseCase,
    UpdatePersonaRequest,
};
use aws_lambda_events::apigw::ApiGatewayProxyRequest;
use serde_json::json;
use std::sync::Arc;

pub async fn list_personas(
    event: &ApiGatewayProxyRequest,
    use_case: Arc<dyn PersonasUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    let personas = use_case.list_personas(&ctx.tenant_id).await?;

    Ok(ApiResponse::json(
        200,
        json!(PersonaListResponse { personas }),
    ))
}

pub async fn get_persona(
    event: &ApiGatewayProxyRequest,
    persona_id: &str,
    use_case: Arc<dyn PersonasUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    let persona = use_case.get_persona(&ctx.tenant_id, persona_id).await?;

    Ok(ApiResponse::json(200, json!(persona)))
}

pub async fn create_persona(
    event: &ApiGatewayProxyRequest,
    use_case: Arc<dyn PersonasUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    let body = event
        .body
        .as_ref()
        .ok_or_else(|| ApiError::bad_request("Missing request body"))?;

    let req: CreatePersonaRequest = serde_json::from_str(body)
        .map_err(|e| ApiError::bad_request(format!("Invalid request body: {}", e)))?;

    let persona_id = use_case.create_persona(&ctx.tenant_id, req).await?;

    Ok(ApiResponse::json(201, json!({ "personaId": persona_id })))
}

pub async fn update_persona(
    event: &ApiGatewayProxyRequest,
    persona_id: &str,
    use_case: Arc<dyn PersonasUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    let body = event
        .body
        .as_ref()
        .ok_or_else(|| ApiError::bad_request("Missing request body"))?;

    let req: UpdatePersonaRequest = serde_json::from_str(body)
        .map_err(|e| ApiError::bad_request(format!("Invalid request body: {}", e)))?;

    use_case
        .update_persona(&ctx.tenant_id, persona_id, req)
        .await?;

    Ok(ApiResponse::json(
        200,
        json!({ "message": "Persona updated" }),
    ))
}

pub async fn delete_persona(
    event: &ApiGatewayProxyRequest,
    persona_id: &str,
    use_case: Arc<dyn PersonasUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    use_case.delete_persona(&ctx.tenant_id, persona_id).await?;

    Ok(ApiResponse::json(
        200,
        json!({ "message": "Persona deleted" }),
    ))
}

pub async fn analyze_persona_style(
    event: &ApiGatewayProxyRequest,
    persona_id: &str,
    use_case: Arc<dyn PersonasUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    use_case
        .trigger_style_analysis(&ctx.tenant_id, persona_id)
        .await?;

    Ok(ApiResponse::json(
        202,
        json!({
            "message": "Style analysis started",
            "personaId": persona_id
        }),
    ))
}

pub async fn list_writing_examples(
    event: &ApiGatewayProxyRequest,
    persona_id: &str,
    use_case: Arc<dyn PersonasUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    let examples = use_case
        .list_writing_examples(&ctx.tenant_id, persona_id)
        .await?;

    Ok(ApiResponse::json(200, json!({ "examples": examples })))
}

pub async fn create_writing_example(
    event: &ApiGatewayProxyRequest,
    persona_id: &str,
    use_case: Arc<dyn PersonasUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    let body = event
        .body
        .as_ref()
        .ok_or_else(|| ApiError::bad_request("Missing request body"))?;

    let req: CreateWritingExampleRequest = serde_json::from_str(body)
        .map_err(|e| ApiError::bad_request(format!("Invalid request body: {}", e)))?;

    let example_id = use_case
        .create_writing_example(&ctx.tenant_id, persona_id, req)
        .await?;

    Ok(ApiResponse::json(201, json!({ "exampleId": example_id })))
}

pub async fn delete_writing_example(
    event: &ApiGatewayProxyRequest,
    persona_id: &str,
    example_id: &str,
    use_case: Arc<dyn PersonasUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    use_case
        .delete_writing_example(&ctx.tenant_id, persona_id, example_id)
        .await?;

    Ok(ApiResponse::json(
        200,
        json!({ "message": "Writing example deleted" }),
    ))
}
