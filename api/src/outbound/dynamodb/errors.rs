#![allow(dead_code)]

use crate::domain::errors::ApiError;
use aws_sdk_dynamodb::error::SdkError;
use aws_sdk_dynamodb::operation::delete_item::DeleteItemError;
use aws_sdk_dynamodb::operation::get_item::GetItemError;
use aws_sdk_dynamodb::operation::put_item::PutItemError;
use aws_sdk_dynamodb::operation::query::QueryError;
use aws_sdk_dynamodb::operation::update_item::UpdateItemError;

pub fn map_dynamo_err<E: std::fmt::Display>(e: E) -> ApiError {
    let msg = e.to_string();
    if msg.contains("ConditionalCheckFailedException") {
        ApiError::conflict("Resource already exists")
    } else {
        eprintln!("DynamoDB error: {}", msg);
        ApiError::internal("DynamoDB operation failed")
    }
}

pub fn map_put_item_err(e: SdkError<PutItemError>) -> ApiError {
    map_dynamo_err(e)
}

pub fn map_get_item_err(e: SdkError<GetItemError>) -> ApiError {
    map_dynamo_err(e)
}

pub fn map_query_err(e: SdkError<QueryError>) -> ApiError {
    map_dynamo_err(e)
}

#[allow(dead_code)]
pub fn map_update_item_err(e: SdkError<UpdateItemError>) -> ApiError {
    map_dynamo_err(e)
}

pub fn map_delete_item_err(e: SdkError<DeleteItemError>) -> ApiError {
    map_dynamo_err(e)
}
