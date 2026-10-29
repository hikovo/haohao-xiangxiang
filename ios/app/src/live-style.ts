export type LiveStyle = {background: string; bubble: string; buttons: string; islandBubble: string; islandButtons: string};
export const defaultLiveStyle: LiveStyle = {background: '#fff1f6', bubble: '#fff7e2', buttons: '#ffebf2', islandBubble: '#fff7e2', islandButtons: '#ffebf2'};
const key = 'sanhao-tu.live-style.v1';
export function normalizeLiveStyle(value: Partial<LiveStyle> | null): LiveStyle {
  const valid = (color: unknown, fallback: string) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
  return {background: valid(value?.background, defaultLiveStyle.background), bubble: valid(value?.bubble, defaultLiveStyle.bubble), buttons: valid(value?.buttons, defaultLiveStyle.buttons), islandBubble: valid(value?.islandBubble, defaultLiveStyle.islandBubble), islandButtons: valid(value?.islandButtons, defaultLiveStyle.islandButtons)};
}
export function loadLiveStyle(): LiveStyle {
  try { return normalizeLiveStyle(JSON.parse(localStorage.getItem(key) || 'null')); } catch { return {...defaultLiveStyle}; }
}
function ink(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 < .5 ? '#ffffff' : '#674d52';
}
export function setupLiveStyle(options: {openSheet: (panel: HTMLElement) => void; toast: (message: string) => void; sync: () => Promise<boolean>; preview: boolean}) {
  const panel = document.querySelector<HTMLElement>('#live-style-panel')!;
  const card = panel.querySelector<HTMLElement>('.live-style-preview')!;
  const fields = [...panel.querySelectorAll<HTMLInputElement>('[data-live-color]')];
  let draft = loadLiveStyle();
  let island = false;
  const fieldKey = (field: HTMLInputElement): keyof LiveStyle => island && field.dataset.liveColor === 'bubble' ? 'islandBubble' : island && field.dataset.liveColor === 'buttons' ? 'islandButtons' : field.dataset.liveColor as keyof LiveStyle;
  function render() {
    const bubble = island ? draft.islandBubble : draft.bubble, buttons = island ? draft.islandButtons : draft.buttons;
    card.style.setProperty('--live-background', island ? '#000000' : draft.background);
    card.classList.toggle('is-island', island);
    card.style.setProperty('--live-bubble', bubble);
    card.style.setProperty('--live-buttons', buttons);
    card.style.setProperty('--live-bubble-ink', ink(bubble));
    card.style.setProperty('--live-button-ink', ink(buttons));
    fields.forEach(field => { field.value = draft[fieldKey(field)]; field.closest<HTMLLabelElement>('label')!.hidden = island && field.dataset.liveColor === 'background'; field.setAttribute('aria-label', `${island ? '岛上兔兔' : '锁屏小窗'}${field.dataset.liveColor === 'background' ? '背景' : field.dataset.liveColor === 'bubble' ? '气泡' : '功能键'}颜色`); });
    panel.querySelector('h2')!.textContent = island ? '灵动岛小窗' : '锁屏小窗';
    panel.setAttribute('aria-label', island ? '岛上的兔兔外观' : '锁屏小窗外观');

  }
  const open=()=>options.openSheet(document.querySelector<HTMLElement>('#live-style-choices')!);
  for (const [id, mode] of [['live-style-lock', false], ['live-style-island', true]] as const) document.querySelector('#'+id)!.addEventListener('click', () => { island = mode; draft = loadLiveStyle(); render(); options.openSheet(panel); });
  fields.forEach(field => field.addEventListener('input', () => { draft = normalizeLiveStyle({...draft, [fieldKey(field)]: field.value}); render(); }));
  panel.querySelector('#live-style-reset')!.addEventListener('click', () => { draft = island ? {...draft, islandBubble: defaultLiveStyle.islandBubble, islandButtons: defaultLiveStyle.islandButtons} : {...draft, background: defaultLiveStyle.background, bubble: defaultLiveStyle.bubble, buttons: defaultLiveStyle.buttons}; render(); });
  panel.querySelector('#live-style-save')!.addEventListener('click', async () => {
    const save = panel.querySelector<HTMLButtonElement>('#live-style-save')!;
    if (save.disabled) return;
    save.disabled = true;
    try {
    const old = localStorage.getItem(key); localStorage.setItem(key, JSON.stringify(draft));
    if (!options.preview && !await options.sync()) {
      if (old === null) localStorage.removeItem(key); else localStorage.setItem(key, old);
      options.toast('颜色还没保存成功，再试一下呀'); return;
    }
    panel.querySelector<HTMLButtonElement>('[data-close-sheet]')!.click(); options.toast('颜色收好啦');
    } finally { save.disabled = false; }
  });
  const atlas=new Image();atlas.src='/spritesheet.webp';
  const canvas=card.querySelector('canvas')!;
  const draw=()=>canvas.getContext('2d')?.drawImage(atlas,0,0,192,208,0,0,192,208);
  if(atlas.complete&&atlas.naturalWidth)draw();else atlas.addEventListener('load',draw,{once:true});
  render();
  return {open};
}
