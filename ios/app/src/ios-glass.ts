// Keep the existing navigation actions and layout; UIKit supplies the iOS material.
import { isIOS } from './platform';
type GlassHandler = { postMessage: (message: unknown) => void };
type GlassWindow = Window & { webkit?: { messageHandlers?: { sanhaoGlass?: GlassHandler } } };
let bridgeAttempts = 0;

export function setupIOSGlass(): void {
  if (document.documentElement.dataset.glassConnecting === 'true') return;
  const bridge = (window as GlassWindow).webkit?.messageHandlers?.sanhaoGlass;
  const dock = document.querySelector<HTMLElement>('.mobile-dock');
  const app = document.querySelector<HTMLElement>('#mobile-app');
  if (!bridge || !dock || !app) {
    if (isIOS && '__TAURI_INTERNALS__' in window && bridgeAttempts++ < 40) window.setTimeout(setupIOSGlass, 250);
    return;
  }
  document.documentElement.dataset.glassConnecting = 'true';
  let queued = false;
  let last = '';
  function update(): void {
    queued = false;
    // UIKit sits above the web view, so modal backdrops cannot dim it. Render
    // the matching web dock beneath the backdrop for every sheet and dialog.
    const modalOpen = app!.classList.contains('sheet-open') || !!document.querySelector('dialog[open]');
    app!.classList.toggle('modal-dock-visible', modalOpen);
    const rect = dock!.getBoundingClientRect();
    const hidden = document.hidden || rect.width <= 0 || rect.height <= 0 ||
      modalOpen || ['note-editor-open', 'keyboard-open', 'ledger-open'].some(name => app!.classList.contains(name));
    const buttons = [...dock!.querySelectorAll<HTMLButtonElement>('[data-nav]')];
    const message = {
      kind: 'layout', visible: !hidden, x: rect.x, y: rect.y, width: rect.width,
      height: rect.height, viewportWidth: window.innerWidth,
      selected: buttons.find(button => button.classList.contains('active'))?.dataset.nav ?? 'home',
      bottom: parseFloat(getComputedStyle(dock!).paddingBottom) || 8,
    };
    const signature = JSON.stringify(message);
    if (signature !== last) { last = signature; bridge!.postMessage(message); }
  }
  function schedule(): void {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }
  new ResizeObserver(schedule).observe(dock);
  // Observe modal state and selected navigation, not chat text or user data.
  const observer = new MutationObserver(schedule);
  observer.observe(app, { attributes: true, attributeFilter: ['class'] });
  dock.querySelectorAll('[data-nav]').forEach(button => observer.observe(button, { attributes: true, attributeFilter: ['class'] }));
  document.querySelectorAll('dialog').forEach(dialog => observer.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
  new MutationObserver(records => {
    for (const record of records) for (const node of [...record.addedNodes, ...record.removedNodes]) {
      if (!(node instanceof Element)) continue;
      const dialogs = node.matches('dialog') ? [node] : [...node.querySelectorAll('dialog')];
      if (dialogs.length) {
        dialogs.forEach(dialog => observer.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
        schedule();
      }
    }
  }).observe(app, { childList: true, subtree: true });
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);
  document.addEventListener('visibilitychange', schedule);
  // Only the four approved local navigation images cross this UI bridge.
  void Promise.all(['home', 'chat', 'memo', 'profile'].map(async page => {
    const response = await fetch(`/nav-${page}.png`);
    if (!response.ok && response.status !== 0) throw new Error('Navigation artwork unavailable');
    const blob = await response.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { page, data };
  })).then(icons => { bridge.postMessage({ kind: 'icons', icons }); schedule(); }).catch(() => {
    // If artwork cannot load, keep the complete web navigation available.
    bridge.postMessage({ kind: 'hide' });
  });
}
