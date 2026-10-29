use tauri::{
  plugin::{Builder, TauriPlugin},
  Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::MobilePet;
#[cfg(mobile)]
use mobile::MobilePet;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the mobile-pet APIs.
pub trait MobilePetExt<R: Runtime> {
  fn mobile_pet(&self) -> &MobilePet<R>;
}

impl<R: Runtime, T: Manager<R>> crate::MobilePetExt<R> for T {
  fn mobile_pet(&self) -> &MobilePet<R> {
    self.state::<MobilePet<R>>().inner()
  }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("mobile-pet")
    .invoke_handler(tauri::generate_handler![
      commands::open_external,
      commands::sync_widgets,
      commands::speak_weather,
      commands::local_model,
      commands::ledger_store,
      commands::health_store,
      commands::timetable_store,
      commands::timetable_scan,
      commands::copy_text,
      commands::haptic_tap,
      commands::start_overlay,
      commands::stop_overlay,
      commands::overlay_status,
      commands::daily_reminder_state,
      commands::save_daily_reminder,
      commands::mark_daily_prompt_shown,
      commands::answer_daily_reminder,
      commands::sync_memo_reminders,
      commands::reminder_style,
      commands::schedule_focus_reminder,
      commands::cancel_focus_reminder,
      commands::unified_chat,
      commands::unified_retract_messages,
      commands::unified_clear_conversation,
      commands::unified_memory_state,
      commands::unified_set_manual_memory,
      commands::unified_import_legacy
    ])
    .setup(|app, api| {
      #[cfg(mobile)]
      let mobile_pet = mobile::init(app, api)?;
      #[cfg(desktop)]
      let mobile_pet = desktop::init(app, api)?;
      app.manage(mobile_pet);
      Ok(())
    })
    .build()
}
