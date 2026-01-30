#![allow(dead_code)]

use crate::domain::errors::ApiError;
use crate::domain::responses::ApiResponse;
use crate::inbound::http::context::RequestCtx;
use crate::inbound::ports::assets::{
    ApproveAssetRequest, AssetListResponse, AssetsUseCase, CreateAssetRequest, UpdateAssetRequest,
};
use aws_lambda_events::apigw::ApiGatewayProxyRequest;
use serde_json::json;
use std::sync::Arc;

pub async fn list_assets(
    event: &ApiGatewayProxyRequest,
    use_case: Arc<dyn AssetsUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    let assets = use_case.list_assets(&ctx.tenant_id).await?;

    Ok(ApiResponse::json(200, json!(AssetListResponse { assets })))
}

pub async fn get_asset(
    event: &ApiGatewayProxyRequest,
    asset_id: &str,
    use_case: Arc<dyn AssetsUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    let asset = use_case.get_asset(&ctx.tenant_id, asset_id).await?;

    Ok(ApiResponse::json(200, json!(asset)))
}

pub async fn create_asset(
    event: &ApiGatewayProxyRequest,
    use_case: Arc<dyn AssetsUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    let body = event
        .body
        .as_ref()
        .ok_or_else(|| ApiError::bad_request("Missing request body"))?;

    let req: CreateAssetRequest = serde_json::from_str(body)
        .map_err(|e| ApiError::bad_request(format!("Invalid request body: {}", e)))?;

    let response = use_case.create_asset(&ctx.tenant_id, req).await?;

    Ok(ApiResponse::json(201, json!(response)))
}

pub async fn update_asset(
    event: &ApiGatewayProxyRequest,
    asset_id: &str,
    use_case: Arc<dyn AssetsUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    let body = event
        .body
        .as_ref()
        .ok_or_else(|| ApiError::bad_request("Missing request body"))?;

    let req: UpdateAssetRequest = serde_json::from_str(body)
        .map_err(|e| ApiError::bad_request(format!("Invalid request body: {}", e)))?;

    use_case.update_asset(&ctx.tenant_id, asset_id, req).await?;

    Ok(ApiResponse::json(
        200,
        json!({ "message": "Asset updated" }),
    ))
}

pub async fn delete_asset(
    event: &ApiGatewayProxyRequest,
    asset_id: &str,
    use_case: Arc<dyn AssetsUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    use_case.delete_asset(&ctx.tenant_id, asset_id).await?;

    Ok(ApiResponse::json(
        200,
        json!({ "message": "Asset deleted" }),
    ))
}

#[allow(dead_code)]
pub async fn approve_asset(
    event: &ApiGatewayProxyRequest,
    asset_id: &str,
    use_case: Arc<dyn AssetsUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    let body = event
        .body
        .as_ref()
        .ok_or_else(|| ApiError::bad_request("Missing request body"))?;

    let req: ApproveAssetRequest = serde_json::from_str(body)
        .map_err(|e| ApiError::bad_request(format!("Invalid request body: {}", e)))?;

    use_case
        .approve_asset(&ctx.tenant_id, asset_id, req)
        .await?;

    Ok(ApiResponse::json(
        200,
        json!({ "message": "Asset approval status updated" }),
    ))
}
