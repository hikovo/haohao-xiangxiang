import { scrollEdgeState } from './scroll-edge-state';

type EdgeBridge = { postMessage: (value: unknown) => void };
type EdgeWindow = Window & { webkit?: { messageHandlers?: { sanhaoGlass?: EdgeBridge } } };

/** Each fade belongs to its page; it cannot cover the companion or another page. */
export function setupScrollEdges() {
  const selector = '#page-memo, .profile-scroll-content, .sheet-body, .archive-reader-content, #note-body-input, #moment-body-input';
  type Entry = {id: string; armed: boolean; gesture: number; position: number};
  const entries = new Map<HTMLElement, Entry>();
  let frame = 0;
  let nextID = 0;
  let lastMessage = '';
  const masked = new Map<HTMLElement, {mask: string; webkit: string}>();
  const resize = new ResizeObserver(schedule);
  function schedule() { if (!frame) frame = requestAnimationFrame(update); }
  function gesture(event: Event) {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    if (event instanceof KeyboardEvent && !['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return;
    const target = event.target.closest<HTMLElement>(selector);
    const entry = target && entries.get(target);
    if (entry) entry.gesture = performance.now();
  }
  function scrolled(event: Event) {
    if (event.target instanceof HTMLElement) {
      const entry = entries.get(event.target);
      if (entry && Math.abs(event.target.scrollTop - entry.position) > .5 && performance.now() - entry.gesture < 2000) entry.armed = true;
    }
    schedule();
  }
  function update() {
    frame = 0;
    const regions: {id: string; x: number; y: number; width: number; height: number; depth: number; bottomDepth: number; dock: boolean; paper: number[]; top: number; bottom: number}[] = [];
    const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
    const openDialog = dialogs[dialogs.length - 1];
    const dock = document.querySelector<HTMLElement>('.mobile-dock');
    for (const [target, edges] of entries) {
      if (!target.isConnected) {
        resize.unobserve(target); entries.delete(target); continue;
      }
      const rect = target.getBoundingClientRect();
      const dialog = target.closest('dialog');
      const page = target.closest('.app-page');
      const onActivePage = !page || page.classList.contains('active');
      const style = getComputedStyle(target);
      const scrollable = ['auto', 'scroll'].includes(style.overflowY) && target.scrollHeight - target.clientHeight > 2;
      const editorOpen = !!document.querySelector(':is(#note-detail-view, #moment-detail-view):not([hidden])');
      const behindEditor = editorOpen && !target.closest('#note-detail-view, #moment-detail-view');
      const behindLedger = !!document.querySelector('.ledger-page:not([hidden])') && !target.closest('.ledger-page, .mobile-sheet');
      const occluded = !!openDialog && !openDialog.contains(target) && !!dialog;
      const visible = onActivePage && scrollable && !behindEditor && !behindLedger && !occluded && !document.hidden && rect.width > 0 && rect.height > 0 && !target.closest('[hidden]') && (!dialog || dialog.open);
      if (!visible) { edges.armed = false; edges.gesture = -Infinity; }
      const state = scrollEdgeState(target.scrollTop, target.clientHeight, target.scrollHeight, edges.armed);
      edges.position = target.scrollTop;
      if (visible && (state.top > 0 || state.bottom > 0) && regions.length < 12) {
        const underDock = !!dock && ['page-memo', 'profile-scroll-content'].some(name => target.id === name || target.classList.contains(name));
        // The fade starts above navigation, and has already reached its opaque
        // paper endpoint when content reaches the icons. It is not a separate strip.
        const dockTop = dock?.getBoundingClientRect().top ?? rect.bottom;
        const bottomDepth = underDock ? Math.min(rect.height / 2, rect.bottom - dockTop + 44) : Math.min(24, rect.height / 2);
        // A sheet has its own paper color even when it covers the pink chat.
        const surface = target.closest<HTMLElement>('.mobile-sheet, dialog, #note-detail-view, #moment-detail-view, .app-page');
        const hex = surface && getComputedStyle(surface).getPropertyValue('--glass-base').trim().match(/^#([\da-f]{6})$/i)?.[1];
        const paper = hex ? [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)) : [255, 249, 239];
        const header = target.id === 'page-memo' ? target.querySelector<HTMLElement>('.page-header')?.getBoundingClientRect() : null;
        const visibleTop = header ? Math.max(rect.top, header.bottom) : rect.top;
        regions.push({id: edges.id, x: rect.x, y: visibleTop, width: rect.width, height: rect.bottom - visibleTop,
          depth: Math.min(24, rect.height / 2), bottomDepth, dock: underDock, paper, top: state.top, bottom: state.bottom});
      }
    }
    const bridge = (window as EdgeWindow).webkit?.messageHandlers?.sanhaoGlass;
    // Fade the actual content, never place material above a scrollbar, header
    // or the companion. A child keeps its existing layout and interaction.
    const footerIDs = new Set(regions.filter(r => r.dock && r.bottom > 0).map(r => `${r.id}.bottom`));
    document.querySelectorAll<HTMLElement>('.browser-scroll-blur').forEach(band => {
      if (!footerIDs.has(band.dataset.browserEdge || '')) band.remove();
    });
    for (const region of regions.filter(r => r.dock && r.bottom > 0)) {
      let band = document.querySelector<HTMLElement>(`[data-browser-edge="${region.id}.bottom"]`);
      if (!band) {
        const target = [...entries].find(([, entry]) => entry.id === region.id)?.[0];
        const owner = target?.closest('.app-page');
        if (!owner) continue;
        band = document.createElement('div'); band.className = 'browser-scroll-blur dock-edge';
        band.dataset.browserEdge = `${region.id}.bottom`; band.setAttribute('aria-hidden', 'true'); owner.append(band);
      }
      const depth = region.bottomDepth;
      band.style.cssText = `position:fixed;left:${region.x}px;top:${region.y + region.height - depth}px;width:${region.width}px;height:${depth}px;--edge-strength:${region.bottom};--paper:rgb(${region.paper.join(' ')});--paper-end:${Math.min(1, 44 / depth) * 100}%;`;
    }
    const current = new Set<HTMLElement>();
    for (const [target, entry] of entries) {
      const region = regions.find(item => item.id === entry.id);
      if (!region) continue;
      const topDepth = region.top > 0 ? Math.min(region.depth, region.height / 3) : 0;
      const bottomDepth = !region.dock && region.bottom > 0 ? Math.min(region.bottomDepth, region.height / 3) : 0;
      for (const child of [...target.children]) {
        if (!(child instanceof HTMLElement) || child.matches('.page-header, .browser-scroll-blur, .page-scroll-band, [hidden]')) continue;
        // Rich-text editing owns its HTML; never write presentation styles into
        // user-authored editable content.
        if (target.isContentEditable || child.isContentEditable) continue;
        const box = child.getBoundingClientRect();
        if (box.height <= 0) continue;
        const top = region.y - box.top;
        const bottom = region.y + region.height - box.top;
        const stops = [topDepth ? `transparent ${top}px, #000 ${top + topDepth}px` : '#000 0px',
          bottomDepth ? `#000 ${bottom - bottomDepth}px, transparent ${bottom}px` : '#000 100%'];
        const mask = `linear-gradient(to bottom, ${stops.join(', ')})`;
        if (!masked.has(child)) masked.set(child, {mask: child.style.maskImage, webkit: child.style.webkitMaskImage});
        if (child.style.maskImage !== mask) { child.style.maskImage = mask; child.style.webkitMaskImage = mask; }
        current.add(child);
      }
    }
    for (const [child, previous] of masked) {
      if (current.has(child)) continue;
      child.style.maskImage = previous.mask; child.style.webkitMaskImage = previous.webkit;
      masked.delete(child);
    }
    // Retire UIKit bands above the WKWebView: those also blur HTML companions.
    // WKWebView renders the same real backdrop material inside the page stack.
    const message = {kind: 'scrollEdges', viewportWidth: window.innerWidth, regions: []};
    const signature = JSON.stringify(message);
    if (bridge && signature !== lastMessage) { lastMessage = signature; bridge.postMessage(message); }
  }
  function discover() {
    document.querySelectorAll<HTMLElement>(selector).forEach(target => {
      if (entries.has(target)) return;
      entries.set(target, {id: `e${++nextID}`, armed: false, gesture: -Infinity, position: target.scrollTop});
      resize.observe(target);
    });
    schedule();
  }
  new MutationObserver(discover).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'class', 'open']});
  for (const name of ['wheel', 'touchmove', 'keydown']) document.addEventListener(name, gesture, {capture: true, passive: true});
  document.addEventListener('scroll', scrolled, {capture: true, passive: true});
  document.addEventListener('input', schedule, {passive: true});
  document.addEventListener('load', schedule, {capture: true, passive: true});
  document.addEventListener('loadedmetadata', schedule, {capture: true, passive: true});
  document.addEventListener('transitionend', schedule);
  document.addEventListener('animationend', schedule);
  window.addEventListener('resize', schedule, {passive: true});
  document.addEventListener('visibilitychange', schedule);
  window.setTimeout(schedule, 500); // The native plugin may attach after page initialization.
  window.setTimeout(schedule, 2000);
  window.visualViewport?.addEventListener('resize', schedule, {passive: true});
  window.visualViewport?.addEventListener('scroll', schedule, {passive: true});
  void document.fonts.ready.then(schedule);
  discover();
}
