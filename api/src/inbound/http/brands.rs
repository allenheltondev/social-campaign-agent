use crate::domain::errors::ApiError;
use crate::domain::responses::ApiResponse;
use crate::inbound::http::context::RequestCtx;
use crate::inbound::ports::brands::{
    BrandListResponse, BrandsUseCase, CreateBrandRequest, UpdateBrandRequest,
    UploadBrandAssetRequest,
};
use aws_lambda_events::apigw::ApiGatewayProxyRequest;
use serde_json::json;
use std::sync::Arc;

pub async fn list_brands(
    event: &ApiGatewayProxyRequest,
    use_case: Arc<dyn BrandsUseCase>,
) -> Result<ApiResponse, ApiError> {
    tracing::info!("list_brands: Starting");

    let ctx = RequestCtx::from_request(event)?;
    tracing::info!(tenant_id = %ctx.tenant_id, "list_brands: Got tenant context");

    let brands = use_case.list_brands(&ctx.tenant_id).await?;
    tracing::info!(brand_count = brands.len(), "list_brands: Retrieved brands");

    let response = BrandListResponse { brands };
    tracing::info!("list_brands: Creating JSON response");

    Ok(ApiResponse::json(200, json!(response)))
}

pub async fn get_brand(
    event: &ApiGatewayProxyRequest,
    brand_id: &str,
    use_case: Arc<dyn BrandsUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    let brand = use_case.get_brand(&ctx.tenant_id, brand_id).await?;

    Ok(ApiResponse::json(200, json!(brand)))
}

pub async fn create_brand(
    event: &ApiGatewayProxyRequest,
    use_case: Arc<dyn BrandsUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    let body = event
        .body
        .as_ref()
        .ok_or_else(|| ApiError::bad_request("Missing request body"))?;

    let req: CreateBrandRequest = serde_json::from_str(body)
        .map_err(|e| ApiError::bad_request(format!("Invalid request body: {}", e)))?;

    let brand_id = use_case.create_brand(&ctx.tenant_id, req).await?;

    Ok(ApiResponse::json(201, json!({ "brandId": brand_id })))
}

pub async fn update_brand(
    event: &ApiGatewayProxyRequest,
    brand_id: &str,
    use_case: Arc<dyn BrandsUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    let body = event
        .body
        .as_ref()
        .ok_or_else(|| ApiError::bad_request("Missing request body"))?;

    let req: UpdateBrandRequest = serde_json::from_str(body)
        .map_err(|e| ApiError::bad_request(format!("Invalid request body: {}", e)))?;

    use_case.update_brand(&ctx.tenant_id, brand_id, req).await?;

    Ok(ApiResponse::json(
        200,
        json!({ "message": "Brand updated" }),
    ))
}

pub async fn delete_brand(
    event: &ApiGatewayProxyRequest,
    brand_id: &str,
    use_case: Arc<dyn BrandsUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    use_case.delete_brand(&ctx.tenant_id, brand_id).await?;

    Ok(ApiResponse::json(
        200,
        json!({ "message": "Brand deleted" }),
    ))
}

pub async fn list_brand_assets(
    event: &ApiGatewayProxyRequest,
    brand_id: &str,
    use_case: Arc<dyn BrandsUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    let assets = use_case.list_brand_assets(&ctx.tenant_id, brand_id).await?;

    Ok(ApiResponse::json(200, json!({ "assets": assets })))
}

pub async fn upload_brand_asset(
    event: &ApiGatewayProxyRequest,
    brand_id: &str,
    use_case: Arc<dyn BrandsUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    let body = event
        .body
        .as_ref()
        .ok_or_else(|| ApiError::bad_request("Missing request body"))?;

    let req: UploadBrandAssetRequest = serde_json::from_str(body)
        .map_err(|e| ApiError::bad_request(format!("Invalid request body: {}", e)))?;

    let response = use_case
        .upload_brand_asset(&ctx.tenant_id, brand_id, req)
        .await?;

    Ok(ApiResponse::json(201, json!(response)))
}

pub async fn delete_brand_asset(
    event: &ApiGatewayProxyRequest,
    brand_id: &str,
    asset_id: &str,
    use_case: Arc<dyn BrandsUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    use_case
        .delete_brand_asset(&ctx.tenant_id, brand_id, asset_id)
        .await?;

    Ok(ApiResponse::json(
        200,
        json!({ "message": "Brand asset deleted" }),
    ))
}
