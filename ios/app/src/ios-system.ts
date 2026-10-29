import { invoke } from '@tauri-apps/api/core';
import { isIOS } from './platform';
export async function copyText(text: string) {
  if (isIOS && '__TAURI_INTERNALS__' in window) {
    const result = await invoke<{status: string}>('plugin:mobile-pet|copy_text', {text});
    if (result.status !== 'copied') throw new Error('Copy failed');
  } else await navigator.clipboard.writeText(text);
}
export function setupIOSExternalLinks(toast: (text: string) => void) {
  document.addEventListener('click', event => {
    if (event.defaultPrevented || !(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>('a[href]');
    if (!link || !/^https?:\/\//i.test(link.getAttribute('href') || '')) return;
    event.preventDefault();
    void invoke('plugin:mobile-pet|open_external', {url: link.href}).catch(() => toast('链接没有打开，请检查网络或浏览器'));
  });
}
