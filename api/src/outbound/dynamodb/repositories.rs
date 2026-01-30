use crate::domain::entities::{Asset, Brand, Campaign, Persona, WritingExample};
use crate::domain::errors::ApiError;
use crate::outbound::dynamodb::errors::{
    map_delete_item_err, map_get_item_err, map_put_item_err, map_query_err,
};
use crate::outbound::dynamodb::serialization::{
    deserialize_asset, deserialize_brand, deserialize_campaign, deserialize_persona,
    deserialize_writing_example, serialize_asset, serialize_brand, serialize_campaign,
    serialize_persona, serialize_writing_example,
};
use crate::outbound::ports::repositories::{
    AssetRepository, BrandRepository, CampaignRepository, PersonaRepository,
    WritingExampleRepository,
};
use async_trait::async_trait;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client as DynamoDbClient;

pub struct DynamoPersonaRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl DynamoPersonaRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }
}

#[async_trait]
impl PersonaRepository for DynamoPersonaRepository {
    async fn list_by_tenant(&self, tenant_id: &str) -> Result<Vec<Persona>, ApiError> {
        let result = self
            .client
            .query()
            .table_name(&self.table_name)
            .index_name("GSI1")
            .key_condition_expression("GSI1PK = :pk AND begins_with(GSI1SK, :sk)")
            .expression_attribute_values(":pk", AttributeValue::S(tenant_id.to_string()))
            .expression_attribute_values(":sk", AttributeValue::S("PERSONA#".to_string()))
            .send()
            .await
            .map_err(map_query_err)?;

        result
            .items()
            .iter()
            .map(deserialize_persona)
            .collect()
    }

    async fn get(&self, tenant_id: &str, persona_id: &str) -> Result<Persona, ApiError> {
        let result = self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key(
                "pk",
                AttributeValue::S(format!("{}#{}", tenant_id, persona_id)),
            )
            .key("sk", AttributeValue::S("metadata".to_string()))
            .send()
            .await
            .map_err(map_get_item_err)?;

        result
            .item()
            .ok_or_else(|| ApiError::not_found("Persona not found"))
            .and_then(deserialize_persona)
    }

    async fn create(&self, persona: Persona) -> Result<(), ApiError> {
        let item = serialize_persona(&persona)?;

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .condition_expression("attribute_not_exists(pk) AND attribute_not_exists(sk)")
            .send()
            .await
            .map_err(map_put_item_err)?;

        Ok(())
    }

    async fn update(&self, persona: Persona) -> Result<(), ApiError> {
        let item = serialize_persona(&persona)?;

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await
            .map_err(map_put_item_err)?;

        Ok(())
    }

    async fn delete(&self, tenant_id: &str, persona_id: &str) -> Result<(), ApiError> {
        self.client
            .delete_item()
            .table_name(&self.table_name)
            .key(
                "pk",
                AttributeValue::S(format!("{}#{}", tenant_id, persona_id)),
            )
            .key("sk", AttributeValue::S("metadata".to_string()))
            .send()
            .await
            .map_err(map_delete_item_err)?;

        Ok(())
    }
}

pub struct DynamoBrandRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl DynamoBrandRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }
}

#[async_trait]
impl BrandRepository for DynamoBrandRepository {
    async fn list_by_tenant(&self, tenant_id: &str) -> Result<Vec<Brand>, ApiError> {
        tracing::info!(tenant_id = %tenant_id, "DynamoBrandRepository: Querying GSI1");

        let result = self
            .client
            .query()
            .table_name(&self.table_name)
            .index_name("GSI1")
            .key_condition_expression("GSI1PK = :pk AND begins_with(GSI1SK, :sk)")
            .expression_attribute_values(":pk", AttributeValue::S(tenant_id.to_string()))
            .expression_attribute_values(":sk", AttributeValue::S("BRAND#".to_string()))
            .send()
            .await
            .map_err(map_query_err)?;

        tracing::info!(
            item_count = result.items().len(),
            "DynamoBrandRepository: Query returned items"
        );

        let brands: Result<Vec<Brand>, ApiError> = result
            .items()
            .iter()
            .map(|item| {
                tracing::debug!(item = ?item, "DynamoBrandRepository: Deserializing brand");
                deserialize_brand(item)
            })
            .collect();

        match &brands {
            Ok(b) => tracing::info!(
                brand_count = b.len(),
                "DynamoBrandRepository: Successfully deserialized brands"
            ),
            Err(e) => tracing::error!(error = ?e, "DynamoBrandRepository: Deserialization error"),
        }

        brands
    }

