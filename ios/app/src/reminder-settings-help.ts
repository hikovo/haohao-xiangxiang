import { invoke } from '@tauri-apps/api/core';

export type ReminderHelpKind = 'daily' | 'todo' | 'countdown' | 'focus' | 'course' | 'habit' | 'meal' | 'weather';
const shownThisSession = new Set<ReminderHelpKind>();
const seenKey = (kind: ReminderHelpKind) => `hhxx.reminder-system-help-seen.v1/${kind}`;

export function showReminderSettingsHelp(kind: ReminderHelpKind) {
  if (shownThisSession.has(kind)) return;
  try { if (localStorage.getItem(seenKey(kind)) === '1') return; } catch { /* Session fallback when storage is unavailable. */ }
  if (document.querySelector('#reminder-system-help')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'reminder-system-help';
  dialog.className = 'reminder-system-help';
  dialog.setAttribute('aria-labelledby', 'reminder-system-help-title');
  dialog.innerHTML = `
    <img src="/rabbit-head.png" alt="" aria-hidden="true" />
    <h2 id="reminder-system-help-title">让小提醒响起来</h2>
    <p>在 iPhone「设置 → 通知 → 好好想想」中<br>允许通知，并打开声音。</p>
    <small>静音或专注模式可能让提醒安静下来。</small>
    <div class="reminder-system-help-actions"><button type="button" data-settings="notifications">打开通知设置</button></div>
    <p class="reminder-system-help-status" role="status" hidden></p>
    <button type="button" data-dismiss>我知道啦</button>`;
  document.querySelector('#mobile-app')!.append(dialog);
  const dismiss = () => { dialog.close(); dialog.remove(); };
  dialog.querySelector('[data-dismiss]')!.addEventListener('click', dismiss);
  dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
  dialog.querySelectorAll<HTMLButtonElement>('[data-settings]').forEach(button => button.addEventListener('click', async () => {
    const status = dialog.querySelector<HTMLElement>('[role="status"]')!;
    if (!('__TAURI_INTERNALS__' in window)) {
      status.textContent = '请在手机 App 中打开设置；网页预览不能跳转手机设置。';
      status.hidden = false;
      return;
    }
    button.disabled = true;
    try {
      await invoke('plugin:mobile-pet|reminder_style', { payload: JSON.stringify({ action: 'settings', target: button.dataset.settings }) });
      status.hidden = true;
    } catch {
      status.textContent = '请到 iPhone「设置 → 通知 → 好好想想」允许通知并开启声音。';
      status.hidden = false;
    } finally { button.disabled = false; }
  }));
  dialog.showModal();
  shownThisSession.add(kind);
  try { localStorage.setItem(seenKey(kind), '1'); } catch { /* Do not repeat within this session. */ }
}
