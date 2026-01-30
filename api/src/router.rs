use aws_lambda_events::apigw::{ApiGatewayProxyRequest, ApiGatewayProxyResponse};
use std::sync::Arc;

use crate::domain::errors::ApiError;
use crate::domain::responses::ApiResponse;
use crate::inbound::http::{assets, brands, campaigns, personas};
use crate::inbound::ports::assets::AssetsUseCase;
use crate::inbound::ports::brands::BrandsUseCase;
use crate::inbound::ports::campaigns::CampaignsUseCase;
use crate::inbound::ports::personas::PersonasUseCase;

#[derive(Clone)]
pub struct Router {
    personas_use_case: Arc<dyn PersonasUseCase>,
    brands_use_case: Arc<dyn BrandsUseCase>,
    campaigns_use_case: Arc<dyn CampaignsUseCase>,
    assets_use_case: Arc<dyn AssetsUseCase>,
}

impl Router {
    pub fn new(
        personas_use_case: Arc<dyn PersonasUseCase>,
        brands_use_case: Arc<dyn BrandsUseCase>,
        campaigns_use_case: Arc<dyn CampaignsUseCase>,
        assets_use_case: Arc<dyn AssetsUseCase>,
    ) -> Self {
        Self {
            personas_use_case,
            brands_use_case,
            campaigns_use_case,
            assets_use_case,
        }
    }

    pub async fn route(
        &self,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, Box<dyn std::error::Error>> {
        let method = request.http_method.as_str();
        let path = request.path.as_deref().unwrap_or("/");

        let result = self.route_request(method, path, request).await;

        match result {
            Ok(response) => Ok(response.to_lambda_response()),
            Err(e) => Ok(e.to_lambda_response()),
        }
    }

    async fn route_request(
        &self,
        method: &str,
        path: &str,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiResponse, ApiError> {
        tracing::debug!(method = %method, path = %path, "Routing request");

        match (method, path) {
            ("GET", "/personas") => {
                personas::list_personas(request, self.personas_use_case.clone()).await
            }
            ("POST", "/personas") => {
                personas::create_persona(request, self.personas_use_case.clone()).await
            }
            ("GET", path)
                if path.starts_with("/personas/")
                    && !path.contains("/examples")
                    && !path.contains("/analyze") =>
            {
                let persona_id = extract_path_param(path, "/personas/");
                personas::get_persona(request, persona_id, self.personas_use_case.clone()).await
            }
            ("PUT", path)
                if path.starts_with("/personas/")
                    && !path.contains("/examples")
                    && !path.contains("/analyze") =>
            {
                let persona_id = extract_path_param(path, "/personas/");
                personas::update_persona(request, persona_id, self.personas_use_case.clone()).await
            }
            ("DELETE", path)
                if path.starts_with("/personas/")
                    && !path.contains("/examples")
                    && !path.contains("/analyze") =>
            {
                let persona_id = extract_path_param(path, "/personas/");
                personas::delete_persona(request, persona_id, self.personas_use_case.clone()).await
            }
            ("POST", path) if path.ends_with("/analyze") => {
                let persona_id = extract_path_segment(path, "/personas/", "/analyze");
                personas::analyze_persona_style(request, persona_id, self.personas_use_case.clone())
                    .await
            }
            ("GET", path) if path.contains("/personas/") && path.ends_with("/examples") => {
                let persona_id = extract_path_segment(path, "/personas/", "/examples");
                personas::list_writing_examples(request, persona_id, self.personas_use_case.clone())
                    .await
            }
            ("POST", path) if path.contains("/personas/") && path.ends_with("/examples") => {
                let persona_id = extract_path_segment(path, "/personas/", "/examples");
                personas::create_writing_example(
                    request,
                    persona_id,
                    self.personas_use_case.clone(),
                )
                .await
            }
            ("DELETE", path) if path.contains("/personas/") && path.contains("/examples/") => {
                let (persona_id, example_id) =
                    extract_two_path_params(path, "/personas/", "/examples/");
                personas::delete_writing_example(
                    request,
                    persona_id,
                    example_id,
                    self.personas_use_case.clone(),
                )
                .await
            }
            ("GET", "/brands") => brands::list_brands(request, self.brands_use_case.clone()).await,
            ("POST", "/brands") => {
                brands::create_brand(request, self.brands_use_case.clone()).await
            }
            ("GET", path) if path.starts_with("/brands/") && !path.contains("/assets") => {
                let brand_id = extract_path_param(path, "/brands/");
                brands::get_brand(request, brand_id, self.brands_use_case.clone()).await
            }
            ("PUT", path) if path.starts_with("/brands/") && !path.contains("/assets") => {
                let brand_id = extract_path_param(path, "/brands/");
                brands::update_brand(request, brand_id, self.brands_use_case.clone()).await
            }
            ("DELETE", path) if path.starts_with("/brands/") && !path.contains("/assets") => {
                let brand_id = extract_path_param(path, "/brands/");
                brands::delete_brand(request, brand_id, self.brands_use_case.clone()).await
            }
            ("GET", path) if path.contains("/brands/") && path.ends_with("/assets") => {
                let brand_id = extract_path_segment(path, "/brands/", "/assets");
                brands::list_brand_assets(request, brand_id, self.brands_use_case.clone()).await
            }
            ("POST", path) if path.contains("/brands/") && path.ends_with("/assets") => {
                let brand_id = extract_path_segment(path, "/brands/", "/assets");
                brands::upload_brand_asset(request, brand_id, self.brands_use_case.clone()).await
            }
            ("DELETE", path) if path.contains("/brands/") && path.contains("/assets/") => {
                let (brand_id, asset_id) = extract_two_path_params(path, "/brands/", "/assets/");
                brands::delete_brand_asset(
                    request,
                    brand_id,
                    asset_id,
                    self.brands_use_case.clone(),
                )
                .await
            }
            ("GET", "/campaigns") => {
                campaigns::list_campaigns(request, self.campaigns_use_case.clone()).await
            }
            ("POST", "/campaigns") => {
                campaigns::create_campaign(request, self.campaigns_use_case.clone()).await
            }
            ("GET", path) if path.starts_with("/campaigns/") && !path.contains("/posts") => {
                let campaign_id = extract_path_param(path, "/campaigns/");
                campaigns::get_campaign(request, campaign_id, self.campaigns_use_case.clone()).await
            }
            ("PUT", path) if path.starts_with("/campaigns/") && !path.contains("/posts") => {
                let campaign_id = extract_path_param(path, "/campaigns/");
                campaigns::update_campaign(request, campaign_id, self.campaigns_use_case.clone())
                    .await
            }
            ("DELETE", path) if path.starts_with("/campaigns/") && !path.contains("/posts") => {
                let campaign_id = extract_path_param(path, "/campaigns/");
                campaigns::delete_campaign(request, campaign_id, self.campaigns_use_case.clone())
                    .await
            }
            ("GET", path) if path.contains("/campaigns/") && path.ends_with("/posts") => {
                let campaign_id = extract_path_segment(path, "/campaigns/", "/posts");
                campaigns::list_campaign_posts(
                    request,
                    campaign_id,
                    self.campaigns_use_case.clone(),
                )
                .await
            }
            ("GET", "/assets") => assets::list_assets(request, self.assets_use_case.clone()).await,
            ("POST", "/assets") => {
                assets::create_asset(request, self.assets_use_case.clone()).await
            }
            ("GET", path) if path.starts_with("/assets/") => {
                let asset_id = extract_path_param(path, "/assets/");
                assets::get_asset(request, asset_id, self.assets_use_case.clone()).await
            }
            ("PUT", path) if path.starts_with("/assets/") => {
                let asset_id = extract_path_param(path, "/assets/");
                assets::update_asset(request, asset_id, self.assets_use_case.clone()).await
            }
            ("DELETE", path) if path.starts_with("/assets/") => {
                let asset_id = extract_path_param(path, "/assets/");
                assets::delete_asset(request, asset_id, self.assets_use_case.clone()).await
            }
            _ => Err(ApiError::not_found("Not found")),
        }
    }
}

fn extract_path_param<'a>(path: &'a str, prefix: &str) -> &'a str {
    path.strip_prefix(prefix).unwrap_or("")
}