    async fn get(&self, tenant_id: &str, brand_id: &str) -> Result<Brand, ApiError> {
        let result = self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key(
                "pk",
                AttributeValue::S(format!("{}#{}", tenant_id, brand_id)),
            )
            .key("sk", AttributeValue::S("metadata".to_string()))
            .send()
            .await
            .map_err(map_get_item_err)?;

        result
            .item()
            .ok_or_else(|| ApiError::not_found("Brand not found"))
            .and_then(deserialize_brand)
    }

    async fn create(&self, brand: Brand) -> Result<(), ApiError> {
        let item = serialize_brand(&brand)?;

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .condition_expression("attribute_not_exists(pk) AND attribute_not_exists(sk)")
            .send()
            .await
            .map_err(map_put_item_err)?;

        Ok(())
    }

    async fn update(&self, brand: Brand) -> Result<(), ApiError> {
        let item = serialize_brand(&brand)?;

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await
            .map_err(map_put_item_err)?;

        Ok(())
    }

    async fn delete(&self, tenant_id: &str, brand_id: &str) -> Result<(), ApiError> {
        self.client
            .delete_item()
            .table_name(&self.table_name)
            .key(
                "pk",
                AttributeValue::S(format!("{}#{}", tenant_id, brand_id)),
            )
            .key("sk", AttributeValue::S("metadata".to_string()))
            .send()
            .await
            .map_err(map_delete_item_err)?;

        Ok(())
    }
}

pub struct DynamoCampaignRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl DynamoCampaignRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }
}

#[async_trait]
impl CampaignRepository for DynamoCampaignRepository {
    async fn list_by_tenant(&self, tenant_id: &str) -> Result<Vec<Campaign>, ApiError> {
        let result = self
            .client
            .query()
            .table_name(&self.table_name)
            .index_name("GSI1")
            .key_condition_expression("GSI1PK = :pk AND begins_with(GSI1SK, :sk)")
            .expression_attribute_values(":pk", AttributeValue::S(tenant_id.to_string()))
            .expression_attribute_values(":sk", AttributeValue::S("CAMPAIGN#".to_string()))
            .send()
            .await
            .map_err(map_query_err)?;

        result
            .items()
            .iter()
            .map(deserialize_campaign)
            .collect()
    }

    async fn get(&self, tenant_id: &str, campaign_id: &str) -> Result<Campaign, ApiError> {
        let result = self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key(
                "pk",
                AttributeValue::S(format!("{}#{}", tenant_id, campaign_id)),
            )
            .key("sk", AttributeValue::S("metadata".to_string()))
            .send()
            .await
            .map_err(map_get_item_err)?;

        result
            .item()
            .ok_or_else(|| ApiError::not_found("Campaign not found"))
            .and_then(deserialize_campaign)
    }

    async fn create(&self, campaign: Campaign) -> Result<(), ApiError> {
        let item = serialize_campaign(&campaign)?;

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .condition_expression("attribute_not_exists(pk) AND attribute_not_exists(sk)")
            .send()
            .await
            .map_err(map_put_item_err)?;

        Ok(())
    }

    async fn update(&self, campaign: Campaign) -> Result<(), ApiError> {
        let item = serialize_campaign(&campaign)?;

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await
            .map_err(map_put_item_err)?;

        Ok(())
    }

    async fn delete(&self, tenant_id: &str, campaign_id: &str) -> Result<(), ApiError> {
        self.client
            .delete_item()
            .table_name(&self.table_name)
            .key(
                "pk",
                AttributeValue::S(format!("{}#{}", tenant_id, campaign_id)),
            )
            .key("sk", AttributeValue::S("metadata".to_string()))
            .send()
            .await
            .map_err(map_delete_item_err)?;

        Ok(())
    }
}

pub struct DynamoAssetRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl DynamoAssetRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }
}

