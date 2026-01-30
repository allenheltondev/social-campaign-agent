use aws_lambda_events::apigw::{
    ApiGatewayProxyRequest, ApiGatewayProxyRequestContext, ApiGatewayRequestAuthorizer,
};
use campaign_api::inbound::http::context::RequestCtx;
use serde_json::json;
use std::collections::HashMap;

fn create_test_request(tenant_id: Option<&str>) -> ApiGatewayProxyRequest {
    let mut fields = HashMap::new();
    if let Some(tid) = tenant_id {
        fields.insert("tenantId".to_string(), json!(tid));
    }

    ApiGatewayProxyRequest {
        resource: None,
        path: Some("/test".to_string()),
        http_method: aws_lambda_events::http::Method::GET,
        headers: Default::default(),
        multi_value_headers: Default::default(),
        query_string_parameters: Default::default(),
        multi_value_query_string_parameters: Default::default(),
        path_parameters: Default::default(),
        stage_variables: Default::default(),
        request_context: ApiGatewayProxyRequestContext {
            account_id: Some("123456789012".to_string()),
            resource_id: Some("resource".to_string()),
            stage: Some("prod".to_string()),
            request_id: Some("request-id".to_string()),
            identity: Default::default(),
            resource_path: Some("/test".to_string()),
            authorizer: ApiGatewayRequestAuthorizer {
                fields,
                ..Default::default()
            },
            http_method: aws_lambda_events::http::Method::GET,
            apiid: Some("api-id".to_string()),
            domain_name: None,
            domain_prefix: None,
            operation_name: None,
            protocol: None,
            request_time: None,
            request_time_epoch: 0,
            path: None,
        },
        body: None,
        is_base64_encoded: false,
    }
}

#[test]
fn test_from_request_extracts_tenant_id() {
    let request = create_test_request(Some("tenant1"));

    let ctx = RequestCtx::from_request(&request).unwrap();

    assert_eq!(ctx.tenant_id, "tenant1");
}

#[test]
fn test_from_request_returns_error_when_tenant_id_missing() {
    let request = create_test_request(None);

    let result = RequestCtx::from_request(&request);

    assert!(result.is_err());
    assert_eq!(result.unwrap_err().message(), "Missing tenant ID");
}
