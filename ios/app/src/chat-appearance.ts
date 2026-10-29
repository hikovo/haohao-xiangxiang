import { cropImage } from './image-cropper';
import { lightHaptic } from './haptics';

const KEY = 'sanhao.chat-appearance.v1';
type Appearance = { background: string; petColor: string; userColor: string; petAvatar: string; petOpacity: number; userOpacity: number };
export type AppearanceTarget = 'background' | 'petColor' | 'userColor' | 'petAvatar' | 'userAvatar';
const PREVIOUS_DEFAULT_PET_AVATAR = '/rabbit-head.png';
const DEFAULT_USER_AVATAR = '/user-rabbit-sleep.jpg';
const defaults: Appearance = { background: '', petColor: '#FFFFFF', userColor: '#F4C8CF', petAvatar: '/chat-pet-avatar.jpg', petOpacity: 100, userOpacity: 100 };
let settings: Appearance = { ...defaults };
try { settings = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* defaults for damaged settings */ }
// Keep personal pictures untouched, but migrate the former built-in rabbit head.
if (settings.petAvatar === PREVIOUS_DEFAULT_PET_AVATAR) settings.petAvatar = defaults.petAvatar;
export const chatPetAvatar = () => settings.petAvatar;

export function setupChatAppearance(setUserAvatar: (src: string) => void, toast: (text: string) => void) {
  const page = document.querySelector<HTMLElement>('#page-chat')!;
  const app = document.querySelector<HTMLElement>('#mobile-app')!;
  const dialog = document.createElement('dialog');
  dialog.className = 'chat-customizer';
  dialog.innerHTML = `<h2>聊天外观</h2><p class="customizer-help"></p><section class="customizer-bubbles"><div class="customizer-preview"><span class="preview-bubble">今天也陪着你呀～</span></div><h3>挑一个喜欢的颜色</h3><div class="customizer-swatches"></div><label class="customizer-color"><span>再挑一个</span><span class="customizer-color-chip"><input type="color" aria-label="气泡颜色" /><span class="customizer-hex"></span></span></label><div class="customizer-opacity"><label for="bubble-opacity"><span>不透明度</span><output>100%</output></label><input id="bubble-opacity" type="range" min="0" max="100" step="1" aria-label="气泡不透明度" /><div class="opacity-captions"><span>轻透一点</span><span>实在一点</span></div></div></section><button type="button" data-custom="image">选择图片</button><input type="file" accept="image/png,image/jpeg,image/webp" hidden /><footer><button type="button" data-custom="reset">恢复默认</button><button type="button" data-custom="close">就这样啦</button></footer>`;
  document.querySelector('#mobile-app')!.append(dialog);
  const picker = dialog.querySelector<HTMLInputElement>('input[type=file]')!;
  const color = dialog.querySelector<HTMLInputElement>('input[type=color]')!;
  const opacity = dialog.querySelector<HTMLInputElement>('input[type=range]')!;
  let target: AppearanceTarget = 'background';
  const swatches = [{value:'#FFFFFF',name:'云朵白'},{value:'#F4C8CF',name:'草莓粉'},{value:'#FFF1DB',name:'奶油黄'},{value:'#E9DFF1',name:'软软紫'},{value:'#DDEBF4',name:'天空蓝'},{value:'#DDEBDF',name:'青草绿'},{value:'#E8D8CC',name:'可可奶'},{value:'#6B5157',name:'暖棕色'}];
  swatches.forEach(({value,name}) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'color-swatch'; button.title = name; button.setAttribute('aria-label', name); button.dataset.color = value; button.style.setProperty('--swatch-color',value);
    button.addEventListener('click', () => { color.value = value; color.dispatchEvent(new Event('change')); });
    dialog.querySelector('.customizer-swatches')!.append(button);
  });
  const preview = () => {
    const role = target === 'userColor' ? 'user' : 'pet';
    const value = settings[`${role}Color`];
    const rgb = value.slice(1).match(/../g)!.map(v => parseInt(v,16));
    const bubble = dialog.querySelector<HTMLElement>('.preview-bubble')!;
    bubble.style.backgroundColor = `rgba(${rgb.join(',')},${settings[`${role}Opacity`] / 100})`;
    bubble.style.color = ink(value);
    dialog.querySelector('.customizer-hex')!.textContent = value.toUpperCase();
    dialog.querySelectorAll<HTMLButtonElement>('.color-swatch').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.color === value.toUpperCase())));
  };
  const ink = (hex: string) => {
    const values = hex.slice(1).match(/../g)!.map(v => { const n = parseInt(v, 16) / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; });
    return values[0] * .2126 + values[1] * .7152 + values[2] * .0722 > .179 ? '#38282D' : '#FFFFFF';
  };
  const apply = () => {
    // Only the message scroller uses the wallpaper; controls keep their own paper.
    app.style.setProperty('--chat-wallpaper', settings.background ? `url("${settings.background}")` : 'none');
    app.classList.toggle('has-chat-wallpaper', Boolean(settings.background));
    for (const role of ['pet', 'user'] as const) {
      const value = settings[`${role}Color`];
      const alpha = Math.max(0, Math.min(100, Number(settings[`${role}Opacity`]) || 0)) / 100;
      const rgb = value.slice(1).match(/../g)!.map(v => parseInt(v, 16));
      app.style.setProperty(`--chat-${role}-color`, `rgba(${rgb.join(',')},${alpha})`);
      app.style.setProperty(`--chat-${role}-ink`, ink(value));
    }
    page.querySelectorAll<HTMLImageElement>('.chat-line.pet .chat-avatar').forEach(image => image.src = settings.petAvatar);
    preview();
  };
  const save = (next: Appearance) => {
    localStorage.setItem(KEY, JSON.stringify(next));
    settings = next;
    apply();
  };
  apply();
  function open(element?: Element, selection?: AppearanceTarget) {
    const role = selection?.startsWith('user') || element?.closest('.chat-line')?.classList.contains('user') ? 'user' : 'pet';
    target = selection || (element?.closest('.chat-avatar') ? `${role}Avatar` : element?.closest('.chat-message') ? `${role}Color` : 'background');
    const isColor = target.endsWith('Color');
    dialog.querySelector<HTMLElement>('.customizer-bubbles')!.hidden = !isColor;
    dialog.querySelector<HTMLButtonElement>('[data-custom=image]')!.hidden = isColor;
    dialog.querySelector('h2')!.textContent = target === 'background' ? '聊天背景' : `${role === 'pet' ? '左侧' : '右侧'}${isColor ? '气泡颜色' : '头像'}`;
    dialog.querySelector('.customizer-help')!.textContent = isColor ? '挑个颜色，给小小的话换件新衣服' : '选一张喜欢的图片吧';
    if (isColor) color.value = settings[target as 'petColor' | 'userColor'];
    if (isColor) { opacity.value = String(settings[role === 'pet' ? 'petOpacity' : 'userOpacity']); dialog.querySelector('output')!.textContent = `${opacity.value}%`; }
    preview(); lightHaptic();
    if (!dialog.open) dialog.showModal();
  }
  let timer: number | undefined;
  let start = { x: 0, y: 0 };
  const cancel = () => { window.clearTimeout(timer); timer = undefined; };
  const eligible = (element: Element) => !!element.closest('#chat-log') && !element.closest('button,input,textarea');
  page.addEventListener('pointerdown', event => {
    cancel();
    if (event.button !== 0 || !eligible(event.target as Element)) return;
    start = { x: event.clientX, y: event.clientY };
    timer = window.setTimeout(() => { cancel(); open(event.target as Element); }, 550);
  });
  page.addEventListener('pointermove', event => { if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) cancel(); });
  ['pointerup', 'pointercancel', 'scroll'].forEach(name => page.addEventListener(name, cancel, true));
  page.addEventListener('contextmenu', event => { if (!eligible(event.target as Element)) return; event.preventDefault(); cancel(); if (!dialog.open) open(event.target as Element); });
  color.addEventListener('change', () => {
    try { save({ ...settings, [target]: color.value }); } catch { toast('这个颜色还没收好，手机需要留一点空位哦'); }
  });
  opacity.addEventListener('input', () => {
    dialog.querySelector('output')!.textContent = `${opacity.value}%`;
    try { save({ ...settings, [target === 'petColor' ? 'petOpacity' : 'userOpacity']: Number(opacity.value) }); }
    catch { toast('还没记住这个设置，再试一次吧'); }
  });
  dialog.querySelector('[data-custom=close]')!.addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-custom=image]')!.addEventListener('click', () => { picker.value = ''; picker.click(); });
  dialog.querySelector('[data-custom=reset]')!.addEventListener('click', () => {
    try {
      if (target === 'userAvatar') setUserAvatar(DEFAULT_USER_AVATAR);
      else if (target === 'petColor' || target === 'userColor') save({ ...settings, [target]: defaults[target], [target === 'petColor' ? 'petOpacity' : 'userOpacity']: 100 });
      else save({ ...settings, [target]: defaults[target] });
      dialog.close(); toast('已恢复默认');
    } catch { toast('还没收好，手机需要留一点空位哦'); }
  });
  picker.addEventListener('change', async () => {
    const file = picker.files?.[0];
    if (!file) return;
    const selection = target;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) { toast('请选择 12MB 以内的 PNG、JPG 或 WebP 图片'); return; }
    try {
      const result = await cropImage(file, selection === 'background' ? 'background' : 'avatar');
      if (!result) return;
      if (selection === 'userAvatar') setUserAvatar(result);
      else save({ ...settings, [selection]: result });
      dialog.close(); toast('已更新，长按可以再次更换');
    } catch { toast('这张照片还没收好，换张小一点的试试吧'); }
  });
  return (selection: AppearanceTarget) => open(undefined, selection);
}
