import { invoke } from '@tauri-apps/api/core';

/** One light pulse per deliberate action. Feedback must never block an action. */
export function createHapticTap(pulse: () => unknown, now: () => number = () => performance.now()) {
  let lastTap = -Infinity;
  return () => {
    const time = now();
    if (time - lastTap < 80) return;
    lastTap = time;
    try { void Promise.resolve(pulse()).catch(() => {}); } catch { /* Unsupported devices stay silent. */ }
  };
}

export const lightHaptic = createHapticTap(() => {
  if ('__TAURI_INTERNALS__' in window) return invoke('plugin:mobile-pet|haptic_tap');
  return navigator.vibrate?.(12);
});

export function setupHaptics(root: HTMLElement, tap = lightHaptic) {
  const click = (event: Event) => {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest('button,[role="button"],input[type="checkbox"],input[type="radio"],select,.archive-media-frame > img');
    if (!target || !root.contains(target) || target.matches(':disabled,[aria-disabled="true"],#mobile-pet,#memo-companion-pet')) return;
    tap();
  };
  const change = (event: Event) => {
    if (event.target instanceof HTMLInputElement && ['range', 'color', 'date', 'time'].includes(event.target.type)) tap();
  };
  root.addEventListener('click', click, true);
  root.addEventListener('change', change, true);
  root.addEventListener('submit', tap, true);
  return () => { root.removeEventListener('click', click, true); root.removeEventListener('change', change, true); root.removeEventListener('submit', tap, true); };
}