fn extract_path_segment<'a>(path: &'a str, prefix: &str, suffix: &str) -> &'a str {
    path.strip_prefix(prefix)
        .and_then(|s| s.strip_suffix(suffix))
        .unwrap_or("")
}

fn extract_two_path_params<'a>(
    path: &'a str,
    first_prefix: &str,
    second_prefix: &str,
) -> (&'a str, &'a str) {
    let after_first = path.strip_prefix(first_prefix).unwrap_or("");
    if let Some(pos) = after_first.find(second_prefix) {
        let first_param = &after_first[..pos];
        let second_param = &after_first[pos + second_prefix.len()..];
        (first_param, second_param)
    } else {
        ("", "")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_path_param() {
        assert_eq!(extract_path_param("/personas/123", "/personas/"), "123");
        assert_eq!(extract_path_param("/brands/abc", "/brands/"), "abc");
        assert_eq!(extract_path_param("/invalid", "/personas/"), "");
    }

    #[test]
    fn test_extract_path_segment() {
        assert_eq!(
            extract_path_segment("/personas/123/examples", "/personas/", "/examples"),
            "123"
        );
        assert_eq!(
            extract_path_segment("/brands/abc/assets", "/brands/", "/assets"),
            "abc"
        );
        assert_eq!(
            extract_path_segment("/invalid", "/personas/", "/examples"),
            ""
        );
    }

    #[test]
    fn test_extract_two_path_params() {
        assert_eq!(
            extract_two_path_params("/personas/123/examples/456", "/personas/", "/examples/"),
            ("123", "456")
        );
        assert_eq!(
            extract_two_path_params("/brands/abc/assets/xyz", "/brands/", "/assets/"),
            ("abc", "xyz")
        );
        assert_eq!(
            extract_two_path_params("/invalid", "/personas/", "/examples/"),
            ("", "")
        );
    }
}
