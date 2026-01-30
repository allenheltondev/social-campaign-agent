use aws_lambda_events::apigw::{ApiGatewayProxyRequest, ApiGatewayProxyResponse};
use lambda_runtime::{service_fn, Error, LambdaEvent};
use std::sync::Arc;

mod auth;
mod db;
mod models;
mod router;

mod application;
mod domain;
mod inbound;
mod outbound;

use application::assets::AssetsUseCaseImpl;
use application::brands::BrandsUseCaseImpl;
use application::campaigns::CampaignsUseCaseImpl;
use application::personas::PersonasUseCaseImpl;
use inbound::ports::assets::AssetsUseCase;
use inbound::ports::brands::BrandsUseCase;
use inbound::ports::campaigns::CampaignsUseCase;
use inbound::ports::personas::PersonasUseCase;
use outbound::dynamodb::repositories::{
    DynamoAssetRepository, DynamoBrandRepository, DynamoCampaignRepository,
    DynamoPersonaRepository, DynamoWritingExampleRepository,
};
use outbound::eventbridge::publisher::EventBridgePublisher;
use outbound::s3::storage::S3ObjectStorage;
use router::Router;

#[derive(Clone)]
struct AppState {
    personas_use_case: Arc<dyn PersonasUseCase>,
    brands_use_case: Arc<dyn BrandsUseCase>,
    campaigns_use_case: Arc<dyn CampaignsUseCase>,
    assets_use_case: Arc<dyn AssetsUseCase>,
}

impl AppState {
    async fn new() -> Self {
        let config = aws_config::load_from_env().await;

        let dynamo = aws_sdk_dynamodb::Client::new(&config);
        let s3 = aws_sdk_s3::Client::new(&config);
        let eb = aws_sdk_eventbridge::Client::new(&config);

        let table_name = std::env::var("TABLE_NAME").expect("TABLE_NAME required");
        let brand_assets_bucket =
            std::env::var("BRAND_ASSETS_BUCKET").expect("BRAND_ASSETS_BUCKET required");
        let assets_bucket = std::env::var("ASSETS_BUCKET").expect("ASSETS_BUCKET required");
        let event_bus_name = std::env::var("EVENT_BUS_NAME").expect("EVENT_BUS_NAME required");

        let persona_repo = Arc::new(DynamoPersonaRepository::new(
            dynamo.clone(),
            table_name.clone(),
        ));
        let example_repo = Arc::new(DynamoWritingExampleRepository::new(
            dynamo.clone(),
            table_name.clone(),
        ));
        let brand_repo = Arc::new(DynamoBrandRepository::new(
            dynamo.clone(),
            table_name.clone(),
        ));
        let campaign_repo = Arc::new(DynamoCampaignRepository::new(
            dynamo.clone(),
            table_name.clone(),
        ));
        let asset_repo = Arc::new(DynamoAssetRepository::new(dynamo.clone(), table_name));

        let object_storage = Arc::new(S3ObjectStorage::new(
            s3.clone(),
            brand_assets_bucket,
            assets_bucket,
        ));
        let events = Arc::new(EventBridgePublisher::new(eb.clone(), event_bus_name));

        let personas_use_case = Arc::new(PersonasUseCaseImpl::new(
            persona_repo,
            example_repo,
            events.clone(),
        ));
        let brands_use_case = Arc::new(BrandsUseCaseImpl::new(brand_repo, object_storage.clone()));
        let campaigns_use_case = Arc::new(CampaignsUseCaseImpl::new(
            campaign_repo,
            Arc::new(FakeCampaignPostRepository),
            events.clone(),
        ));
        let assets_use_case = Arc::new(AssetsUseCaseImpl::new(asset_repo, object_storage));

        Self {
            personas_use_case,
            brands_use_case,
            campaigns_use_case,
            assets_use_case,
        }
    }
}

struct FakeCampaignPostRepository;

#[async_trait::async_trait]
impl outbound::ports::repositories::CampaignPostRepository for FakeCampaignPostRepository {
    async fn list_by_campaign(
        &self,
        _tenant_id: &str,
        _campaign_id: &str,
    ) -> Result<Vec<inbound::ports::campaigns::CampaignPost>, domain::errors::ApiError> {
        Ok(vec![])
    }

    async fn get(
        &self,
        _tenant_id: &str,
        _campaign_id: &str,
        _post_id: &str,
    ) -> Result<inbound::ports::campaigns::CampaignPost, domain::errors::ApiError> {
        Err(domain::errors::ApiError::not_found("Not implemented"))
    }

    async fn update_status(
        &self,
        _tenant_id: &str,
        _campaign_id: &str,
        _post_id: &str,
        _status: String,
        _updates: Option<serde_json::Value>,
    ) -> Result<(), domain::errors::ApiError> {
        Ok(())
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .init();

    let state = AppState::new().await;
    let router = Router::new(
        state.personas_use_case.clone(),
        state.brands_use_case.clone(),
        state.campaigns_use_case.clone(),
        state.assets_use_case.clone(),
    );

    lambda_runtime::run(service_fn(
        move |event: LambdaEvent<ApiGatewayProxyRequest>| {
            let router = router.clone();
            async move { handler(event, router).await }
        },
    ))
    .await
}

async fn handler(
    event: LambdaEvent<ApiGatewayProxyRequest>,
    router: Router,
) -> Result<ApiGatewayProxyResponse, Error> {
    let request = event.payload;

    tracing::info!(
        method = %request.http_method,
        path = ?request.path,
        authorizer_fields = ?request.request_context.authorizer.fields,
        "Handling request"
    );

    match router.route(&request).await {
        Ok(response) => Ok(response),
        Err(e) => {
            tracing::error!(error = ?e, "Router error");
            Ok(domain::errors::ApiError::internal("Internal server error").to_lambda_response())
        }
    }
}
