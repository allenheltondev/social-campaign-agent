use crate::domain::errors::ApiError;
use crate::outbound::ports::services::{Event, EventPublisher};
use async_trait::async_trait;
use aws_sdk_eventbridge::types::PutEventsRequestEntry;

pub struct EventBridgePublisher {
    client: aws_sdk_eventbridge::Client,
    event_bus_name: String,
}

impl EventBridgePublisher {
    pub fn new(client: aws_sdk_eventbridge::Client, event_bus_name: String) -> Self {
        Self {
            client,
            event_bus_name,
        }
    }
}

#[async_trait]
impl EventPublisher for EventBridgePublisher {
    async fn publish(&self, event: Event) -> Result<(), ApiError> {
        let entry = PutEventsRequestEntry::builder()
            .source(event.source)
            .detail_type(event.detail_type)
            .detail(event.detail.to_string())
            .event_bus_name(&self.event_bus_name)
            .build();

        self.client
            .put_events()
            .entries(entry)
            .send()
            .await
            .map_err(|e| {
                eprintln!("EventBridge publish failed: {}", e);
                ApiError::internal("Event publishing failed")
            })?;

        Ok(())
    }
}
