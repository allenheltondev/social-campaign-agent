use crate::domain::responses::ApiResponse;
use aws_lambda_events::apigw::ApiGatewayProxyResponse;
use serde_json::json;

#[derive(Debug)]
pub enum ApiError {
    BadRequest(String),
    Unauthorized(String),
    NotFound(String),
    Conflict(String),
    #[allow(dead_code)]
    Internal(String),
}

impl ApiError {
    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self::BadRequest(msg.into())
    }

    pub fn unauthorized(msg: impl Into<String>) -> Self {
        Self::Unauthorized(msg.into())
    }

    pub fn not_found(msg: impl Into<String>) -> Self {
        Self::NotFound(msg.into())
    }

    pub fn conflict(msg: impl Into<String>) -> Self {
        Self::Conflict(msg.into())
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(msg.into())
    }

    pub fn status_code(&self) -> u16 {
        match self {
            Self::BadRequest(_) => 400,
            Self::Unauthorized(_) => 401,
            Self::NotFound(_) => 404,
            Self::Conflict(_) => 409,
            Self::Internal(_) => 500,
        }
    }

    pub fn message(&self) -> &str {
        match self {
            Self::BadRequest(msg) => msg,
            Self::Unauthorized(msg) => msg,
            Self::NotFound(msg) => msg,
            Self::Conflict(msg) => msg,
            Self::Internal(_) => "Something went wrong",
        }
    }

    pub fn to_response(&self) -> ApiResponse {
        ApiResponse::json(self.status_code(), json!({ "message": self.message() }))
    }

    pub fn to_lambda_response(&self) -> ApiGatewayProxyResponse {
        self.to_response().to_lambda_response()
    }
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message())
    }
}

impl std::error::Error for ApiError {}
