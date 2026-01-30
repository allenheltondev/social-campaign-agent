#![allow(dead_code)]

use aws_lambda_events::apigw::ApiGatewayProxyRequest;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AuthError {
    #[error("Missing authorization context")]
    MissingContext,
    #[error("Missing tenant ID")]
    MissingTenantId,
}

pub fn extract_tenant_id(request: &ApiGatewayProxyRequest) -> Result<String, AuthError> {
    let authorizer = &request.request_context.authorizer;

    if let serde_json::Value::String(tenant_id) = authorizer
        .fields
        .get("tenantId")
        .ok_or(AuthError::MissingTenantId)?
    {
        return Ok(tenant_id.clone());
    }

    Err(AuthError::MissingTenantId)
}
