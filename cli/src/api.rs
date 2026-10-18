use std::io::Read;

use serde_json::{json, Value};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ApiError {
    /// 401 or missing token — exit code 2 in the CLI.
    #[error("{0}")]
    Unauthorized(String),
    /// 403 with the server's message (e.g. "This API token is read-only").
    #[error("{0}")]
    Forbidden(String),
    #[error("HTTP {status}: {message}")]
    Http { status: u16, message: String },
    #[error("network error: {0}")]
    Network(String),
    #[error("invalid response: {0}")]
    BadResponse(String),
}

/// Thin REST client for the ticketing API. All responses use the
/// `{ success: true, data: … }` / `{ success: false, error: "…" }` envelope;
/// this client unwraps `data` and turns `error` into an ApiError.
pub struct Client {
    base: String,
    token: String,
}

impl Client {
    pub fn new(base: String, token: String) -> Self {
        Self { base, token }
    }

    pub fn has_token(&self) -> bool {
        !self.token.is_empty()
    }

    pub fn get(&self, path: &str) -> Result<Value, ApiError> {
        self.request("GET", path, None)
    }

    pub fn post(&self, path: &str, body: Option<&Value>) -> Result<Value, ApiError> {
        self.request("POST", path, body)
    }

    pub fn patch(&self, path: &str, body: Option<&Value>) -> Result<Value, ApiError> {
        self.request("PATCH", path, body)
    }

    pub fn delete(&self, path: &str) -> Result<Value, ApiError> {
        self.request("DELETE", path, None)
    }

    /// PUT raw bytes to a presigned upload URL (no auth header — the signature
    /// is in the URL). Returns Ok on 2xx.
    pub fn put_file(url: &str, bytes: &[u8], content_type: &str) -> Result<(), ApiError> {
        let result = ureq::put(url)
            .set("content-type", content_type)
            .send_bytes(bytes);
        match result {
            Ok(_) => Ok(()),
            Err(ureq::Error::Status(status, _)) => Err(ApiError::Http {
                status,
                message: "upload to storage failed".into(),
            }),
            Err(e) => Err(ApiError::Network(e.to_string())),
        }
    }

    fn request(&self, method: &str, path: &str, body: Option<&Value>) -> Result<Value, ApiError> {
        if self.token.is_empty() {
            return Err(ApiError::Unauthorized(
                "no token — run `maticket auth login -u <url> -t <token>`".into(),
            ));
        }
        let url = format!("{}{}", self.base, path);
        let mut req = ureq::request(method, &url).set("authorization", &format!("Bearer {}", self.token));
        if body.is_some() {
            req = req.set("content-type", "application/json");
        }
        let result = match body {
            Some(b) => req.send_json(b.clone()),
            None => req.call(),
        };

        match result {
            Ok(resp) => {
                let mut text = String::new();
                resp.into_reader()
                    .read_to_string(&mut text)
                    .map_err(|e| ApiError::BadResponse(e.to_string()))?;
                parse_envelope(&text)
            }
            Err(ureq::Error::Status(status, resp)) => {
                let mut text = String::new();
                let _ = resp.into_reader().read_to_string(&mut text);
                let message = serde_json::from_str::<Value>(&text)
                    .ok()
                    .and_then(|v| {
                        v.get("error")
                            .map(|e| match e {
                                Value::String(s) => s.clone(),
                                other => other.to_string(),
                            })
                    })
                    .unwrap_or_else(|| if text.trim().is_empty() { status_canonical(status).to_string() } else { text.chars().take(200).collect() });
                match status {
                    401 => Err(ApiError::Unauthorized(message)),
                    403 => Err(ApiError::Forbidden(message)),
                    _ => Err(ApiError::Http { status, message }),
                }
            }
            Err(e) => Err(ApiError::Network(e.to_string())),
        }
    }
}

fn status_canonical(s: u16) -> &'static str {
    match s {
        400 => "Bad request",
        401 => "Unauthorized",
        403 => "Forbidden",
        404 => "Not found",
        405 => "Method not allowed",
        429 => "Too many requests",
        _ => "Request failed",
    }
}

fn parse_envelope(text: &str) -> Result<Value, ApiError> {
    let v: Value = serde_json::from_str(text)
        .map_err(|e| ApiError::BadResponse(format!("{e}: {}", text.chars().take(200).collect::<String>())))?;
    if v.get("success").and_then(|s| s.as_bool()) == Some(true) {
        return Ok(v.get("data").cloned().unwrap_or(Value::Null));
    }
    let message = v
        .get("error")
        .map(|e| match e {
            Value::String(s) => s.clone(),
            other => other.to_string(),
        })
        .unwrap_or_else(|| "request failed".into());
    Err(ApiError::Http { status: 200, message })
}

/// Build a query string from present (key, Option<value>) pairs.
pub fn query(pairs: &[(&str, Option<String>)]) -> String {
    let parts: Vec<String> = pairs
        .iter()
        .filter_map(|(k, v)| v.as_ref().map(|v| format!("{}={}", k, urlencoding::encode(v))))
        .collect();
    if parts.is_empty() {
        String::new()
    } else {
        format!("?{}", parts.join("&"))
    }
}

/// Merge present (key, Option<Value>) pairs into a JSON object.
pub fn body(pairs: Vec<(&str, Option<Value>)>) -> Value {
    let mut obj = serde_json::Map::new();
    for (k, v) in pairs {
        if let Some(v) = v {
            obj.insert(k.into(), v);
        }
    }
    Value::Object(obj)
}

/// Parse a comma-separated id list into a JSON array (None if empty).
pub fn ids(csv: &Option<String>) -> Option<Value> {
    let list: Vec<String> = csv
        .as_deref()
        .map(|s| s.split(',').map(|x| x.trim()).filter(|x| !x.is_empty()).map(String::from).collect())
        .unwrap_or_default();
    if list.is_empty() {
        None
    } else {
        Some(json!(list))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn query_skips_absent() {
        assert_eq!(query(&[("a", None), ("b", Some("x y".into()))]), "?b=x%20y");
        assert_eq!(query(&[]), "");
    }

    #[test]
    fn body_skips_absent() {
        let b = body(vec![("a", None), ("b", Some(json!(1)))]);
        assert_eq!(b, json!({"b": 1}));
    }

    #[test]
    fn ids_splits_and_trims() {
        assert_eq!(ids(&Some("a, b ,c".into())), Some(json!(["a", "b", "c"])));
        assert_eq!(ids(&Some("".into())), None);
        assert_eq!(ids(&None), None);
    }

    #[test]
    fn envelope_unwraps_data() {
        assert_eq!(parse_envelope(r#"{"success":true,"data":{"id":"x"}}"#).unwrap(), json!({"id":"x"}));
        assert_eq!(parse_envelope(r#"{"success":true}"#).unwrap(), Value::Null);
    }

    #[test]
    fn envelope_surfaces_error_message() {
        let e = parse_envelope(r#"{"success":false,"error":"nope"}"#).unwrap_err();
        assert!(matches!(e, ApiError::Http { status: 200, message } if message == "nope"));
    }
}
