use crate::domain::errors::ApiError;
use aws_lambda_events::apigw::ApiGatewayProxyRequest;

#[derive(Debug, Clone)]
pub struct RequestCtx {
    pub tenant_id: String,
}

impl RequestCtx {
    pub fn from_request(event: &ApiGatewayProxyRequest) -> Result<Self, ApiError> {
        let authorizer = &event.request_context.authorizer;

        tracing::debug!(
            authorizer_fields = ?authorizer.fields,
            "Extracting tenant ID from authorizer"
        );

        let tenant_id = authorizer
            .fields
            .get("tenantId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| {
                tracing::error!("Missing tenant ID in authorizer context");
                ApiError::unauthorized("Missing tenant ID")
            })?;

        tracing::debug!(tenant_id = %tenant_id, "Successfully extracted tenant ID");

        Ok(Self { tenant_id })
    }
}
