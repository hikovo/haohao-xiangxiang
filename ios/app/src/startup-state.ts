declare global {
  interface Window {
    __sanhaoStartupError?: string;
    __SANHAO_STARTUP__?: { ready: () => void; fail: () => void };
  }
}
export function finishStartup() {
  if (window.__SANHAO_STARTUP__) window.__SANHAO_STARTUP__.ready();
  else document.querySelector('#app-launch-screen')?.remove();
}
export function failStartup(error: unknown) {
  console.error("App startup failed", error);
  if (import.meta.env.VITE_IOS_SELFTEST === '1') window.__sanhaoStartupError = String(error);
  window.__SANHAO_STARTUP__?.fail();
}
export function startupDeadline<T>(promise: Promise<T>, milliseconds: number, fallback: T): Promise<T> {
  return new Promise(resolve => {
    const timeout = window.setTimeout(() => resolve(fallback), milliseconds);
    promise.then(value => { window.clearTimeout(timeout); resolve(value); }, () => { window.clearTimeout(timeout); resolve(fallback); });
  });
}
