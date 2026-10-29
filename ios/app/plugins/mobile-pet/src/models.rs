use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayResponse {
  pub status: String,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub snapshot: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyReminderSettings {
  pub enabled: bool,
  pub message: String,
  pub hour: i32,
  pub minute: i32,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyReminderState {
  pub enabled: bool,
  pub message: String,
  pub hour: i32,
  pub minute: i32,
  pub last_shown_date: String,
  pub answer_date: String,
  pub answer: String,
  pub notification_permission: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyAnswerArgs {
  pub answer: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoReminderSyncArgs {
  pub payload: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusReminderArgs {
  pub delay_ms: i64,
  #[serde(default)]
  pub deadline_ms: Option<i64>,
  pub message: String,
  pub lead_minutes: i32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedChatArgs {
  pub message_id: String,
  pub message: String,
  pub entry_point: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedRetractArgs {
  pub message_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedImportLegacyArgs {
  pub history_json: String,
  pub memory_json: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedManualMemoryArgs {
  pub memory_json: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedChatReply {
  pub reply: String,
  pub assistant_message_id: String,
  pub act: String,
  pub trace: serde_json::Value,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedRetractResponse {
  pub status: String,
  pub removed: i32,
  pub updated: i32,
}

pub type UnifiedMemoryState = serde_json::Value;
