use tauri::{command, AppHandle, Runtime};

use crate::models::*;
use crate::Result;
use crate::MobilePetExt;

#[command]
pub(crate) async fn open_external<R: Runtime>(app: AppHandle<R>, url: String) -> Result<OverlayResponse> {
  app.mobile_pet().open_external(url)
}

#[command]
pub(crate) async fn haptic_tap<R: Runtime>(app: AppHandle<R>) -> Result<OverlayResponse> {
  app.mobile_pet().haptic_tap()
}

#[command]
pub(crate) async fn start_overlay<R: Runtime>(app: AppHandle<R>, payload: Option<String>) -> Result<OverlayResponse> {
  app.mobile_pet().start_overlay(payload)
}

#[command]
pub(crate) async fn stop_overlay<R: Runtime>(app: AppHandle<R>) -> Result<OverlayResponse> {
  app.mobile_pet().stop_overlay()
}

#[command]
pub(crate) async fn overlay_status<R: Runtime>(app: AppHandle<R>, payload: Option<String>) -> Result<OverlayResponse> {
  app.mobile_pet().overlay_status(payload)
}

#[command]
pub(crate) async fn daily_reminder_state<R: Runtime>(app: AppHandle<R>) -> Result<DailyReminderState> {
  app.mobile_pet().daily_reminder_state()
}

#[command]
pub(crate) async fn save_daily_reminder<R: Runtime>(
  app: AppHandle<R>,
  settings: DailyReminderSettings,
) -> Result<DailyReminderState> {
  app.mobile_pet().save_daily_reminder(settings)
}

#[command]
pub(crate) async fn mark_daily_prompt_shown<R: Runtime>(app: AppHandle<R>) -> Result<DailyReminderState> {
  app.mobile_pet().mark_daily_prompt_shown()
}

#[command]
pub(crate) async fn answer_daily_reminder<R: Runtime>(
  app: AppHandle<R>,
  answer: String,
) -> Result<DailyReminderState> {
  app.mobile_pet().answer_daily_reminder(DailyAnswerArgs { answer })
}

#[command]
pub(crate) async fn reminder_style<R: Runtime>(app: AppHandle<R>, payload: String) -> Result<OverlayResponse> {
  app.mobile_pet().reminder_style(MemoReminderSyncArgs { payload })
}

#[command]
pub(crate) async fn sync_memo_reminders<R: Runtime>(app: AppHandle<R>, payload: String) -> Result<OverlayResponse> {
  app.mobile_pet().sync_memo_reminders(MemoReminderSyncArgs { payload })
}

#[command]
pub(crate) async fn schedule_focus_reminder<R: Runtime>(
  app: AppHandle<R>,
  delay_ms: i64,
  deadline_ms: Option<i64>,
  message: String,
  lead_minutes: i32,
) -> Result<OverlayResponse> {
  app.mobile_pet().schedule_focus_reminder(FocusReminderArgs { delay_ms, deadline_ms, message, lead_minutes })
}

#[command]
pub(crate) async fn cancel_focus_reminder<R: Runtime>(app: AppHandle<R>) -> Result<OverlayResponse> {
  app.mobile_pet().cancel_focus_reminder()
}

#[command]
pub(crate) async fn unified_chat<R: Runtime>(
  app: AppHandle<R>,
  message_id: String,
  message: String,
  entry_point: String,
) -> Result<UnifiedChatReply> {
  app.mobile_pet().unified_chat(UnifiedChatArgs { message_id, message, entry_point })
}

#[command]
pub(crate) async fn unified_retract_messages<R: Runtime>(app: AppHandle<R>, message_ids: Vec<String>) -> Result<UnifiedRetractResponse> {
  app.mobile_pet().unified_retract_messages(UnifiedRetractArgs { message_ids })
}

#[command]
pub(crate) async fn unified_clear_conversation<R: Runtime>(app: AppHandle<R>) -> Result<OverlayResponse> {
  app.mobile_pet().unified_clear_conversation()
}

#[command]
pub(crate) async fn unified_memory_state<R: Runtime>(app: AppHandle<R>) -> Result<UnifiedMemoryState> {
  app.mobile_pet().unified_memory_state()
}

#[command]
pub(crate) async fn unified_set_manual_memory<R: Runtime>(app: AppHandle<R>, memory_json: String) -> Result<OverlayResponse> {
  app.mobile_pet().unified_set_manual_memory(UnifiedManualMemoryArgs { memory_json })
}

#[command]
pub(crate) async fn unified_import_legacy<R: Runtime>(
  app: AppHandle<R>,
  history_json: String,
  memory_json: String,
) -> Result<OverlayResponse> {
  app.mobile_pet().unified_import_legacy(UnifiedImportLegacyArgs { history_json, memory_json })
}

#[command]
pub(crate) async fn copy_text<R: Runtime>(app: AppHandle<R>, text: String) -> Result<OverlayResponse> {
  app.mobile_pet().copy_text(text)
}

#[command]
pub(crate) async fn sync_widgets<R: Runtime>(app: AppHandle<R>, payload: String) -> Result<OverlayResponse> {
  app.mobile_pet().sync_widgets(payload)
}

#[command]
pub(crate) async fn ledger_store<R: Runtime>(app: AppHandle<R>, payload: String) -> Result<OverlayResponse> {
  app.mobile_pet().ledger_store(payload)
}

#[command]
pub(crate) async fn health_store<R: Runtime>(app: AppHandle<R>, payload: String) -> Result<OverlayResponse> {
  app.mobile_pet().health_store(payload)
}

#[command]
pub(crate) async fn timetable_store<R: Runtime>(app: AppHandle<R>, payload: String) -> Result<OverlayResponse> { app.mobile_pet().timetable_store(payload) }
#[command]
pub(crate) async fn timetable_scan<R: Runtime>(app: AppHandle<R>, payload: String) -> Result<OverlayResponse> { app.mobile_pet().timetable_scan(payload) }

#[command]
pub(crate) async fn speak_weather<R: Runtime>(app: AppHandle<R>, payload: String) -> Result<OverlayResponse> { app.mobile_pet().speak_weather(payload) }

#[command]
pub(crate) async fn local_model<R: Runtime>(app: AppHandle<R>, payload: String) -> Result<OverlayResponse> { app.mobile_pet().local_model(payload) }
