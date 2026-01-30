use aws_lambda_events::apigw::ApiGatewayProxyResponse;
use aws_lambda_events::encodings::Body;
use http::HeaderMap;
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct ApiResponse {
    pub status_code: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
}

impl ApiResponse {
    pub fn json(status_code: u16, body: Value) -> Self {
        let mut headers = HashMap::new();
        headers.insert("Content-Type".to_string(), "application/json".to_string());

        Self {
            status_code,
            headers,
            body: body.to_string(),
        }
    }

    pub fn to_lambda_response(self) -> ApiGatewayProxyResponse {
        let mut header_map = HeaderMap::new();
        for (key, value) in self.headers {
            if let (Ok(name), Ok(val)) = (
                http::header::HeaderName::from_bytes(key.as_bytes()),
                http::header::HeaderValue::from_str(&value),
            ) {
                header_map.insert(name, val);
            }
        }

        ApiGatewayProxyResponse {
            status_code: self.status_code as i64,
            headers: header_map.clone(),
            multi_value_headers: HeaderMap::new(),
            body: Some(Body::Text(self.body)),
            is_base64_encoded: false,
        }
    }
}
