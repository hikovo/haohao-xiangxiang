use serde::de::DeserializeOwned;
use tauri::{
  plugin::{PluginApi, PluginHandle},
  AppHandle, Runtime,
};

use crate::models::*;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_mobile_pet);

// initializes the Kotlin or Swift plugin classes
pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> crate::Result<MobilePet<R>> {
  #[cfg(target_os = "android")]
  let handle = api.register_android_plugin("com.hikovo.mobilepet", "MobilePetPlugin")?;
  #[cfg(target_os = "ios")]
  let handle = api.register_ios_plugin(init_plugin_mobile_pet)?;
  Ok(MobilePet(handle))
}

/// Access to the mobile-pet APIs.
pub struct MobilePet<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> MobilePet<R> {
  pub fn local_model(&self, payload: String) -> crate::Result<OverlayResponse> { self.0.run_mobile_plugin("localModel",serde_json::json!({"payload":payload})).map_err(Into::into) }
  pub fn speak_weather(&self, payload: String) -> crate::Result<OverlayResponse> { self.0.run_mobile_plugin("speakWeather",serde_json::json!({"payload":payload})).map_err(Into::into) }
  pub fn timetable_store(&self, payload: String) -> crate::Result<OverlayResponse> { self.0.run_mobile_plugin("timetableStore", serde_json::json!({"payload":payload})).map_err(Into::into) }
  pub fn timetable_scan(&self, payload: String) -> crate::Result<OverlayResponse> { self.0.run_mobile_plugin("timetableScan", serde_json::json!({"payload":payload})).map_err(Into::into) }
  pub fn health_store(&self, payload: String) -> crate::Result<OverlayResponse> {
    self.0.run_mobile_plugin("healthStore", serde_json::json!({ "payload": payload })).map_err(Into::into)
  }
  pub fn ledger_store(&self, payload: String) -> crate::Result<OverlayResponse> {
    self.0.run_mobile_plugin("ledgerStore", serde_json::json!({ "payload": payload })).map_err(Into::into)
  }
  pub fn sync_widgets(&self, payload: String) -> crate::Result<OverlayResponse> {
    self.0.run_mobile_plugin("syncWidgets", serde_json::json!({"payload": payload})).map_err(Into::into)
  }
  pub fn copy_text(&self, text: String) -> crate::Result<OverlayResponse> {
    self.0.run_mobile_plugin("copyText", serde_json::json!({"text": text})).map_err(Into::into)
  }
  pub fn open_external(&self, url: String) -> crate::Result<OverlayResponse> {
    self.0.run_mobile_plugin("openExternal", serde_json::json!({"url": url})).map_err(Into::into)
  }
  pub fn haptic_tap(&self) -> crate::Result<OverlayResponse> {
    self.0.run_mobile_plugin("hapticTap", ()).map_err(Into::into)
  }
  pub fn start_overlay(&self, payload: Option<String>) -> crate::Result<OverlayResponse> {
    self
      .0
      .run_mobile_plugin("startOverlay", serde_json::json!({"payload":payload.unwrap_or_default()}))
      .map_err(Into::into)
  }

  pub fn stop_overlay(&self) -> crate::Result<OverlayResponse> {
    self
      .0
      .run_mobile_plugin("stopOverlay", ())
      .map_err(Into::into)
  }

  pub fn overlay_status(&self, payload: Option<String>) -> crate::Result<OverlayResponse> {
    self
      .0
      .run_mobile_plugin("overlayStatus", serde_json::json!({"payload":payload.unwrap_or_default()}))
      .map_err(Into::into)
  }

  pub fn daily_reminder_state(&self) -> crate::Result<DailyReminderState> {
    self.0.run_mobile_plugin("dailyReminderState", ()).map_err(Into::into)
  }

  pub fn save_daily_reminder(&self, settings: DailyReminderSettings) -> crate::Result<DailyReminderState> {
    self.0.run_mobile_plugin("saveDailyReminder", settings).map_err(Into::into)
  }

  pub fn mark_daily_prompt_shown(&self) -> crate::Result<DailyReminderState> {
    self.0.run_mobile_plugin("markDailyPromptShown", ()).map_err(Into::into)
  }

  pub fn answer_daily_reminder(&self, answer: DailyAnswerArgs) -> crate::Result<DailyReminderState> {
    self.0.run_mobile_plugin("answerDailyReminder", answer).map_err(Into::into)
  }

  pub fn sync_memo_reminders(&self, args: MemoReminderSyncArgs) -> crate::Result<OverlayResponse> {
    self.0.run_mobile_plugin("syncMemoReminders", args).map_err(Into::into)
  }

  pub fn reminder_style(&self, args: MemoReminderSyncArgs) -> crate::Result<OverlayResponse> {
    self.0.run_mobile_plugin("reminderStyle", args).map_err(Into::into)
  }

  pub fn schedule_focus_reminder(&self, args: FocusReminderArgs) -> crate::Result<OverlayResponse> {
    self.0.run_mobile_plugin("scheduleFocusReminder", args).map_err(Into::into)
  }

  pub fn cancel_focus_reminder(&self) -> crate::Result<OverlayResponse> {
    self.0.run_mobile_plugin("cancelFocusReminder", ()).map_err(Into::into)
  }

  pub fn unified_chat(&self, args: UnifiedChatArgs) -> crate::Result<UnifiedChatReply> {
    self.0.run_mobile_plugin("unifiedChat", args).map_err(Into::into)
  }

  pub fn unified_retract_messages(&self, args: UnifiedRetractArgs) -> crate::Result<UnifiedRetractResponse> {
    self.0.run_mobile_plugin("unifiedRetractMessages", args).map_err(Into::into)
  }

  pub fn unified_clear_conversation(&self) -> crate::Result<OverlayResponse> {
    self.0.run_mobile_plugin("unifiedClearConversation", ()).map_err(Into::into)
  }

  pub fn unified_memory_state(&self) -> crate::Result<UnifiedMemoryState> {
    self.0.run_mobile_plugin("unifiedMemoryState", ()).map_err(Into::into)
  }

  pub fn unified_set_manual_memory(&self, args: UnifiedManualMemoryArgs) -> crate::Result<OverlayResponse> {
    self.0.run_mobile_plugin("unifiedSetManualMemory", args).map_err(Into::into)
  }

  pub fn unified_import_legacy(&self, args: UnifiedImportLegacyArgs) -> crate::Result<OverlayResponse> {
    self.0.run_mobile_plugin("unifiedImportLegacy", args).map_err(Into::into)
  }
}
