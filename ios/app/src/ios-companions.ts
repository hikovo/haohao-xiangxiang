import { setupCompanionSettings } from './companion-settings';
import { animations, type AnimationName } from './rabbit-animations';
import { rabbitTapAction, appendRabbitTap } from './rabbit-taps';
import { isIOS } from './platform';
import { invoke } from '@tauri-apps/api/core';
import { centeredFloatingPlacement, floatingCenter, floatingMenu, visibleFloatingPlacement, type FloatingArea } from './floating-layout';
import { chooseRabbitReply, type RabbitReplyContext } from './rabbit-replies';
import { fitTextBox } from './fit-text-box';
import {defaultRabbitCenter, roomPoint, type RoomRect} from './home-layout';
import {FloatingRabbitGesture} from './floating-rabbit-gesture';
import {setupLiveStyle,loadLiveStyle} from './live-style';

type PetState = { mood: string; message: string; affection: number; carrots: number };
type TodoAction = { id: string; recordID: string; date: string; completed: boolean };
type Route = { kind: string; id: string };
type Options = {
  snapshot: () => Record<string, unknown>;
  applyTodos: (actions: TodoAction[]) => void;
  openRecord: (route: Route) => void;
  toast: (message: string) => void;
  openSheet: (panel: HTMLElement) => void;
  scale: () => number;
  setScale: (value:number,save?:boolean) => void;
  working: () => boolean;
  focus: () => { revision: number; id: string; phase: string; deadlineMs: number; remainingMs: number };
  observeFocusRevision: (revision: number, bootstrap: boolean) => void;
  replyContext: () => Omit<RabbitReplyContext, 'now' | 'weather'>;
};
const enabledKey = 'sanhao-tu.ios.floating.enabled.v1';
const positionKey = 'sanhao-tu.ios.floating.position.v2';
const petKey = 'sanhao-tu.ios.companion.pet.v1';
const replyHistoryKey = 'sanhao-tu.ios.rabbit.replies.v1';
const atlas = new Image(); atlas.src = '/spritesheet.webp';
export function setupIOSCompanions(options: Options) {
  const preview = !('__TAURI_INTERNALS__' in window);
  if (!isIOS && !preview) return;
  let enabled = localStorage.getItem(enabledKey) !== 'false';
  const liveEnabledKey='sanhao-tu.ios.live.enabled.v1';
  let liveEnabled=localStorage.getItem(liveEnabledKey)===null ? enabled : localStorage.getItem(liveEnabledKey)==='true';
  let state: PetState = { mood: 'idle', message: '今天也陪在你身边', affection: 0, carrots: 0 };
  try { state = { ...state, ...JSON.parse(localStorage.getItem(petKey) || '{}') }; } catch { /* Keep an invalid old key for recovery. */ }
  let position: {x:number;y:number} | undefined;
  try { const saved = JSON.parse(localStorage.getItem(positionKey) || 'null'); if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) position = saved; } catch { /* Preserve the old key for recovery. */ }
  let replyHistory: string[] = [], reply = '', replyTimer = 0;
  let weatherReport: RabbitReplyContext['weather'];
  try { const saved = JSON.parse(localStorage.getItem(replyHistoryKey) || '[]'); if (Array.isArray(saved)) replyHistory = saved.filter(item => typeof item === 'string').slice(-80); } catch { /* Empty response history. */ }
  const root = document.createElement('aside'); root.id = 'ios-floating-rabbit'; root.hidden = true;
  root.innerHTML = '<div class="ios-rabbit-popover" role="status" aria-live="polite" hidden><p></p></div><button type="button" class="ios-rabbit-handle" aria-label="互动兔兔，单击跳跳，双击 wink，四击晕晕，拖动可移动，双指可缩放"><canvas width="192" height="208"></canvas></button>';
  document.body.append(root);
  const handle = root.querySelector<HTMLButtonElement>('.ios-rabbit-handle')!;
  const canvas = root.querySelector('canvas')!;
  const bubble = root.querySelector<HTMLElement>('.ios-rabbit-popover')!;
  const context = canvas.getContext('2d')!;
  const app = document.querySelector<HTMLElement>('#mobile-app')!;
  const room = document.querySelector<HTMLElement>('#mobile-room')!;
  // One fixed interactive node and one viewport anchor for every page.
  app.classList.add('ios-single-rabbit');
  handle.setAttribute('aria-expanded', 'false');
  const toggle = document.querySelector<HTMLButtonElement>('#enable-overlay')!;
  const liveToggle=document.querySelector<HTMLButtonElement>('#enable-live-activity')!;
  let dragAnchor={left:0,top:0};
  let frame = 0, row = 0, animation = 0;
  let tapTimes: number[] = [], tapTimer = 0;
  let acknowledged: string[] = [];
  let syncJob: Promise<boolean> | undefined;
  let nativeFocusReady = false;
  const settings = setupCompanionSettings({openSheet: options.openSheet, toast: options.toast, sync, preview});
  const liveStyle=setupLiveStyle({openSheet:options.openSheet,toast:options.toast,sync,preview});
  function draw() {
    if (!atlas.complete || !atlas.naturalWidth) return;
    context.clearRect(0, 0, 192, 208);
    context.drawImage(atlas, frame * 192, row * 208, 192, 208, 0, 0, 192, 208);
  }
  // Rest on the open-eye frame between blinks. Each pause is independently
  // randomized in a bounded range; interaction/hidden states cancel old runs.
  let animationTimer = 0;
  function animate(action: string) {
    window.clearTimeout(animationTimer);
    const run = ++animation;
    const idle = action === 'idle';
    const name: AnimationName = idle ? (options.working() ? 'typing' : 'blink')
      : action === 'feed' ? 'hop' : action === 'pet' ? 'smile' : action === 'rest' ? 'wait'
      : action as AnimationName;
    const spec = animations[name] || animations.blink;
    row = spec.row; frame = 0; handle.dataset.animation = name; draw();
    const schedule = (fn: () => void, ms: number) => { animationTimer = window.setTimeout(fn, ms); };
    let remaining = spec.frames * (name === 'dizzy' ? 2 : 1);
    const step = () => {
      if (animation !== run || root.hidden) return;
      if (!idle && --remaining <= 0) { animate('idle'); return; }
      if (idle && name === 'blink' && frame === spec.frames - 1) {
        frame = 0; draw(); schedule(step, 3400 + Math.random() * 3900); return;
      }
      frame = (frame + 1) % spec.frames; draw(); schedule(step, spec.frameMs);
    };
    schedule(step, idle && name === 'blink' ? 3400 + Math.random() * 3900 : spec.frameMs);
  }
  function registerTap() {
    tapTimes = appendRabbitTap(tapTimes, performance.now());
    window.clearTimeout(tapTimer);
    if (tapTimes.length >= 10) { tapTimes = []; void act('captain'); return; }
    tapTimer = window.setTimeout(() => {
      const action = rabbitTapAction(tapTimes.length); tapTimes = [];
      if (action) void act(action);
    }, 320);
  }
  let stableArea: FloatingArea;
  let viewportKey = '';
  let homeRect: RoomRect | undefined;
  function area(): FloatingArea {
    const rect = app.getBoundingClientRect();
    // The keyboard and page-specific composer must not move the rabbit.
    // WKWebView can shrink innerHeight together with visualViewport, so comparing
    // only those two values misses a keyboard and overwrites the full-page anchor.
    const editing = document.activeElement?.matches('input,textarea,[contenteditable="true"]') ?? false;
    const keyboardVisible = !!stableArea && innerWidth === Number(viewportKey.split(':')[0]) &&
      (editing || (visualViewport?.height || innerHeight) < stableArea.bottom + 12 - 120);
    const key = `${innerWidth}:${innerHeight}`;
    if (!stableArea || (!keyboardVisible && key !== viewportKey)) {
      viewportKey = key;
      stableArea = {left:rect.left, right:rect.right, top:70, bottom:innerHeight - 12};

    }
    const home = room.getBoundingClientRect();
    if (!keyboardVisible && home.width > 0 && home.height > 0) homeRect = home;
    return stableArea;
  }
  function defaultPosition(bounds: FloatingArea) {
    const point = homeRect ? roomPoint(homeRect, defaultRabbitCenter)
      : {x:(bounds.left+bounds.right)/2,y:bounds.top+(bounds.bottom-bounds.top)*.45};
    return {x:(point.x-bounds.left)/(bounds.right-bounds.left),y:(point.y-bounds.top)/(bounds.bottom-bounds.top)};
  }
  function place() {
    const bounds = area();
    if (!position) position = defaultPosition(bounds);
    const viewport = window.visualViewport;
    const visible = {left:viewport?.offsetLeft ?? 0, top:viewport?.offsetTop ?? 0,
      right:(viewport?.offsetLeft ?? 0) + (viewport?.width ?? innerWidth),
      bottom:(viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight)};
    const layout = visibleFloatingPlacement(centeredFloatingPlacement(bounds, options.scale(), position), visible);
    root.style.width = `${layout.width}px`; handle.style.height = `${layout.height}px`;
    root.style.left = `${layout.left}px`; root.style.top = `${layout.top}px`;
    bubble.style.maxWidth = `${Math.max(1, Math.min(256, bounds.right - bounds.left - 16))}px`;
    bubble.style.maxHeight = `${bounds.bottom - bounds.top}px`;
    if (!bubble.hidden) {
      const paragraph = bubble.querySelector('p')!;
      const limit = Math.max(30, Math.min(240, bounds.right - bounds.left - 16));
      fitTextBox(bubble, paragraph, limit);
      const menu = floatingMenu(layout, {left:Math.max(bounds.left,visible.left),right:Math.min(bounds.right,visible.right),top:visible.top+70,bottom:visible.bottom-12}, bubble.offsetWidth, bubble.offsetHeight);
      bubble.style.left = `${menu.left}px`; bubble.style.top = `${menu.top}px`;
      bubble.style.setProperty('--reply-tail', `${Math.max(14, Math.min(bubble.offsetWidth - 14, layout.width / 2 - menu.left))}px`);
      bubble.classList.toggle('below-rabbit', menu.top > 0);
    }
  }
  function menu(open: boolean) {
    if (bubble.hidden !== !open) bubble.hidden = !open;
    handle.setAttribute('aria-expanded', String(open));
    if (open) place();
  }
  function update() {
    toggle.querySelector('b')!.textContent = '跟着你逛逛';
    toggle.querySelector('small')!.textContent = '兔兔跟着你，点点就回应呀';
    toggle.classList.toggle('overlay-enabled', enabled); toggle.setAttribute('aria-pressed', String(enabled));
    liveToggle.classList.toggle('overlay-enabled',liveEnabled);liveToggle.setAttribute('aria-pressed',String(liveEnabled));
    const page = document.querySelector<HTMLElement>('.app-page.active')?.dataset.page;
    const dialogs = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')];
    const modal = dialogs[dialogs.length - 1];
    const host = modal || document.body;
    if (root.parentElement !== host) {
      if (root.hasAttribute('popover') && root.matches(':popover-open')) root.hidePopover();
      host.append(root);
    }
    const useTopLayer = !!modal && typeof root.showPopover === 'function';
    if (useTopLayer) root.setAttribute('popover', 'manual');
    else if (root.hasAttribute('popover')) { if (root.matches(':popover-open')) root.hidePopover(); root.removeAttribute('popover'); }

    const wasHidden = root.hidden;
    const hidden = (!enabled && page !== 'home') || document.hidden;
    if (root.hidden !== hidden) root.hidden = hidden;
    if (root.hidden) { menu(false); if (useTopLayer && root.matches(':popover-open')) root.hidePopover(); }
    else if (useTopLayer && !root.matches(':popover-open')) root.showPopover();
    bubble.querySelector('p')!.textContent = reply || state.message;
    place(); if (!root.hidden && (wasHidden || (row === 0 && options.working()) || (row === 7 && !options.working()))) animate('idle');
  }
  async function sync(action?: string): Promise<boolean> {
    if (preview || document.hidden) return false;
    if (syncJob) {
      await syncJob;
      return sync(action);
    }
    syncJob = performSync(action);
    try { return await syncJob; } finally { syncJob = undefined; }
  }
  async function performSync(action?: string): Promise<boolean> {
    const sentAcknowledgements = [...acknowledged];
    try {
      const response = await invoke<{ snapshot?: string }>('plugin:mobile-pet|sync_widgets', { payload: JSON.stringify({ snapshot: options.snapshot(), acknowledged: sentAcknowledgements, followEnabled: liveEnabled, liveStyle:loadLiveStyle(),petAction: action, petMessage: action ? reply : undefined, focus: nativeFocusReady ? options.focus() : undefined, ...settings.payload() }) });
      const result = JSON.parse(response.snapshot || '{}') as { shared?: boolean; openMeal?:string; openWeather?:boolean; pending?: TodoAction[]; pet?: PetState; route?: Route; weather?: {message?: string; mark?: string; legal?: string; current?: RabbitReplyContext['weather']}; meal?: {lastChoice?: string} };
      if ((result as {error?: string}).error) throw new Error((result as {error: string}).error);
      const nativeRevision = (result as {focusRevision?: number}).focusRevision;
      if (Number.isSafeInteger(nativeRevision) && nativeRevision! >= 0) {
        const bootstrap = !nativeFocusReady;
        options.observeFocusRevision(nativeRevision!, bootstrap);
        nativeFocusReady = true;
        if (bootstrap) window.setTimeout(() => void sync(), 0);
      }
      settings.acknowledged(); settings.accept(result);
      acknowledged = acknowledged.filter(id => !sentAcknowledgements.includes(id));
      if (result.pending?.length) { options.applyTodos(result.pending); acknowledged.push(...result.pending.map(command => command.id)); }
      if (result.pet) { state = result.pet; localStorage.setItem(petKey, JSON.stringify(state)); if (!reply) bubble.querySelector('p')!.textContent = state.message; }
      if (result.weather?.current) weatherReport = result.weather.current;
      if (result.route) options.openRecord(result.route);
      return true;
    } catch { if (action) options.toast('这次互动还没保存，稍后再试一下'); return false; }
  }
  async function act(action: string) {
    if (action === 'close') { menu(false); return; }
    const gesture = ['hop', 'wink', 'dizzy', 'captain'].includes(action);
    if (gesture) {
      animate(action === 'captain' ? 'wink' : action);
      const next = chooseRabbitReply(action, { ...options.replyContext(), now: new Date(), weather: weatherReport }, replyHistory);
      reply = next.text; replyHistory = next.recent;
      localStorage.setItem(replyHistoryKey, JSON.stringify(replyHistory));
      bubble.querySelector('p')!.textContent = reply; menu(true);
      window.clearTimeout(replyTimer);
      replyTimer = window.setTimeout(() => { reply = ''; menu(false); }, Math.max(5000, Math.min(8000, reply.length * 180)));
    }
    if (preview) {
      if (gesture) { ++state.affection; state.message = reply; }
      else if (action === 'feed') { ++state.carrots; state.message = `收到第 ${state.carrots} 根胡萝卜啦 ♡`; }
      else if (action === 'rest') state.message = '休息一下，兔兔陪着你';
      else if (['hop', 'wink', 'dizzy'].includes(action)) { ++state.affection; state.message = action === 'hop' ? '跳跳，今天也陪着你' : action === 'wink' ? 'wink～' : '晕菜啦……'; }
      else { ++state.affection; state.message = `被摸摸 ${state.affection} 次啦 ♡`; }
      localStorage.setItem(petKey, JSON.stringify(state)); update();
    } else if (!await sync(action)) return;
    if (!gesture) animate(action);
  }
  bubble.querySelectorAll<HTMLButtonElement>('[data-rabbit-action]').forEach(button => button.addEventListener('click', () => void act(button.dataset.rabbitAction!)));
  const gesture=new FloatingRabbitGesture({
    scale:options.scale,resize:value=>options.setScale(value,false),
    commitResize:()=>{options.setScale(options.scale(),true);options.toast(`大小 ${Math.round(options.scale()*100)}%`);},
    beginDrag:()=>{const rect=root.getBoundingClientRect();dragAnchor={left:rect.left,top:rect.top};},
    manipulation:()=>{window.clearTimeout(tapTimer);tapTimes=[];menu(false);},
    moveDrag:(dx,dy)=>{const bounds=area();position=floatingCenter(bounds,centeredFloatingPlacement(bounds,options.scale(),position!),dragAnchor.left+dx,dragAnchor.top+dy);place();},
    commitDrag:rememberPosition,tap:registerTap,
  });
  function beginPointer(event:PointerEvent){
    if(event.button!==0||gesture.has(event.pointerId))return;
    event.preventDefault();gesture.down(event.pointerId,event.clientX,event.clientY);
    handle.setPointerCapture(event.pointerId);
  }
  handle.addEventListener('pointerdown',beginPointer);
  // The second finger may land just outside a small rabbit's visible bounds.
  document.addEventListener('pointerdown',event=>{
    if(gesture.active&&event.pointerType==='touch'&&!handle.contains(event.target as Node))beginPointer(event);
  },{capture:true,passive:false});
  handle.addEventListener('pointermove', event => {
    if(!gesture.has(event.pointerId))return;
    event.preventDefault();gesture.move(event.pointerId,event.clientX,event.clientY);
  });
  function finish(event: PointerEvent) {
    gesture.up(event.pointerId,event.type!=='pointerup');
  }
  handle.addEventListener('pointerup', finish); handle.addEventListener('pointercancel', finish);
  function rememberPosition() {
    localStorage.setItem(positionKey, JSON.stringify(position));
  }
  handle.addEventListener('lostpointercapture',finish);
  handle.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); registerTap(); } });
  document.addEventListener('pointerdown', event => { if (event.target instanceof Node && !root.contains(event.target)) menu(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') menu(false); });
  toggle.addEventListener('click', () => { enabled = !enabled; if (enabled) { position = defaultPosition(area()); rememberPosition(); } localStorage.setItem(enabledKey, String(enabled)); update(); void sync(); options.toast(enabled ? '同一只兔兔，陪你逛每一页' : '兔兔留在首页的小房间里'); });
  let holdTimer=0,held=false,holdStart:{x:number;y:number}|undefined;
  const cancelHold=()=>{window.clearTimeout(holdTimer);holdStart=undefined;};
  liveToggle.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;held=false;holdStart={x:event.clientX,y:event.clientY};
    holdTimer=window.setTimeout(()=>{held=true;holdStart=undefined;liveStyle.open()},550);
  });
  liveToggle.addEventListener('pointermove',event=>{if(holdStart&&Math.hypot(event.clientX-holdStart.x,event.clientY-holdStart.y)>8)cancelHold()});
  for(const name of ['pointerup','pointercancel','pointerleave'])liveToggle.addEventListener(name,cancelHold);
  liveToggle.addEventListener('contextmenu',event=>{event.preventDefault();cancelHold();held=true;liveStyle.open()});
  liveToggle.addEventListener('keydown',event=>{if(event.key==='F10'&&event.shiftKey){event.preventDefault();liveStyle.open()}});
  liveToggle.addEventListener('click',async()=>{
    if(held){held=false;return}if(liveToggle.disabled)return;
    const previous=liveEnabled;liveEnabled=!liveEnabled;update();liveToggle.disabled=true;
    try {if(!preview&&!await sync()){liveEnabled=previous;update();options.toast('这次还没切换好，再试一下呀');return}
      localStorage.setItem(liveEnabledKey,String(liveEnabled));options.toast(liveEnabled?'兔兔去岛上陪你啦':'兔兔回到小房间啦');
    }finally{liveToggle.disabled=false}
  });
  let updateFrame = 0;
  new MutationObserver(records => {
    if (!records.some(item => item.target instanceof Node && !root.contains(item.target) && !toggle.contains(item.target))) return;
    if (!updateFrame) updateFrame = requestAnimationFrame(() => { updateFrame = 0; update(); });
  }).observe(document.body, { attributes: true, childList: true, subtree: true, attributeFilter: ['hidden', 'class', 'open'] });
  new ResizeObserver(place).observe(app);
  new ResizeObserver(place).observe(room);
  visualViewport?.addEventListener('resize', update); window.addEventListener('resize', update);
  visualViewport?.addEventListener('scroll', place);
  document.addEventListener('visibilitychange', () => { update(); if (!document.hidden) { void sync(); } });
  atlas.addEventListener('load', draw);
  update(); void sync();
  window.setInterval(() => { if (!document.hidden) { void sync(); } }, 3000);
  return { update, reset: () => {
    position = defaultPosition(area()); rememberPosition();
    place();
  }, sync: () => void sync() };
}
