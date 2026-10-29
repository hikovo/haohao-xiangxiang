import {archiveDateIndex,clampArchiveRange} from './archive-date-model';
import { draw, reviewedCaption } from './generated/offline-rules.js';
export type ArchiveRange = { start: string; end: string };
export type ArchiveItem = { id: string; kind: 'image' | 'video' | 'letter' | 'audio'; date: string | null; derivedFile: string; posterFile?: string; reply: string; manualBubbles?: string[]; originalCaption: string; searchText: string; captionReview: string; name: string; bytes: number; periodStart?: string; periodEnd?: string };
type Catalog = { rows: ArchiveItem[]; letters: Record<string, { title: string; pages: string[] }> };
let catalogPromise: Promise<Catalog> | undefined;
export const assetUrl = (file: string) => `/offline-blindbox/${encodeURIComponent(file)}`;
export function loadArchives() {
  return catalogPromise ||= fetch('/offline-blindbox/catalog.json').then(response => {
    if (!response.ok) throw new Error('Archive catalog missing');
    return response.json() as Promise<Catalog>;
  }).catch(error => { catalogPromise = undefined; throw error; });
}
export async function drawArchive(message: string, recent: string[]) {
  const { rows } = await loadArchives();
  const index=archiveDateIndex(rows);
  let range:ArchiveRange=clampArchiveRange(index);
  try { range=clampArchiveRange(index,JSON.parse(localStorage.getItem('sanhao.offline-range')||'{}')); } catch { /* catalog bounds */ }
  const result = draw(rows, message, range, recent);
  return { ...result, reply: result.item?.kind === 'letter' ? 'Only for my light' : result.item ? reviewedCaption(result.item) : result.reply };
}
function button(label: string, className: string) {
  const element = document.createElement('button'); element.type = 'button'; element.className = className; element.setAttribute('aria-label', label); return element;
}
function readerShell(title: string, date?: string | null) {
  const dialog = document.createElement('dialog'); dialog.className = 'archive-reader'; dialog.tabIndex = -1;
  const header = document.createElement('header'); header.className = 'archive-reader-header';
  const back = button('返回说说话', 'centered-back');
  back.innerHTML = '<img class="header-icon" src="/header-back.svg" alt="" />';
  const heading = document.createElement('h2'); heading.textContent = title; heading.title = title;
  header.append(back, heading);
  if (date) { const time = document.createElement('time'); time.className = 'letter-reader-date'; time.dateTime = date; time.textContent = date; header.append(time); }
  dialog.append(header); document.querySelector('#mobile-app')!.append(dialog);
  back.addEventListener('click', () => dialog.close()); dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal(); dialog.focus({ preventScroll: true }); return dialog;
}
async function openLetter(item: ArchiveItem) {
  const { letters } = await loadArchives(); const letter = letters[item.id]; if (!letter) throw new Error('Letter pages missing');
  const dialog = readerShell(letter.title, item.date); const content = document.createElement('div'); content.className = 'archive-reader-content';
  letter.pages.forEach((page, index) => {
    const frame = document.createElement('div'); frame.className = 'letter-page';
    const image = document.createElement('img'); image.src = assetUrl(page); image.alt = `${letter.title} · 第 ${index + 1} 页`; image.draggable = false;
    image.addEventListener('dblclick', () => frame.classList.toggle('zoomed'));
    const number = document.createElement('small'); number.textContent = `${index + 1} / ${letter.pages.length}`;
    frame.append(image); content.append(frame, number);
  });
  const footer = document.createElement('p'); footer.className = 'reader-hint'; footer.textContent = '点两下可以放大，慢慢看';
  dialog.append(content, footer);
}
let floatingVideo: { wrapper: HTMLElement; restore: () => void } | undefined;
function floatVideo(video: HTMLVideoElement, frame: HTMLElement) {
  floatingVideo?.restore();
  const wrapper = document.createElement('div'); wrapper.className = 'archive-small-video';
  const drag = button('拖动小窗', 'small-video-handle'); drag.textContent = '拖一拖';
  const close = button('关闭小窗，回到聊天', 'small-video-close'); close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6L18 18M18 6L6 18"/></svg>';
  const restore = () => { video.controls = false; frame.prepend(video); wrapper.remove(); floatingVideo = undefined; };
  wrapper.append(drag, close, video); document.querySelector('#mobile-app')!.append(wrapper); video.controls = true;
  close.addEventListener('click', restore); floatingVideo = { wrapper, restore };
  drag.addEventListener('pointerdown', event => {
    const rect = wrapper.getBoundingClientRect(); drag.setPointerCapture(event.pointerId);
    const x = event.clientX, y = event.clientY;
    const move = (next: PointerEvent) => { wrapper.style.left = `${Math.max(0, Math.min(innerWidth - rect.width, rect.left + next.clientX - x))}px`; wrapper.style.top = `${Math.max(0, Math.min(innerHeight - rect.height, rect.top + next.clientY - y))}px`; wrapper.style.right = 'auto'; wrapper.style.bottom = 'auto'; };
    drag.addEventListener('pointermove', move); drag.addEventListener('pointerup', () => drag.removeEventListener('pointermove', move), { once: true });
  });
}
export function renderArchive(item: ArchiveItem, toast: (value: string) => void) {
  const wrap = document.createElement('div'); wrap.className = 'archive-message';
  if (item.kind === 'letter') {
    const card = button('阅读' + item.name, 'archive-file-card chat-message pet');
    const copy = document.createElement('span'); const title = document.createElement('strong'); title.textContent = item.name;
    const size = document.createElement('small'); size.textContent = `${(item.bytes / 1048576).toFixed(2)} MB`; copy.append(title, size);
    const icon = document.createElement('img'); icon.src = '/rabbit-head.png'; icon.alt = ''; card.append(copy, icon);
    card.addEventListener('click', event => { event.stopPropagation(); void openLetter(item).catch(() => toast('这封与灯书还没打开，再试一下吧')); }); wrap.append(card); return wrap;
  }
  const frame = document.createElement('div'); frame.className = 'archive-media-frame';
  if (item.kind === 'image') {
    const image = document.createElement('img'); image.src = assetUrl(item.derivedFile); image.alt = item.reply; image.loading = 'lazy';
    image.addEventListener('click', event => { event.stopPropagation(); toast('可以去网盘看高清版喔～'); }); frame.append(image);
  } else if (item.kind === 'video') {
    const video = document.createElement('video'); video.src = assetUrl(item.derivedFile); video.preload = 'metadata'; video.playsInline = true;
    // A real bundled still frame is visible even before Android decodes the video.
    video.poster = assetUrl(item.posterFile || item.id + '-cover.jpg');
    const play = button('播放视频', 'archive-play'); const pip = button('放进小窗', 'archive-pip');
    play.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5L20 12L9 19Z"/></svg>';
    pip.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="15" height="15" rx="2"/><rect x="10" y="10" width="11" height="11" rx="2"/></svg>';
    play.addEventListener('click', event => { event.stopPropagation(); if (video.paused) void video.play().catch(() => toast('点一下，再一起看吧')); else video.pause(); });
    video.addEventListener('play', () => { play.setAttribute('aria-label', '暂停视频'); play.classList.add('playing'); });
    video.addEventListener('pause', () => { play.setAttribute('aria-label', '播放视频'); play.classList.remove('playing'); });
    video.addEventListener('loadedmetadata', () => { frame.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`; frame.style.width = `${Math.min(220, 300 * video.videoWidth / video.videoHeight)}px`; });
    pip.addEventListener('click', event => { event.stopPropagation(); floatVideo(video, frame); }); frame.append(video, play, pip);
  } else { const audio = document.createElement('audio'); audio.src = assetUrl(item.derivedFile); audio.controls = true; frame.append(audio); }
  wrap.append(frame);
  if (item.date) { const date = document.createElement('small'); date.className = 'archive-date'; date.textContent = item.date; wrap.append(date); }
  return wrap;
}
