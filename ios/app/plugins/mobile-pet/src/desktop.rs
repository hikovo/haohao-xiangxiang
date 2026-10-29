use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
  app: &AppHandle<R>,
  _api: PluginApi<R, C>,
) -> crate::Result<MobilePet<R>> {
  Ok(MobilePet(app.clone()))
}

/// Access to the mobile-pet APIs.
pub struct MobilePet<R: Runtime>(AppHandle<R>);

impl<R: Runtime> MobilePet<R> {
  pub fn local_model(&self, _payload: String) -> crate::Result<OverlayResponse> { Ok(OverlayResponse { status:"unavailable".into(),..Default::default() }) }
  pub fn speak_weather(&self, _payload: String) -> crate::Result<OverlayResponse> { Ok(OverlayResponse { status:"unsupported".into(),..Default::default() }) }
  pub fn timetable_store(&self, _payload: String) -> crate::Result<OverlayResponse> { Err(std::io::Error::new(std::io::ErrorKind::Unsupported,"课表存储需要 iOS").into()) }
  pub fn timetable_scan(&self, _payload: String) -> crate::Result<OverlayResponse> { Err(std::io::Error::new(std::io::ErrorKind::Unsupported,"截图识别需要 iOS").into()) }
  pub fn health_store(&self, _payload: String) -> crate::Result<OverlayResponse> {
    Err(std::io::Error::new(std::io::ErrorKind::Unsupported, "Native health storage requires iOS").into())
  }
  pub fn ledger_store(&self, _payload: String) -> crate::Result<OverlayResponse> {
    Err(std::io::Error::new(std::io::ErrorKind::Unsupported, "Native ledger storage requires iOS").into())
  }
  pub fn sync_widgets(&self, _payload: String) -> crate::Result<OverlayResponse> {
    Ok(OverlayResponse { status: "unsupported".into(), ..Default::default() })
  }
  pub fn copy_text(&self, _text: String) -> crate::Result<OverlayResponse> {
    Ok(OverlayResponse { status: "unsupported".into(), snapshot: None })
  }
  pub fn open_external(&self, _url: String) -> crate::Result<OverlayResponse> {
    Ok(OverlayResponse { status: "unsupported".into(), ..Default::default() })
  }
  pub fn haptic_tap(&self) -> crate::Result<OverlayResponse> {
    Ok(OverlayResponse { status: "unsupported".into(), ..Default::default() })
  }
  pub fn start_overlay(&self, _payload: Option<String>) -> crate::Result<OverlayResponse> {
    Ok(OverlayResponse { status: "unsupported".into(), ..Default::default() })
  }

  pub fn stop_overlay(&self) -> crate::Result<OverlayResponse> {
    Ok(OverlayResponse { status: "unsupported".into(), ..Default::default() })
  }

  pub fn overlay_status(&self, _payload: Option<String>) -> crate::Result<OverlayResponse> {
    Ok(OverlayResponse { status: "unsupported".into(), ..Default::default() })
  }

  pub fn daily_reminder_state(&self) -> crate::Result<DailyReminderState> {
    Ok(DailyReminderState::default())
  }

  pub fn save_daily_reminder(&self, settings: DailyReminderSettings) -> crate::Result<DailyReminderState> {
    Ok(DailyReminderState {
      enabled: settings.enabled,
      message: settings.message,
      hour: settings.hour,
      minute: settings.minute,
      notification_permission: "unsupported".into(),
      ..Default::default()
    })
  }

  pub fn mark_daily_prompt_shown(&self) -> crate::Result<DailyReminderState> {
    Ok(DailyReminderState::default())
  }

  pub fn answer_daily_reminder(&self, _answer: DailyAnswerArgs) -> crate::Result<DailyReminderState> {
    Ok(DailyReminderState::default())
  }

  pub fn sync_memo_reminders(&self, _args: MemoReminderSyncArgs) -> crate::Result<OverlayResponse> {
    Ok(OverlayResponse { status: "unsupported".into(), ..Default::default() })
  }

  pub fn reminder_style(&self, _args: MemoReminderSyncArgs) -> crate::Result<OverlayResponse> {
    Ok(OverlayResponse { status: "unsupported".into(), ..Default::default() })
  }

  pub fn schedule_focus_reminder(&self, _args: FocusReminderArgs) -> crate::Result<OverlayResponse> {
    Ok(OverlayResponse { status: "unsupported".into(), ..Default::default() })
  }

  pub fn cancel_focus_reminder(&self) -> crate::Result<OverlayResponse> {
    Ok(OverlayResponse { status: "unsupported".into(), ..Default::default() })
  }

  pub fn unified_chat(&self, args: UnifiedChatArgs) -> crate::Result<UnifiedChatReply> {
    Ok(UnifiedChatReply {
      reply: "桌面预览不承载 Android 统一聊天 Runtime。".into(),
      assistant_message_id: format!("{}-assistant", args.message_id),
      act: "unsupported".into(),
      trace: serde_json::json!({ "runtime": "desktop-unsupported", "entryPoint": args.entry_point }),
    })
  }

  pub fn unified_retract_messages(&self, _args: UnifiedRetractArgs) -> crate::Result<UnifiedRetractResponse> {
    Ok(UnifiedRetractResponse { status: "unsupported".into(), ..Default::default() })
  }

  pub fn unified_clear_conversation(&self) -> crate::Result<OverlayResponse> {
    Ok(OverlayResponse { status: "unsupported".into(), ..Default::default() })
  }

  pub fn unified_memory_state(&self) -> crate::Result<UnifiedMemoryState> {
    Ok(serde_json::json!({ "workingMemoryCount": 0, "episodic": [], "longTerm": [], "relationship": [], "corrections": [] }))
  }

  pub fn unified_set_manual_memory(&self, _args: UnifiedManualMemoryArgs) -> crate::Result<OverlayResponse> {
    Ok(OverlayResponse { status: "unsupported".into(), ..Default::default() })
  }

  pub fn unified_import_legacy(&self, _args: UnifiedImportLegacyArgs) -> crate::Result<OverlayResponse> {
    Ok(OverlayResponse { status: "unsupported".into(), ..Default::default() })
  }
}
