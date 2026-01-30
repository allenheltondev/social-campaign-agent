use crate::domain::errors::ApiError;
use crate::domain::responses::ApiResponse;
use crate::inbound::http::context::RequestCtx;
use crate::inbound::ports::campaigns::{
    CampaignListResponse, CampaignPostsResponse, CampaignsUseCase, CreateCampaignRequest,
    UpdateCampaignRequest,
};
use aws_lambda_events::apigw::ApiGatewayProxyRequest;
use serde_json::json;
use std::sync::Arc;

pub async fn list_campaigns(
    event: &ApiGatewayProxyRequest,
    use_case: Arc<dyn CampaignsUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    let campaigns = use_case.list_campaigns(&ctx.tenant_id).await?;

    Ok(ApiResponse::json(
        200,
        json!(CampaignListResponse { campaigns }),
    ))
}

pub async fn get_campaign(
    event: &ApiGatewayProxyRequest,
    campaign_id: &str,
    use_case: Arc<dyn CampaignsUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    let campaign = use_case.get_campaign(&ctx.tenant_id, campaign_id).await?;

    Ok(ApiResponse::json(200, json!(campaign)))
}

pub async fn create_campaign(
    event: &ApiGatewayProxyRequest,
    use_case: Arc<dyn CampaignsUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    let body = event
        .body
        .as_ref()
        .ok_or_else(|| ApiError::bad_request("Missing request body"))?;

    let req: CreateCampaignRequest = serde_json::from_str(body)
        .map_err(|e| ApiError::bad_request(format!("Invalid request body: {}", e)))?;

    let campaign_id = use_case.create_campaign(&ctx.tenant_id, req).await?;

    Ok(ApiResponse::json(201, json!({ "campaignId": campaign_id })))
}

pub async fn update_campaign(
    event: &ApiGatewayProxyRequest,
    campaign_id: &str,
    use_case: Arc<dyn CampaignsUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    let body = event
        .body
        .as_ref()
        .ok_or_else(|| ApiError::bad_request("Missing request body"))?;

    let req: UpdateCampaignRequest = serde_json::from_str(body)
        .map_err(|e| ApiError::bad_request(format!("Invalid request body: {}", e)))?;

    use_case
        .update_campaign(&ctx.tenant_id, campaign_id, req)
        .await?;

    Ok(ApiResponse::json(
        200,
        json!({ "message": "Campaign updated" }),
    ))
}

pub async fn delete_campaign(
    event: &ApiGatewayProxyRequest,
    campaign_id: &str,
    use_case: Arc<dyn CampaignsUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    use_case
        .delete_campaign(&ctx.tenant_id, campaign_id)
        .await?;

    Ok(ApiResponse::json(
        200,
        json!({ "message": "Campaign deleted" }),
    ))
}

pub async fn list_campaign_posts(
    event: &ApiGatewayProxyRequest,
    campaign_id: &str,
    use_case: Arc<dyn CampaignsUseCase>,
) -> Result<ApiResponse, ApiError> {
    let ctx = RequestCtx::from_request(event)?;

    let posts = use_case
        .list_campaign_posts(&ctx.tenant_id, campaign_id)
        .await?;

    Ok(ApiResponse::json(
        200,
        json!(CampaignPostsResponse { posts }),
    ))
}