#[async_trait]
impl AssetRepository for DynamoAssetRepository {
    async fn list_by_tenant(&self, tenant_id: &str) -> Result<Vec<Asset>, ApiError> {
        let result = self
            .client
            .query()
            .table_name(&self.table_name)
            .index_name("GSI1")
            .key_condition_expression("GSI1PK = :pk AND begins_with(GSI1SK, :sk)")
            .expression_attribute_values(":pk", AttributeValue::S(tenant_id.to_string()))
            .expression_attribute_values(":sk", AttributeValue::S("ASSET#".to_string()))
            .send()
            .await
            .map_err(map_query_err)?;

        result
            .items()
            .iter()
            .map(deserialize_asset)
            .collect()
    }

    async fn get(&self, tenant_id: &str, asset_id: &str) -> Result<Asset, ApiError> {
        let result = self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key(
                "pk",
                AttributeValue::S(format!("{}#{}", tenant_id, asset_id)),
            )
            .key("sk", AttributeValue::S("metadata".to_string()))
            .send()
            .await
            .map_err(map_get_item_err)?;

        result
            .item()
            .ok_or_else(|| ApiError::not_found("Asset not found"))
            .and_then(deserialize_asset)
    }

    async fn create(&self, asset: Asset) -> Result<(), ApiError> {
        let item = serialize_asset(&asset)?;

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .condition_expression("attribute_not_exists(pk) AND attribute_not_exists(sk)")
            .send()
            .await
            .map_err(map_put_item_err)?;

        Ok(())
    }

    async fn update(&self, asset: Asset) -> Result<(), ApiError> {
        let item = serialize_asset(&asset)?;

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await
            .map_err(map_put_item_err)?;

        Ok(())
    }

    async fn delete(&self, tenant_id: &str, asset_id: &str) -> Result<(), ApiError> {
        self.client
            .delete_item()
            .table_name(&self.table_name)
            .key(
                "pk",
                AttributeValue::S(format!("{}#{}", tenant_id, asset_id)),
            )
            .key("sk", AttributeValue::S("metadata".to_string()))
            .send()
            .await
            .map_err(map_delete_item_err)?;

        Ok(())
    }
}

pub struct DynamoWritingExampleRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl DynamoWritingExampleRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }
}

#[async_trait]
impl WritingExampleRepository for DynamoWritingExampleRepository {
    async fn list_by_persona(
        &self,
        tenant_id: &str,
        persona_id: &str,
    ) -> Result<Vec<WritingExample>, ApiError> {
        let result = self
            .client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("pk = :pk AND begins_with(sk, :sk)")
            .expression_attribute_values(
                ":pk",
                AttributeValue::S(format!("{}#{}", tenant_id, persona_id)),
            )
            .expression_attribute_values(":sk", AttributeValue::S("EXAMPLE#".to_string()))
            .send()
            .await
            .map_err(map_query_err)?;

        result
            .items()
            .iter()
            .map(deserialize_writing_example)
            .collect()
    }

    async fn get(
        &self,
        tenant_id: &str,
        persona_id: &str,
        example_id: &str,
    ) -> Result<WritingExample, ApiError> {
        let result = self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key(
                "pk",
                AttributeValue::S(format!("{}#{}", tenant_id, persona_id)),
            )
            .key("sk", AttributeValue::S(format!("EXAMPLE#{}", example_id)))
            .send()
            .await
            .map_err(map_get_item_err)?;

        result
            .item()
            .ok_or_else(|| ApiError::not_found("Writing example not found"))
            .and_then(deserialize_writing_example)
    }

    async fn create(&self, example: WritingExample) -> Result<(), ApiError> {
        let item = serialize_writing_example(&example)?;

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .condition_expression("attribute_not_exists(pk) AND attribute_not_exists(sk)")
            .send()
            .await
            .map_err(map_put_item_err)?;

        Ok(())
    }

    async fn delete(
        &self,
        tenant_id: &str,
        persona_id: &str,
        example_id: &str,
    ) -> Result<(), ApiError> {
        self.client
            .delete_item()
            .table_name(&self.table_name)
            .key(
                "pk",
                AttributeValue::S(format!("{}#{}", tenant_id, persona_id)),
            )
            .key("sk", AttributeValue::S(format!("EXAMPLE#{}", example_id)))
            .send()
            .await
            .map_err(map_delete_item_err)?;

        Ok(())
    }
}
