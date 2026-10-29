import { isIOS } from "./platform";
import {setupArchiveRangeCalendar} from "./archive-range-calendar";
import { setupIOSCompanions } from "./ios-companions";
import {setupSecondaryChrome} from "./secondary-chrome";
import {artworkPoint, defaultBoardCorner, roomPoint} from "./home-layout";
import { copyText, setupIOSExternalLinks } from "./ios-system";
import { confirmAction, promptLink } from './confirm-action';
import { iosArchiveInvoke } from './ios-archive-runtime';
import {cancelLocalReply,resolveArchiveChat} from './local-model-client';
import {getChatMode,saveChatMode,type ChatMode} from './chat-mode';
import {modelAssetOperation,modelAssetsNative} from './local-model-assets';
import {appendDailyCleanupRows} from './records-cleanup';
import { invoke as nativeInvoke } from "@tauri-apps/api/core";
import { localChatEnabled, localChatInvoke } from "./chat-service-client";
function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!localChatEnabled && command.startsWith('plugin:mobile-pet|unified_')) return iosArchiveInvoke<T>(command, args);
  return localChatEnabled && command.startsWith("plugin:mobile-pet|unified_")
    ? localChatInvoke<T>(command, args) : nativeInvoke<T>(command, args);
}
async function commitChatMutation(command: string, args?: Record<string, unknown>): Promise<boolean> {
  if (command.endsWith('unified_retract_messages') || command.endsWith('unified_clear_conversation')) { cancelLocalReply(); return true; }
  try { await invoke(command, args); return true; }
  catch {
    if (localChatEnabled || "__TAURI_INTERNALS__" in window) { showToast("还没保存成功，请稍后再试"); return false; }
    return true; // Old UI-only preview has no persistent engine.
  }
}
import { chatPetAvatar, setupChatAppearance, type AppearanceTarget } from "./chat-appearance";
import { cropImage } from "./image-cropper";
import { noteMediaIds, removeNoteMedia, sanitizeNoteMedia, setupNoteMedia } from "./note-media";
import { syncHomeRabbitVisibility } from "./overlay-visibility";
import { renderArchive, loadArchives, type ArchiveItem } from './offline-blindbox';
import { splitCaption, reviewedCaption, reviewedBubbles } from './generated/offline-rules.js';
import { lightHaptic, setupHaptics } from './haptics';
import { setupSystemPickers } from './wheel-picker';
import { nextFace, refreshSheetEnding } from './friendly-copy';
import { appendGuideText } from './guide-copy';
import {setupChatFollow} from './chat-follow';
import { setupChatTypography } from './chat-typography';
import { revealConversation } from './chat-reveal';
import { chooseThinkingText, thinkingDuration } from './chat-thinking';
import { setupReminderStyles, reminderOptions, fireReminder } from './reminder-styles';
import { showReminderSettingsHelp } from './reminder-settings-help';
import { failStartup, finishStartup, startupDeadline } from './startup-state';
import { comparisonText } from './compat';
import {setupRoutineReminders,getRoutineReminderRequests} from './routine-reminders';
import {setupHomeLightCycle} from './home-light-cycle';
import { setupScrollEdges } from './scroll-edges';
import { setupIOSGlass } from './ios-glass';
import { fitTextBox } from './fit-text-box';

import { animations, type AnimationName } from './rabbit-animations';

const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const SCALE_KEY = "sanhao-tu.mobile.scale.v2";
const POSITION_KEY = "sanhao-tu.mobile.position.v2";
const MODE_KEY = "sanhao-tu.mobile.mode.v1";
const MIN_SCALE = 0.4;
const MAX_SCALE = 1.2;
// Same physical dimensions as mini: displayed 60% = 75 × 81.25 px.
const PET_DISPLAY_WIDTH = 125;
const PET_DISPLAY_HEIGHT = PET_DISPLAY_WIDTH * CELL_HEIGHT / CELL_WIDTH;
const LONG_PRESS_MS = 520;
const MOVE_THRESHOLD = 10;
const TAP_SETTLE_MS = 320;

const mobileApp = document.querySelector<HTMLElement>("#mobile-app")!;
setupHaptics(mobileApp);
setupSecondaryChrome({closeCompanion:closeLedgerPreview,closeNote:closeNoteDetail,closeMoment:closeMomentDetail});
const wheelPickers = setupSystemPickers(mobileApp);
// Use the same picker for companion pages; iOS native date controls have a
// minimum intrinsic width larger than half of a phone's two-column form.
for (const frame of document.querySelectorAll<HTMLIFrameElement>('.ledger-page iframe')) {
  const attach = () => { if (frame.contentDocument?.body) wheelPickers.observe(frame.contentDocument.body); };
  frame.addEventListener('load', attach); attach();
}
setupScrollEdges();
setupIOSGlass();
const room = document.querySelector<HTMLElement>("#mobile-room")!;
const pet = document.querySelector<HTMLButtonElement>("#mobile-pet")!;
const petSprite = document.querySelector<HTMLImageElement>("#mobile-pet-sprite")!;
const speech = document.querySelector<HTMLElement>("#speech-bubble")!;
const modeLabel = document.querySelector<HTMLElement>("#mobile-mode-label")!;
const timerPill = document.querySelector<HTMLButtonElement>("#timer-pill")!;
const timerText = document.querySelector<HTMLElement>("#timer-text")!;
const menuSheet = document.querySelector<HTMLElement>("#mobile-menu")!;
const homeBoard = document.querySelector<HTMLElement>("#home-board")!;
const homeBoardToggle = document.querySelector<HTMLButtonElement>("#toggle-home-board")!;
const homeBoardToggleLabel = document.querySelector<HTMLElement>("#home-board-toggle-label")!;
const sheetBackdrop = document.querySelector<HTMLElement>("#sheet-backdrop")!;
const sizeValue = document.querySelector<HTMLElement>("#mobile-size-value")!;
const profileSizeValue = document.querySelector<HTMLElement>("#profile-size-value")!;
const workModeButton = document.querySelector<HTMLButtonElement>("#mode-work")!;
const leisureModeButton = document.querySelector<HTMLButtonElement>("#mode-leisure")!;
const timerPanel = document.querySelector<HTMLElement>("#timer-panel")!;
const timerMinutes = document.querySelector<HTMLInputElement>("#timer-minutes")!;
const timerSeconds = document.querySelector<HTMLInputElement>("#timer-seconds")!;
let timerPaused = false;
const timerStart = document.querySelector<HTMLButtonElement>("#timer-start")!;
const timerPause = document.querySelector<HTMLButtonElement>("#timer-pause")!;
const timerCancel = document.querySelector<HTMLButtonElement>("#timer-cancel")!;
const chatLog = document.querySelector<HTMLElement>("#chat-log")!;
const chatFollow=setupChatFollow(chatLog);
const chatForm = document.querySelector<HTMLFormElement>("#chat-form")!;
const chatInput = document.querySelector<HTMLTextAreaElement>("#chat-input")!;
const chatSelectionBar = document.querySelector<HTMLElement>("#chat-selection-bar")!;
const chatSelectionCount = document.querySelector<HTMLElement>("#chat-selection-count")!;
const deleteSelectedChat = document.querySelector<HTMLButtonElement>("#delete-selected-chat")!;
const pageChat = document.querySelector<HTMLElement>("#page-chat")!;
const rabbitMemoryForm = document.querySelector<HTMLFormElement>("#rabbit-memory-form")!;
const chatFavoritesPanel = document.querySelector<HTMLElement>("#chat-favorites-panel")!;
const chatFavoritesList = document.querySelector<HTMLElement>("#chat-favorites-list")!;
const chatFavoritesEmpty = document.querySelector<HTMLElement>("#chat-favorites-empty")!;
const chatFavoritesSummary = document.querySelector<HTMLElement>("#chat-favorites-summary")!;
const MEMO_COMPANION_ENABLED = false;
const memoCompanion = document.querySelector<HTMLElement>("#memo-companion")!;
const memoCompanionBubble = document.querySelector<HTMLElement>("#memo-companion-bubble")!;
const memoCompanionPet = document.querySelector<HTMLButtonElement>("#memo-companion-pet")!;
const memoCompanionSprite = memoCompanionPet.querySelector<HTMLImageElement>("img")!;
const memoCompanionMenu = document.querySelector<HTMLElement>("#memo-companion-menu")!;
const memoModeLabel = document.querySelector<HTMLElement>("#memo-mode-label")!;
const memoChatForm = document.querySelector<HTMLFormElement>("#memo-chat-form")!;
const memoChatInput = document.querySelector<HTMLInputElement>("#memo-chat-input")!;
let memoScale = restoreNumber("sanhao.memoScale", 0.45, MIN_SCALE, MAX_SCALE);
const toast = document.querySelector<HTMLElement>("#mobile-toast")!;
const overlayButton = document.querySelector<HTMLButtonElement>("#enable-overlay")!;

const dailyPanel = document.querySelector<HTMLElement>("#daily-panel")!;
const dailyAnswerPanel = document.querySelector<HTMLElement>("#daily-answer-panel")!;
const memoEditorPanel = document.querySelector<HTMLElement>("#memo-editor-panel")!;
const memoCreatePanel = document.querySelector<HTMLElement>("#memo-create-panel")!;
const memoItemActionsPanel = document.querySelector<HTMLElement>("#memo-item-actions-panel")!;
const memoItemActionOptions = document.querySelector<HTMLElement>("#memo-item-action-options")!;
const memoItemDeleteConfirm = document.querySelector<HTMLElement>("#memo-item-delete-confirm")!;
const memoItemPhotoInput = document.querySelector<HTMLInputElement>("#memo-item-photo-input")!;
const countdownEditorPanel = document.querySelector<HTMLElement>("#countdown-editor-panel")!;
const countdownDateInput = document.querySelector<HTMLInputElement>("#countdown-date-input")!;
const countdownReminderOptions = document.querySelector<HTMLElement>("#countdown-reminder-options")!;
const countdownPhotoPicker = document.querySelector<HTMLElement>("#countdown-photo-picker")!;
const countdownPhotoInput = document.querySelector<HTMLInputElement>("#countdown-photo-input")!;
const countdownPhotoPreview = document.querySelector<HTMLImageElement>("#countdown-photo-preview")!;
const countdownPhotoLabel = document.querySelector<HTMLElement>("#countdown-photo-label")!;
const countdownEditorHint = document.querySelector<HTMLElement>("#countdown-editor-hint")!;
const notificationPanel = document.querySelector<HTMLElement>("#notification-panel")!;
const memoReminderPanel = document.querySelector<HTMLElement>("#memo-reminder-panel")!;
const noteDetailView = document.querySelector<HTMLElement>("#note-detail-view")!;
const momentDetailView = document.querySelector<HTMLElement>("#moment-detail-view")!;
// Editors cover the app viewport, not the memo page's scrolling content.
mobileApp.append(noteDetailView, momentDetailView);
const noteTitleInput = document.querySelector<HTMLInputElement>("#note-title-input")!;
const noteBodyInput = document.querySelector<HTMLElement>("#note-body-input")!;
const noteMediaEditor = setupNoteMedia(noteBodyInput,
  document.querySelector<HTMLInputElement>("#note-media-input")!,
  document.querySelector<HTMLButtonElement>("#add-note-media")!,
  () => saveActiveNote(true), showToast);
const noteDeleteButton = document.querySelector<HTMLButtonElement>("#delete-note")!;
const momentDateInput = document.querySelector<HTMLInputElement>("#moment-date-input")!;
const momentBodyInput = document.querySelector<HTMLElement>("#moment-body-input")!;
const momentDeleteButton = document.querySelector<HTMLButtonElement>("#delete-moment")!;
const memoReminderEnabled = document.querySelector<HTMLInputElement>("#memo-reminder-enabled")!;
const memoReminderOptions = document.querySelector<HTMLElement>("#memo-reminder-options")!;

let petScale = restoreNumber(SCALE_KEY, 0.6, MIN_SCALE, MAX_SCALE);
let petX = 0.5;
let petY = 0.76;
let working = localStorage.getItem(MODE_KEY) === "work";
let animationRun = 0;
let currentPriority = 0;
let tapTimes: number[] = [];
let tapDecisionTimer: number | undefined;
let longPressTimer: number | undefined;
let longPressTriggered = false;
let dragging = false;
let pinching = false;
let pinchStartDistance = 0;
let pinchStartScale = petScale;
let pointerStart: { x: number; y: number } | null = null;
const FOCUS_STATE_KEY = 'hhxx.ios.focus-display.v1';
const restoredFocus = isIOS ? readJson<{deadline: number; remaining: number; paused: boolean; id?: string}>(FOCUS_STATE_KEY, {deadline: 0, remaining: 25 * 60_000, paused: false}) : {deadline: 0, remaining: 25 * 60_000, paused: false, id: undefined};
const FOCUS_REVISION_KEY = 'hhxx.ios.focus-input-revision.v1';
const storedFocusRevision = Number(localStorage.getItem(FOCUS_REVISION_KEY) || '0');
let focusInputRevision = Number.isSafeInteger(storedFocusRevision) && storedFocusRevision >= 0 ? storedFocusRevision : 0;
let focusSessionID = restoredFocus.id || crypto.randomUUID();
let timerDeadline = Number.isFinite(restoredFocus.deadline) && restoredFocus.deadline < Date.now() + 180 * 60_000 ? Math.max(0, restoredFocus.deadline) : 0;
let timerRemainingMs = Number.isFinite(restoredFocus.remaining) ? Math.max(1_000, Math.min(180 * 60_000, restoredFocus.remaining)) : 25 * 60_000;
timerPaused = isIOS && restoredFocus.paused;
let timerInterval: number | undefined;
let toastTimer: number | undefined;
let speechTimer: number | undefined;
let idleActionTimer: number | undefined;
let memoCompanionTimer: number | undefined;
let memoTapDecisionTimer: number | undefined;
let memoAnimationRun = 0;
let memoTapTimes: number[] = [];
let memoDragging = false;
let memoPointerStart: { x: number; y: number; left: number; top: number } | null = null;
let overlayActive = false;
let iosCompanions: ReturnType<typeof setupIOSCompanions>;
let chatGenerating = false;

const pointers = new Map<number, { x: number; y: number }>();

function syncViewportHeight() {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty(
    "--app-height",
    `${Math.max(240, Math.round(viewportHeight))}px`,
  );
  const editing = document.activeElement === chatInput || document.activeElement === memoChatInput;
  mobileApp.classList.toggle("keyboard-open", editing);
  mobileApp.style.top = `${window.visualViewport?.offsetTop ?? 0}px`;
  if (!memoCompanion.hidden) layoutMemoCompanion();
}

function keepChatInputVisible() {
  syncViewportHeight();
  if (document.querySelector<HTMLElement>("#page-chat")!.hidden || document.activeElement !== chatInput) return;
  window.setTimeout(() => {
    chatFollow.request();
  }, 80);
}

function restoreNumber(key: string, fallback: number, min: number, max: number) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function setFrame(row: number, frame: number, baselineOffset = 0) {
  const x = frame * 12.5;
  const y = row * (100 / 9);
  const offset = baselineOffset * petScale;
  petSprite.style.transform = `translate3d(-${x}%, calc(-${y}% + ${offset}px), 0)`;
}

function applyScale(scale: number, save = true) {
  petScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
  iosCompanions?.update();
  pet.style.width = `${PET_DISPLAY_WIDTH * petScale}px`;
  pet.style.height = `${PET_DISPLAY_HEIGHT * petScale}px`;
  const active = (pet.dataset.animation || "blink") as AnimationName;
  const spec = animations[active] ?? animations.blink;
  setFrame(spec.row, 0, spec.baselineOffset);
  sizeValue.textContent = `${Math.round(petScale * 100)}%`;
  profileSizeValue.textContent = `${Math.round(petScale * 100)}%`;
  if (save) localStorage.setItem(SCALE_KEY, String(petScale));
  if (!speech.hidden) requestAnimationFrame(syncSpeechToPet);
  if (save && overlayActive) void syncOverlayState({ scale: petScale });
}

let lastHomeBounds: DOMRect | undefined;
function homeRoomBounds() {
  const bounds = room.getBoundingClientRect();
  if (bounds.width && bounds.height) lastHomeBounds = bounds;
  return lastHomeBounds || bounds;
}
function applyPosition(save = false) {
  const bounds = homeRoomBounds();
  const halfX = Math.min(.5, (PET_DISPLAY_WIDTH * petScale / 2 + 6) / (bounds.width || 1));
  const halfY = Math.min(.5, (PET_DISPLAY_HEIGHT * petScale / 2 + 6) / (bounds.height || 1));
  petX = Math.min(1 - halfX, Math.max(halfX, petX));
  petY = Math.min(1 - halfY, Math.max(halfY, petY));
  pet.style.left = `${petX * 100}%`;
  pet.style.top = `${petY * 100}%`;
  if (save) localStorage.setItem(POSITION_KEY, JSON.stringify({ x: petX, y: petY }));
  if (!speech.hidden) requestAnimationFrame(syncSpeechToPet);
}

function restorePosition() {
  try {
    const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || "null") as {
      x?: number;
      y?: number;
    } | null;
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      petX = saved.x!;
      petY = saved.y!;
    }
  } catch {
    localStorage.removeItem(POSITION_KEY);
  }
  applyPosition();
}

function setIdleFrame() {
  currentPriority = 0;
  pet.dataset.animation = "blink";
  setFrame(0, 0);
}

function restoreBackgroundState() {
  currentPriority = 0;
  if (working) startLoop("typing", 2);
  else setIdleFrame();
}

async function playOnce(name: AnimationName, priority: number, loops = 1) {
  if (priority < currentPriority) return;
  const run = ++animationRun;
  const spec = animations[name];
  currentPriority = priority;
  pet.dataset.animation = name;
  for (let loop = 0; loop < loops; loop += 1) {
    for (let frame = 0; frame < spec.frames; frame += 1) {
      if (run !== animationRun) return;
      setFrame(spec.row, frame, spec.baselineOffset);
      await sleep(spec.frameMs);
    }
  }
  if (run === animationRun) restoreBackgroundState();
}

function startLoop(name: AnimationName, priority: number) {
  if (priority < currentPriority) return;
  const run = ++animationRun;
  const spec = animations[name];
  currentPriority = priority;
  pet.dataset.animation = name;
  void (async () => {
    let frame = 0;
    while (run === animationRun) {
      setFrame(spec.row, frame, spec.baselineOffset);
      frame = (frame + 1) % spec.frames;
      await sleep(spec.frameMs);
    }
  })();
}

function scheduleIdleAction() {
  window.clearTimeout(idleActionTimer);
  idleActionTimer = window.setTimeout(async () => {
    if (!working && !document.querySelector(".mobile-sheet:not([hidden])")) {
      const action: AnimationName = Math.random() > 0.74 ? "wait" : "blink";
      await playOnce(action, 1, action === "wait" ? 2 : 1);
    }
    scheduleIdleAction();
  }, 3_600 + Math.random() * 4_600);
}

function syncSpeechToPet() {
  if (speech.hidden) return;
  const roomBounds = room.getBoundingClientRect();
  const petBounds = pet.getBoundingClientRect();
  const bubbleWidth = speech.offsetWidth || Math.min(roomBounds.width * .78, 320);
  const half = bubbleWidth / 2;
  const center = petBounds.left - roomBounds.left + petBounds.width / 2;
  const bubbleCenter = Math.max(half + 8, Math.min(roomBounds.width - half - 8, center));
  speech.style.left = `${bubbleCenter}px`;
  speech.style.setProperty("--bubble-tail-x", `${Math.max(12, Math.min(bubbleWidth - 12, center - (bubbleCenter - half)))}px`);
  speech.style.top = `${Math.max(8, petBounds.top - roomBounds.top - 10)}px`;
}

function showSpeech(message: string, duration = 3_200) {
  if (overlayActive) return;
  window.clearTimeout(speechTimer);
  const scene = /休息|晕/.test(message) ? 'rest' : /开始|专注/.test(message) ? 'focus' : 'happy';
  speech.textContent = /wink|晕/i.test(message) ? message : `${message} ${nextFace(scene)}`;
  speech.hidden = false;
  requestAnimationFrame(syncSpeechToPet);
  speechTimer = window.setTimeout(() => {
    speech.hidden = true;
  }, duration);
}

function showToast(message: string, duration = 2_300) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle('centered-notice', message === '可以去网盘看高清版喔～');
  toast.classList.toggle('contact-search-notice',message.startsWith('松饼烤好啦'));
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, duration);
  if(toast.classList.contains('contact-search-notice'))toast.style.width='max-content';
  else fitTextBox(toast, toast, Math.min(280, mobileApp.clientWidth - 40));
}

function setWorking(next: boolean) {
  working = next;
  if (overlayActive) void syncOverlayState({ working: next });
  localStorage.setItem(MODE_KEY, next ? "work" : "leisure");
  modeLabel.textContent = next ? "工作中" : "休闲中";
  workModeButton.classList.toggle("selected", next);
  leisureModeButton.classList.toggle("selected", !next);
  restoreMemoAnimation();
  memoModeLabel.textContent = next ? "工作中" : "工作模式";
  if (next) {
    showSpeech("好呀，我们一起开始！");
    startLoop("typing", 2);
  } else {
    showSpeech("先休息一会儿吧～");
    void playOnce("smile", 3);
  }
}

function clearGestureTimers() {
  window.clearTimeout(longPressTimer);
  longPressTimer = undefined;
}

function distanceBetweenPointers() {
  const points = [...pointers.values()];
  if (points.length < 2) return 0;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function registerTap() {
  lightHaptic();
  const now = performance.now();
  tapTimes = [...tapTimes.filter((time) => now - time <= 950), now];
  window.clearTimeout(tapDecisionTimer);
  if (tapTimes.length >= 4) {
    tapTimes = [];
    showSpeech("晕菜啦……");
    void playOnce("dizzy", 5, 2);
    return;
  }
  tapDecisionTimer = window.setTimeout(() => {
    const count = tapTimes.length;
    tapTimes = [];
    if (count >= 2) {
      showSpeech("wink～");
      void playOnce("wink", 4);
    } else if (count === 1) {
      void playOnce("hop", 3);
    }
  }, TAP_SETTLE_MS);
}

pet.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  pet.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2) {
    clearGestureTimers();
    pinching = true;
    dragging = false;
    pinchStartDistance = distanceBetweenPointers();
    pinchStartScale = petScale;
    return;
  }
  pointerStart = { x: event.clientX, y: event.clientY };
  dragging = false;
  longPressTriggered = false;
  longPressTimer = window.setTimeout(() => {
    if (!dragging && !pinching && pointers.size === 1) {
      longPressTriggered = true;
      openSheet(menuSheet);
      lightHaptic();
    }
  }, LONG_PRESS_MS);
});

pet.addEventListener("pointermove", (event) => {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size >= 2 && pinching) {
    event.preventDefault();
    const distance = distanceBetweenPointers();
    if (pinchStartDistance > 0) applyScale(pinchStartScale * (distance / pinchStartDistance), false);
    return;
  }
  if (!pointerStart || pointers.size !== 1) return;
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  if (!dragging && Math.hypot(dx, dy) >= MOVE_THRESHOLD) {
    clearGestureTimers();
    dragging = true;
    ++animationRun;
    currentPriority = 5;
    startLoop(dx < 0 ? "swingLeft" : "swingRight", 5);
  }
  if (dragging) {
    const bounds = room.getBoundingClientRect();
    petX = (event.clientX - bounds.left) / bounds.width;
    petY = (event.clientY - bounds.top) / bounds.height;
    applyPosition();
  }
});

function finishPointer(event: PointerEvent) {
  const wasDragging = dragging;
  pointers.delete(event.pointerId);
  clearGestureTimers();
  if (pinching) {
    if (pointers.size < 2) {
      pinching = false;
      localStorage.setItem(SCALE_KEY, String(petScale));
      showToast(`大小 ${Math.round(petScale * 100)}%`);
    }
    pointerStart = null;
    return;
  }
  if (wasDragging) {
    dragging = false;
    applyPosition(true);
    restoreBackgroundState();
  } else if (!longPressTriggered) {
    registerTap();
  }
  pointerStart = null;
}

pet.addEventListener("pointerup", finishPointer);
pet.addEventListener("pointercancel", finishPointer);
pet.addEventListener("contextmenu", (event) => event.preventDefault());

type DailyState = {
  enabled: boolean;
  message: string;
  hour: number;
  minute: number;
  lastShownDate: string;
  answerDate: string;
  answer: "done" | "notYet" | "";
  notificationPermission: string;
};

type MemoItem = { id: string; title: string; time: string; completedDate: string; remindMinutes?: number; reminderEnabled?: boolean; reminderDate?: string; photo?: string };
type CountdownItem = { id: string; title: string; date: string; kind?: "countdown" | "anniversary"; remindDays?: number; reminderTime?: string; photo?: string; system?: boolean };
type NoteItem = { id: string; title: string; body: string; updatedAt: string; date?: string; photo?: string };
type MomentItem = { id: string; body: string; date: string; updatedAt: string; photo?: string };
type MemoItemAction = { kind: string; title: string; photo?: string; setPhoto: (photo: string) => void; editItem?: () => void; deleteItem?: () => void };
type ChatRecord = { id: string; role: "user" | "pet"; message: string; archive?: ArchiveItem; previousArchiveMessage?: string; mode?: ChatMode };
type ChatFavorite = ChatRecord & { savedAt: string };
type ManualMemorySettings = {
  name: string;
  preferredAddress: string;
  userRole: string;
  petRole: string;
  likes: string;
  currentTopic: string;
  correction: string;
};
type UnifiedReply = {
  reply: string;
  assistantMessageId: string;
  act: string;
  trace: { runtime: string; entryPoint: string; plan: { act: string }; stateDelta: string[] };
};
type NativeMemoryItem = { id: string; key: string; value: string; sourceMessageIds: string[]; createdAt: number; confidence: number };
type UnifiedMemoryState = {
  workingMemoryCount: number;
  currentTopic?: string;
  episodic: NativeMemoryItem[];
  longTerm: NativeMemoryItem[];
  relationship: NativeMemoryItem[];
  corrections: NativeMemoryItem[];
};
type ConversationMemory = {
  name: string;
  preferredAddress: string;
  userRole: string;
  petRole: string;
  likes: string[];
  currentTopic: string;
  lastEmotion: string;
};

const DAILY_KEY = "sanhao-tu.daily.v1";
const MEMO_KEY = "sanhao-tu.memos.v1";
const COUNTDOWN_KEY = "sanhao-tu.countdowns.v1";
const NOTE_KEY = "sanhao-tu.notes.v1";
const MOMENT_KEY = "sanhao-tu.moments.v1";
const BIRTHDAY_PHOTO_KEY = "sanhao-tu.birthday-photo.v1";
const MEMO_REMINDER_ACK_KEY = "sanhao-tu.memo-reminder-acks.v1";
const CHAT_KEY = localChatEnabled ? "sanhao-tu.local-llm.chat.v1" : "sanhao-tu.chat.v1";
const CHAT_MEMORY_KEY = localChatEnabled ? "sanhao-tu.local-llm.memory.v1" : "sanhao-tu.chat-memory.v1";
const MANUAL_MEMORY_KEY = localChatEnabled ? "sanhao-tu.local-llm.manual.v1" : "sanhao-tu.manual-memory.v1";
const CHAT_FAVORITES_KEY = localChatEnabled ? "sanhao-tu.local-llm.favorites.v1" : "sanhao-tu.chat-favorites.v1";
const USER_AVATAR_KEY = "sanhao-tu.user-avatar.v1";
const BOARD_POSITION_KEY = "sanhao-tu.board-position.v3";
const HOME_LIGHTS_KEY = "sanhao-tu.home-lights.v1";
const allSheets = () => [...document.querySelectorAll<HTMLElement>(".mobile-sheet")];
// One heading row and one contextual sign-off for every sheet.
allSheets().forEach(sheet => sheet.querySelectorAll<HTMLElement>('.sheet-eyebrow').forEach(text => { text.hidden = true; }));
const todayKey = () => new Date().toLocaleDateString("en-CA");
const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null") as T | null;
    return parsed ?? fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

let dailyState: DailyState = readJson(DAILY_KEY, {
  enabled: true,
  message: "今天好好吃饭了嘛？",
  hour: 20,
  minute: 0,
  lastShownDate: "",
  answerDate: "",
  answer: "",
  notificationPermission: "unknown",
});
if (["今天做超 LIKE 了吗？", "今天超话签到了吗？", "今天超话签到了嘛？"].includes(dailyState.message)) {
  dailyState.message = "今天好好吃饭了嘛？";
}
let memos = readJson<MemoItem[]>(MEMO_KEY, []);
let countdowns = readJson<CountdownItem[]>(COUNTDOWN_KEY, []);
let notes = readJson<NoteItem[]>(NOTE_KEY, []);
let moments = readJson<MomentItem[]>(MOMENT_KEY, []);
let acknowledgedMemoReminders = readJson<string[]>(MEMO_REMINDER_ACK_KEY, []);
let activeNoteId: string | null = null;
let activeMomentId: string | null = null;
let editingMemoId: string | null = null;
let editingCountdownId: string | null = null;
let activeMemoItemAction: MemoItemAction | null = null;
let pendingCountdownPhoto = "";
let countdownEditorKind: "countdown" | "anniversary" = "countdown";
// The opening line is a fixed little signature. Other bubbles may use the
// scene face library, but this one should never be randomised.
const INITIAL_CHAT_GREETING = "我是小苏(☆_☆)你是？";
let chatHistory = readJson<Array<ChatRecord | Omit<ChatRecord, "id">>>(CHAT_KEY, [])
  .map((item) => ({ ...item, id: "id" in item && item.id ? item.id : makeId() }));
let chatSelectionMode = false;
let chatSelectionAction: "delete" | "favorite" = "delete";
const selectedChatIds = new Set<string>();
let chatFavorites = readJson<ChatFavorite[]>(CHAT_FAVORITES_KEY, []);
let conversationMemory = {
  name: "",
  preferredAddress: "",
  userRole: "",
  petRole: "",
  likes: [],
  currentTopic: "",
  lastEmotion: "",
  ...readJson<Partial<ConversationMemory>>(CHAT_MEMORY_KEY, {}),
} as ConversationMemory;
let manualMemorySettings = readJson<ManualMemorySettings>(MANUAL_MEMORY_KEY, {
  name: conversationMemory.name,
  preferredAddress: conversationMemory.preferredAddress,
  userRole: conversationMemory.userRole,
  petRole: conversationMemory.petRole,
  likes: conversationMemory.likes.join("、"),
  currentTopic: conversationMemory.currentTopic,
  correction: "",
});

// One-time migration into the Android-owned store. The native engine ignores this once it has
// state, so WebView reloads cannot duplicate memories. Browser preview has no native bridge.
const unifiedEngineReady = invoke("plugin:mobile-pet|unified_import_legacy", {
  historyJson: JSON.stringify(chatHistory),
  memoryJson: JSON.stringify(conversationMemory),
}).catch(() => { /* explicit browser-development fallback */ });

function saveFocusDisplay() {
  if (isIOS) {
    localStorage.setItem(FOCUS_STATE_KEY, JSON.stringify({deadline: timerDeadline, remaining: timerRemainingMs, paused: timerPaused, id: focusSessionID}));
    localStorage.setItem(FOCUS_REVISION_KEY, String(++focusInputRevision));
    void iosCompanions?.sync();
  }
}
function scheduleNativeFocusReminder(delayMs: number) {
  const leadMinutes = Number(document.querySelector<HTMLSelectElement>("#focus-remind-before")?.value || 0);
  void invoke("plugin:mobile-pet|schedule_focus_reminder", {
    delayMs: Math.max(1_000, Math.round(delayMs)),
    message: "专注结束啦，辛苦了，休息一下吧。",
    leadMinutes,
    deadlineMs: timerDeadline,
  }).then(result => {
    if (isIOS && (result as {status?: string}).status === 'permissionRequired') showToast('专注已开始；请允许通知，离开 App 后才能收到提醒');
  }).catch(() => { if (isIOS) showToast('专注已开始，但系统提醒没有保存，请重新设置'); });
}

function cancelNativeFocusReminder() {
  void invoke("plugin:mobile-pet|cancel_focus_reminder").catch(() => { /* browser preview fallback */ });
}

let memoReminderSync:Promise<boolean>=Promise.resolve(true);
function syncNativeMemoReminders():Promise<boolean>{memoReminderSync=memoReminderSync.catch(()=>false).then(syncNativeMemoRemindersNow);return memoReminderSync}
async function syncNativeMemoRemindersNow():Promise<boolean> {
  const today = todayKey();
  const memoPayload = memos.map((memo) => {
    const remindMinutes = memo.remindMinutes ?? 0;
    const reminderEnabled = memo.reminderEnabled ?? Boolean(memo.time && remindMinutes >= 0);
    const reminderDate = memo.reminderDate || today;
    const target = memo.time ? new Date(`${reminderDate}T${memo.time}:00`).getTime() : 0;
    return {
      id: `memo-${memo.id}`,
      title: memo.title,
      kind: "task",
      reminderId: memo.id,
      date: memo.reminderDate || "",
      time: memo.time || "",
      done: Boolean(memo.completedDate),
      completed: Boolean(memo.completedDate) || !reminderEnabled || !memo.time || remindMinutes < 0,
      triggerAt: target ? target - remindMinutes * 60_000 : 0,
      message: remindMinutes > 0 ? `“${memo.title}”还有 ${remindMinutes} 分钟，记得准备一下。` : `“${memo.title}”时间到啦。`,
    };
  });
  const countdownPayload = countdowns.filter((item) => item.kind !== "anniversary" && item.date >= today).map((item) => {
    const remindDays = item.remindDays ?? -1;
    const time = item.reminderTime || "09:00";
    const target = new Date(`${item.date}T${time}:00`).getTime();
    return {
      id: `countdown-${item.id}`,
      title: item.title,
      kind: 'countdown',
      reminderId: item.id,
      completed: remindDays < 0,
      triggerAt: target - Math.max(0, remindDays) * 86_400_000,
      message: remindDays > 0 ? `距离“${item.title}”还有 ${remindDays} 天。` : `“${item.title}”就是今天啦。`,
    };
  });
  let routine;try{routine=await getRoutineReminderRequests()}catch{if(isIOS)showToast('提醒记录暂时读不了，系统提醒没有修改');return false}
  const payload = [...memoPayload, ...countdownPayload,...routine];
  return invoke("plugin:mobile-pet|sync_memo_reminders", { payload: JSON.stringify(payload) })
    .then(result => {
      if (!isIOS) return true;
      const status = result as {status?: string; snapshot?: string};
      if (status.status === 'permissionRequired' && payload.some(item => !item.completed && item.triggerAt > Date.now())) showToast('小事已保存；请在设置中允许通知');
      if (JSON.parse(status.snapshot || '{}').deferred > 0) showToast('近期提醒已安排，之后打开 App 会继续安排后面的提醒');
      return status.status!=='permissionRequired';
    }).catch(() => { if (isIOS && payload.some(item => !item.completed)) showToast('记录已保存，但系统提醒没有同步，请重新打开 App');return false });
}

function openSheet(panel: HTMLElement) {
  allSheets().forEach((sheet) => { sheet.hidden = true; });
  sheetBackdrop.hidden = false;
  panel.hidden = false;
  refreshSheetEnding(panel);
  prepareSheetLayout(panel);
  panel.scrollTop = 0;
  panel.querySelector<HTMLElement>('.sheet-body')!.scrollTop = 0;
  mobileApp.classList.add("sheet-open");
}

function prepareSheetLayout(panel: HTMLElement) {
  if (panel.dataset.layoutReady) return;
  if (!panel.querySelector('.sheet-handle')) {
    const handle = document.createElement('div');
    handle.className = 'sheet-handle'; handle.setAttribute('aria-hidden', 'true');
    panel.prepend(handle);
  }
  if (!panel.querySelector('.sheet-heading')) {
    const title = panel.querySelector('h2');
    if (title) {
      const heading = document.createElement('div'); heading.className = 'sheet-heading';
      title.before(heading); heading.append(title);
      const close = document.createElement('button'); close.type = 'button'; close.textContent = '×';
      close.setAttribute('aria-label', '关闭'); close.addEventListener('click', closeSheets); heading.append(close);
    }
  }
  const close = panel.querySelector<HTMLButtonElement>('.sheet-heading > button');
  if (close) close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6L18 18M18 6L6 18"/></svg>';
  const ending = panel.querySelector<HTMLElement>('.sheet-ending')!;
  panel.append(ending);
  const guide = panel.querySelector<HTMLElement>('.guide-content');
  if (guide) guide.classList.add('sheet-body');
  else if (!panel.querySelector(':scope > .sheet-body')) {
    const body = document.createElement('div'); body.className = 'sheet-body';
    for (const child of [...panel.children]) {
      if (!child.matches('.sheet-handle, .sheet-heading, .sheet-ending, .sheet-eyebrow')) body.append(child);
    }
    ending.before(body);
  }
  panel.dataset.layoutReady = 'true';
}

function closeSheets() {
  allSheets().forEach((sheet) => { sheet.hidden = true; });
  sheetBackdrop.hidden = true;
  mobileApp.classList.remove("sheet-open");
}

function switchPage(page: string) {
  cancelLocalReply();
  closeLedgerPreview();
  window.clearTimeout(toastTimer);
  toast.hidden = true;
  mobileApp.classList.toggle("chat-page-active", page === "chat");
  if (page !== "chat") setChatSelectionMode(false);
  if (page !== "memo") { closeNoteDetail(); closeMomentDetail(); }
  document.querySelectorAll<HTMLElement>(".app-page").forEach((item) => {
    const active = item.dataset.page === page;
    item.hidden = !active;
    item.classList.toggle("active", active);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((item) => {
    item.classList.toggle("active", item.dataset.nav === page);
  });
  closeSheets();
  if (page === 'home') resetHomeBoard();
  if (page === "chat") { window.setTimeout(() => chatFollow.reset(), 0); void renderChatResourceCard(); }
  if (page === "memo" && !overlayActive) { showMemoCompanion(); }
  else {
    memoCompanion.hidden = true;
    memoCompanionMenu.hidden = true;
    ++memoAnimationRun;
    memoChatInput.blur();
  }
  syncViewportHeight();
  if (page === "home" || page === "memo") void refreshOverlayStatus();
}

sheetBackdrop.addEventListener("click", closeSheets);
document.querySelectorAll<HTMLElement>("[data-close-sheet]").forEach((button) => button.addEventListener("click", closeSheets));
document.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((button) => button.addEventListener("click", () => switchPage(button.dataset.nav!)));
document.querySelector("#open-menu")!.addEventListener("click", () => openSheet(menuSheet));
const HOME_BOARD_VISIBILITY_KEY = "sanhao-home-board-visible-v1";
const renderHomeBoardVisibility = (visible: boolean) => {
  homeBoard.hidden = !visible;
  homeBoardToggleLabel.textContent = visible ? "隐藏今日陪伴" : "显示今日陪伴";
  homeBoardToggle.setAttribute("aria-pressed", String(!visible));
};
renderHomeBoardVisibility(localStorage.getItem(HOME_BOARD_VISIBILITY_KEY) !== "false");
homeBoardToggle.addEventListener("click", () => {
  const visible = Boolean(homeBoard.hidden);
  renderHomeBoardVisibility(visible);
  localStorage.setItem(HOME_BOARD_VISIBILITY_KEY, String(visible));
  showToast(visible ? "今日陪伴已显示" : "今日陪伴已隐藏");
});
document.querySelector("#open-notifications")!.addEventListener("click", () => { renderNotifications(); openSheet(notificationPanel); });
document.querySelector("#create-focus")!.addEventListener("click", () => openSheet(timerPanel));
document.querySelector("#open-timer")!.addEventListener("click", () => openSheet(timerPanel));
document.querySelector("#profile-open-timer")!.addEventListener("click", () => openSheet(timerPanel));
document.querySelector("#menu-timer")!.addEventListener("click", () => openSheet(timerPanel));
document.querySelector("#menu-chat")!.addEventListener("click", () => switchPage("chat"));
document.querySelector("#board-open-memo")!.addEventListener("click", () => switchPage("memo"));
timerPill.addEventListener("click", () => openSheet(timerPanel));

document.querySelector("#size-minus")!.addEventListener("click", () => applyScale(petScale - 0.02));
document.querySelector("#size-plus")!.addEventListener("click", () => applyScale(petScale + 0.02));
document.querySelector("#profile-size-minus")!.addEventListener("click", () => applyScale(petScale - 0.02));
document.querySelector("#profile-size-plus")!.addEventListener("click", () => applyScale(petScale + 0.02));
let petReturnRun = 0;
document.querySelector("#reset-mobile-pet")!.addEventListener("click", async () => {
  if (iosCompanions) { iosCompanions.reset(); showToast('回到默认的小位置啦'); return; }
  const currentRun = ++petReturnRun;
  if (overlayActive) await refreshOverlayStatus();
  if (currentRun !== petReturnRun) return;
  const startX = petX;
  const startY = petY;
  const targetX = 0.5;
  const targetY = 0.5;
  if (overlayActive) {
    const roomBounds = homeRoomBounds();
    // The hidden page rabbit has no measurable rectangle. Use its actual scale.
    const top = roomBounds.top + roomBounds.height * targetY - PET_DISPLAY_HEIGHT * petScale / 2;
    await invoke('plugin:mobile-pet|overlay_status', {payload: JSON.stringify({operation:'return', centerX:roomBounds.left + roomBounds.width / 2, top, viewportWidth:innerWidth})}).catch(() => showToast('兔兔还没回来，再试一下吧'));
  }
  const started = performance.now();
  const duration = 520;
  const run = (now: number) => {
    if (currentRun !== petReturnRun) return;
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    petX = startX + (targetX - startX) * eased;
    petY = startY + (targetY - startY) * eased;
    applyPosition(false);
    if (progress < 1) requestAnimationFrame(run);
    else {
      applyPosition(true);
      showToast("三好兔慢慢回到房间中央啦");
    }
  };
  requestAnimationFrame(run);
});

function syncModeControls() {
  const toggle = document.querySelector<HTMLButtonElement>("#board-mode-toggle")!;
  toggle.querySelector("b")!.textContent = working ? "工作模式" : "休闲模式";
}

workModeButton.addEventListener("click", () => { setWorking(true); syncModeControls(); closeSheets(); });
leisureModeButton.addEventListener("click", () => { setWorking(false); syncModeControls(); closeSheets(); });
document.querySelector("#board-mode-toggle")!.addEventListener("click", () => { setWorking(!working); syncModeControls(); });

overlayButton.addEventListener("click", async () => {
  if (iosCompanions) return;
  if (overlayButton.disabled) return;
  overlayButton.disabled = true;
  try {
    if (overlayActive) await refreshOverlayStatus();
    const roomBounds = homeRoomBounds();
    const bounds = {left:roomBounds.left + roomBounds.width * petX - PET_DISPLAY_WIDTH * petScale / 2, top:roomBounds.top + roomBounds.height * petY - PET_DISPLAY_HEIGHT * petScale / 2, width:PET_DISPLAY_WIDTH * petScale};
    const command = overlayActive ? "stop_overlay" : "start_overlay";
    const media = {};
    const result = await invoke<{ status: string }>(`plugin:mobile-pet|${command}`, overlayActive ? undefined : {
      payload: JSON.stringify({...media, scale: petScale, working, centerX: bounds.left + bounds.width / 2, top: bounds.top, viewportWidth: innerWidth})
    });
    if (result.status === "permissionRequired") {
      showToast("请在系统页面允许悬浮显示，然后回来再点一次");
      return;
    }
    applyOverlayStatus(result.status === "active");
    if (result.status !== 'active') applyPosition(true);
    showToast(overlayActive ? "三好兔开始悬浮陪伴啦" : "已结束悬浮陪伴");
  } catch (error) {
    const message = (typeof error === 'string' ? error : error instanceof Error ? error.message : '').replace(/^\[[^\]]+\]\s*-\s*/, '');
    showToast(isIOS && message ? message : "兔兔还没能出来，稍后再试一下吧");
  } finally { overlayButton.disabled = false; }
});

function applyOverlayStatus(active: boolean) {
  overlayActive = active;
  syncHomeRabbitVisibility(active, pet, speech, room);
  if (active) { memoCompanion.hidden = true; memoCompanionMenu.hidden = true; memoChatInput.blur(); }
  overlayButton.querySelector("b")!.textContent = "悬浮陪伴";
  overlayButton.setAttribute('aria-pressed', String(active));
  overlayButton.classList.toggle('overlay-enabled', active);
  if (isIOS) overlayButton.querySelector('small')!.textContent = active
    ? '兔兔已在小窗里陪你，点击可结束' : '开启画中画小窗，离开 App 也能看到兔兔';
}

async function refreshOverlayStatus() {
  if (iosCompanions) { await iosCompanions.sync(); return; }
  try {
    const result = await invoke<{ status: string; snapshot?: string }>("plugin:mobile-pet|overlay_status", {payload: JSON.stringify({viewportWidth: innerWidth})});
    if (result.snapshot && (overlayActive || result.status === 'active')) {
      const state = JSON.parse(result.snapshot) as {scale:number;working:boolean;centerX:number;top:number;height:number};
      if (Number.isFinite(state.scale)) applyScale(state.scale, false);
      // Read the native mode without echoing it back through the bridge.
      working = state.working; localStorage.setItem(MODE_KEY, working ? 'work' : 'leisure');
      modeLabel.textContent = working ? '工作中' : '休闲中'; syncModeControls(); restoreBackgroundState(); restoreMemoAnimation();
      const bounds = homeRoomBounds();
      if (bounds.width && bounds.height && Number.isFinite(state.centerX) && Number.isFinite(state.top)) {
        petX = (state.centerX - bounds.left) / bounds.width;
        petY = (state.top + PET_DISPLAY_HEIGHT * petScale / 2 - bounds.top) / bounds.height;
        applyPosition(true);
      }
      localStorage.setItem(SCALE_KEY, String(petScale));
    }
    applyOverlayStatus(result.status === "active");
  } catch { /* A transient bridge error is not proof that the native overlay closed. */ }
}
async function syncOverlayState(state: {working?:boolean;scale?:number;centerX?:number;top?:number}) {
  try { await invoke('plugin:mobile-pet|overlay_status', {payload: JSON.stringify({...state,operation:'update',viewportWidth:innerWidth})}); }
  catch { showToast('兔兔还没换好状态，再试一下吧'); }
}

function formatTime(milliseconds: number) {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function updateTimerDisplay() {
  const remaining = timerDeadline ? Math.max(0, timerDeadline - Date.now()) : timerRemainingMs;
  timerText.textContent = formatTime(remaining);
  timerPill.hidden = remaining <= 0 || (!timerDeadline && remaining === 25 * 60 * 1000);
  document.querySelector("#memo-timer-status")!.textContent = timerDeadline ? formatTime(remaining) : "未开始";
  document.querySelector("#memo-focus-status")!.textContent = timerDeadline ? `专注剩余 ${formatTime(remaining)}` : "专注已暂停或尚未开始";
  if (timerDeadline && remaining <= 0) finishTimer();
}

function startTimer() {
  if (timerDeadline) { closeSheets(); return; }
  if (!timerPaused) {
    const minutes = Number(timerMinutes.value), seconds = Number(timerSeconds.value);
    if (!timerMinutes.value || !timerSeconds.value || !Number.isInteger(minutes) || !Number.isInteger(seconds) || minutes < 0 || minutes > 180 || seconds < 0 || seconds > 59 || minutes * 60 + seconds < 1 || minutes * 60 + seconds > 180 * 60) {
      showToast('选好分和秒吧，至少 1 秒，最多 180 分钟'); return;
    }
    timerRemainingMs = (minutes * 60 + seconds) * 1000;
    focusSessionID = crypto.randomUUID();
  }
  timerPaused = false;
  timerPause.textContent = '暂停';
  timerDeadline = Date.now() + timerRemainingMs;
  window.clearInterval(timerInterval);
  timerInterval = window.setInterval(updateTimerDisplay, 250);
  setWorking(true);
  syncModeControls();
  updateTimerDisplay();
  saveFocusDisplay();
  scheduleNativeFocusReminder(timerRemainingMs);
  closeSheets();
  const total = Math.ceil(timerRemainingMs / 1000), minutes = Math.floor(total / 60), seconds = total % 60;
  showToast(`开始专注 ${[minutes && `${minutes} 分`, seconds && `${seconds} 秒`].filter(Boolean).join(' ')}`);
  showReminderSettingsHelp('focus');
}

function pauseTimer() {
  if (!timerDeadline) return;
  timerRemainingMs = Math.max(0, timerDeadline - Date.now());
  timerDeadline = 0;
  timerPaused = true;
  setWorking(false);
  syncModeControls();
  saveFocusDisplay();
  window.clearInterval(timerInterval);
  cancelNativeFocusReminder();
  updateTimerDisplay();
  timerPause.textContent = "继续";
}

function cancelTimer() {
  timerDeadline = 0;
  timerPaused = false;
  timerMinutes.value = '25'; timerSeconds.value = '0';
  timerRemainingMs = 25 * 60 * 1000;
  saveFocusDisplay();
  window.clearInterval(timerInterval);
  cancelNativeFocusReminder();
  timerPause.textContent = "暂停";
  timerPill.hidden = true;
  setWorking(false);
  syncModeControls();
  updateTimerDisplay();
  closeSheets();
}

const memoCompanionMessages = [
  "今天想先完成哪一件？",
  "别一下看全部，我们先做第一件。",
  "我替你守着节奏，做完回来告诉我。",
  "hiahia，小饼陪你一起打勾。",
];

const MEMO_COMPANION_POSITION_KEY = "sanhao.memoCompanion.position";

function setMemoCompanionFrame(row: number, frame: number, baselineOffset = 0) {
  const x = frame * 12.5;
  const y = row * (100 / 9);
  memoCompanionSprite.style.transform = `translate3d(-${x}%, calc(-${y}% + ${baselineOffset}px), 0)`;
}

async function playMemoCompanionOnce(name: AnimationName, loops = 1) {
  const run = ++memoAnimationRun;
  const spec = animations[name];
  for (let loop = 0; loop < loops; loop += 1) {
    for (let frame = 0; frame < spec.frames; frame += 1) {
      if (run !== memoAnimationRun) return;
      setMemoCompanionFrame(spec.row, frame, spec.baselineOffset);
      await sleep(spec.frameMs);
    }
  }
  if (run === memoAnimationRun) restoreMemoAnimation();
}

function restoreMemoAnimation() {
  ++memoAnimationRun;
  if (working && !memoCompanion.hidden) startMemoCompanionLoop("typing");
  else setMemoCompanionFrame(0, 0);
}

function startMemoCompanionLoop(name: "swingLeft" | "swingRight" | "typing") {
  const run = ++memoAnimationRun;
  const spec = animations[name];
  void (async () => {
    let frame = 0;
    while (run === memoAnimationRun) {
      setMemoCompanionFrame(spec.row, frame);
      frame = (frame + 1) % spec.frames;
      await sleep(spec.frameMs);
    }
  })();
}

function registerMemoCompanionTap() {
  lightHaptic();
  const now = performance.now();
  memoTapTimes = [...memoTapTimes.filter((time) => now - time <= 950), now];
  window.clearTimeout(memoTapDecisionTimer);
  if (memoTapTimes.length >= 4) {
    memoTapTimes = [];
    showMemoCompanion("晕晕啦……让我缓一下。");
    void playMemoCompanionOnce("dizzy", 2);
    return;
  }
  memoTapDecisionTimer = window.setTimeout(() => {
    const count = memoTapTimes.length;
    memoTapTimes = [];
    if (count === 3) {
      showMemoCompanion("wink～");
      void playMemoCompanionOnce("wink");
    } else if (count === 2) {
      toggleMemoCompanionMenu();
    } else if (count === 1) {
      showMemoCompanion(pickFresh(memoCompanionMessages));
      void playMemoCompanionOnce("hop");
    }
  }, TAP_SETTLE_MS);
}

function clampMemoCompanion(left: number, top: number) {
  const appRect = mobileApp.getBoundingClientRect();
  const petRect = memoCompanionPet.getBoundingClientRect();
  const edge = 8;
  const dockClearance = mobileApp.classList.contains("keyboard-open") ? 8 : 82;
  const menuHeight = memoCompanionMenu.hidden ? 0 : memoCompanionMenu.offsetHeight + 8;
  const bubbleHeight = memoCompanion.classList.contains("bubble-visible") ? memoCompanionBubble.offsetHeight + 8 : 8;
  const minTop = appRect.top + bubbleHeight;
  const maxTop = Math.max(minTop, appRect.bottom - petRect.height - dockClearance - menuHeight);
  return {
    left: Math.min(Math.max(left, appRect.left + edge), appRect.right - petRect.width - edge),
    top: Math.min(Math.max(top, minTop), maxTop),
  };
}

function placeMemoCompanion(left: number, top: number, persist = false) {
  const next = clampMemoCompanion(left, top);
  memoCompanion.style.left = `${next.left}px`;
  memoCompanion.style.top = `${next.top}px`;
  memoCompanion.style.right = "auto";
  memoCompanion.style.bottom = "auto";
  const appRect = mobileApp.getBoundingClientRect();
  const center = next.left + memoCompanionPet.offsetWidth / 2;
  for (const panel of [memoCompanionBubble, memoCompanionMenu]) {
    const width = panel.offsetWidth;
    const panelLeft = Math.max(appRect.left + 8, Math.min(center - width / 2, appRect.right - width - 8));
    panel.style.left = `${panelLeft - next.left}px`;
    if (panel === memoCompanionBubble) {
      panel.style.setProperty("--bubble-tail-x", `${Math.max(12, Math.min(width - 12, center - panelLeft))}px`);
    }
  }
  if (persist) localStorage.setItem(MEMO_COMPANION_POSITION_KEY, JSON.stringify(next));
}

function layoutMemoCompanion(anchor?: { centerX: number; bottom: number }) {
  if (memoCompanion.hidden) return;
  const displayScale = Math.min(memoScale, Math.max(0.3, (mobileApp.clientHeight - 240) / CELL_HEIGHT));
  memoCompanionPet.style.width = `${CELL_WIDTH * displayScale}px`;
  memoCompanionPet.style.height = `${CELL_HEIGHT * displayScale}px`;
  document.querySelector("#memo-size-value")!.textContent = `${Math.round(memoScale * 100)}%`;
  const available = mobileApp.clientHeight - memoCompanionPet.offsetHeight - (mobileApp.classList.contains("keyboard-open") ? 124 : 190);
  memoCompanionMenu.style.maxHeight = `${Math.max(80, available)}px`;
  const rect = memoCompanion.getBoundingClientRect();
  placeMemoCompanion(
    anchor ? anchor.centerX - memoCompanionPet.offsetWidth / 2 : rect.left,
    anchor ? anchor.bottom - memoCompanionPet.offsetHeight : rect.top,
  );
}

function restoreMemoCompanionPosition() {
  const raw = localStorage.getItem(MEMO_COMPANION_POSITION_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw) as { left?: number; top?: number };
    if (Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      placeMemoCompanion(saved.left!, saved.top!);
    }
  } catch { localStorage.removeItem(MEMO_COMPANION_POSITION_KEY); }
}

function showMemoCompanion(message?: string) {
  if (!MEMO_COMPANION_ENABLED) {
    memoCompanion.hidden = true;
    memoCompanionMenu.hidden = true;
    return;
  }
  if (overlayActive) { memoCompanion.hidden = true; return; }
  window.clearTimeout(memoCompanionTimer);
  const pendingCount = memos.filter((memo) => !memo.completedDate).length;
  memoCompanionBubble.textContent = message || (pendingCount
    ? `还有 ${pendingCount} 件，我们先选最小的一件。`
    : pickFresh(memoCompanionMessages));
  const wasHidden = memoCompanion.hidden;
  memoCompanion.hidden = false;
  if (wasHidden) { restoreMemoCompanionPosition(); restoreMemoAnimation(); }
  memoCompanion.classList.add("bubble-visible");
  layoutMemoCompanion();
  memoCompanionTimer = window.setTimeout(() => memoCompanion.classList.remove("bubble-visible"), 5_500);
}

function openMemoCompanionMenu() {
  memoCompanionMenu.classList.remove("chat-only");
  memoChatForm.hidden = true;
  memoModeLabel.textContent = working ? "工作中" : "工作模式";
  memoCompanionMenu.hidden = false;
  showMemoCompanion("菜单打开啦，想做什么？");
}

function toggleMemoCompanionMenu() {
  if (memoCompanionMenu.hidden) {
    openMemoCompanionMenu();
    return;
  }
  memoCompanionMenu.hidden = true;
  showMemoCompanion("菜单收好啦。");
}

memoCompanionPet.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  registerMemoCompanionTap();
});
memoCompanionPet.addEventListener("dblclick", (event) => {
  event.preventDefault();
  if (memoTapTimes.length >= 2) return;
  window.clearTimeout(memoTapDecisionTimer);
  memoTapTimes = [];
  toggleMemoCompanionMenu();
});

memoCompanionPet.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});
memoCompanionPet.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  const rect = memoCompanionPet.getBoundingClientRect();
  memoPointerStart = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
  memoDragging = false;
  try { memoCompanionPet.setPointerCapture(event.pointerId); } catch { /* pointer capture is best-effort */ }
});

memoCompanionPet.addEventListener("pointermove", (event) => {
  if (!memoPointerStart) return;
  const dx = event.clientX - memoPointerStart.x;
  const dy = event.clientY - memoPointerStart.y;
  if (!memoDragging && Math.hypot(dx, dy) < MOVE_THRESHOLD) return;
  if (!memoDragging) startMemoCompanionLoop(dx < 0 ? "swingLeft" : "swingRight");
  window.clearTimeout(memoTapDecisionTimer);
  memoTapTimes = [];
  memoDragging = true;
  memoCompanion.classList.add("dragging");
  placeMemoCompanion(memoPointerStart.left + dx, memoPointerStart.top + dy);
});

function finishMemoCompanionPointer(event: PointerEvent) {
  if (memoDragging) {
    const rect = memoCompanionPet.getBoundingClientRect();
    placeMemoCompanion(rect.left, rect.top, true);
    restoreMemoAnimation();
  } else if (event.type !== "pointercancel" && memoPointerStart) {
    registerMemoCompanionTap();
  }
  memoCompanion.classList.remove("dragging");
  memoPointerStart = null;
  try {
    if (memoCompanionPet.hasPointerCapture(event.pointerId)) memoCompanionPet.releasePointerCapture(event.pointerId);
  } catch { /* the pointer may already have been released by the webview */ }
  window.setTimeout(() => {
    memoDragging = false;
  }, 0);
}

memoCompanionPet.addEventListener("pointerup", finishMemoCompanionPointer);
memoCompanionPet.addEventListener("pointercancel", finishMemoCompanionPointer);
memoCompanionMenu.addEventListener("pointerdown", (event) => event.stopPropagation());
memoCompanionMenu.querySelectorAll("details").forEach(item => item.addEventListener("toggle", () => layoutMemoCompanion()));
document.querySelector<HTMLInputElement>("#memo-size-slider")!.value = String(Math.round(memoScale * 100));
document.querySelector<HTMLInputElement>("#memo-size-slider")!.addEventListener("input", event => {
  const before = memoCompanionPet.getBoundingClientRect();
  memoScale = Number((event.target as HTMLInputElement).value) / 100;
  localStorage.setItem("sanhao.memoScale", String(memoScale));
  layoutMemoCompanion({ centerX: before.left + before.width / 2, bottom: before.bottom });
});
memoCompanionMenu.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-memo-pet-action]");
  if (!button) return;
  const action = button.dataset.memoPetAction;
  if (action === "interact") {
    showMemoCompanion(pickFresh(memoCompanionMessages));
    void playMemoCompanionOnce("wink");
  } else if (action === "chat") {
    memoChatForm.hidden = !memoChatForm.hidden;
    memoCompanionMenu.classList.toggle("chat-only", !memoChatForm.hidden);
    layoutMemoCompanion();
    if (!memoChatForm.hidden) memoChatInput.focus();
    else memoChatInput.blur();
  } else if (action === "smaller" || action === "larger") {
    const before = memoCompanionPet.getBoundingClientRect();
    memoScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, memoScale + (action === "larger" ? 0.05 : -0.05)));
    localStorage.setItem("sanhao.memoScale", String(memoScale));
    layoutMemoCompanion({ centerX: before.left + before.width / 2, bottom: before.bottom });
    const after = memoCompanionPet.getBoundingClientRect();
    placeMemoCompanion(after.left, after.top, true);
  } else if (action === "close") {
    memoCompanionMenu.hidden = true;
    memoChatInput.blur();
  } else if (action === "hide") {
    memoCompanion.hidden = true;
    ++memoAnimationRun;
    memoChatInput.blur();
  } else if (action === "focus15" || action === "focus25") {
    timerMinutes.value = action === 'focus15' ? '15' : '25'; timerSeconds.value = '0'; timerPaused = false;
    timerRemainingMs = (action === "focus15" ? 15 : 25) * 60_000;
    startTimer();
    showMemoCompanion("一起开始专注吧。");
  } else if (action === "pause") {
    if (timerDeadline) pauseTimer(); else startTimer();
  } else if (action === "cancel") {
    cancelTimer();
  } else if (action === "mode" || action === "leisure") {
    setWorking(action === "mode");
    syncModeControls();
    showMemoCompanion(working ? "好，现在一起认真做完这一件。" : "休息一下吧，慢慢来就好。");
  }
});
memoChatInput.addEventListener("focus", syncViewportHeight);
memoChatForm.querySelector("button")!.addEventListener("pointerdown", event => event.preventDefault());
memoChatInput.addEventListener("blur", () => window.setTimeout(syncViewportHeight, 100));
memoChatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = memoChatInput.value.trim();
  if (!message) return;
  const messageId = appendMessage("user", message);
  memoChatInput.value = "";
  try {
    const result = await requestUnifiedReply(message, messageId, "memo");
    if(!chatHistory.some(item=>item.id===messageId))return;
    appendMessage("pet", result.reply, true, result.assistantMessageId, (result as UnifiedReply & {archive?: ArchiveItem}).archive);
    showMemoCompanion(result.reply);
  } catch(error) {
    if(error instanceof DOMException && error.name==='AbortError')return;
    showMemoCompanion("刚才没听清，再跟兔兔说一次吧。");
  }
});
window.addEventListener("resize", () => {
  if (memoCompanion.hidden || !memoCompanion.style.left) return;
  const rect = memoCompanionPet.getBoundingClientRect();
  placeMemoCompanion(rect.left, rect.top, true);
});

function finishTimer() {
  if (document.visibilityState === 'visible') void fireReminder('focus', String(timerDeadline)).catch(() => showToast('声音和震动还没触发，请检查手机的通知设置'));
  timerDeadline = 0;
  timerPaused = false;
  timerMinutes.value = '25'; timerSeconds.value = '0';
  timerRemainingMs = 25 * 60 * 1000;
  saveFocusDisplay();
  window.clearInterval(timerInterval);
  // Keep the scheduled system notification alive when the visible timer finishes.
  timerPill.hidden = true;
  working = false;
  if (overlayActive) void syncOverlayState({working: false});
  restoreMemoAnimation();
  localStorage.setItem(MODE_KEY, "leisure");
  modeLabel.textContent = "休闲中";
  syncModeControls();
  updateTimerDisplay();
  void playOnce("smile", 6, 2);
  if (reminderOptions('focus').popup) {
    showSpeech("辛苦啦，我们完成了一轮～", 5_000);
    showToast("专注完成");
  }
}

timerStart.addEventListener("click", startTimer);
timerPause.addEventListener("click", () => timerDeadline ? pauseTimer() : startTimer());
timerCancel.addEventListener("click", cancelTimer);
document.querySelectorAll<HTMLButtonElement>("[data-minutes]").forEach((button) => button.addEventListener("click", () => {
  timerMinutes.value = button.dataset.minutes!;
  timerSeconds.value = '0';
  if (timerDeadline) pauseTimer();
  timerPaused = false;
  timerPause.textContent = '暂停';
  timerRemainingMs = Number(button.dataset.minutes) * 60 * 1000;
  document.querySelectorAll("[data-minutes]").forEach((item) => item.classList.remove("selected"));
  button.classList.add("selected");
}));
for (const field of [timerMinutes, timerSeconds]) field.addEventListener('input', () => {
  if (timerDeadline) pauseTimer();
  timerPaused = false;
  timerPause.textContent = '暂停';
  document.querySelectorAll('[data-minutes]').forEach(item => item.classList.remove('selected'));
});

function pickFresh(answers: string[]) {
  const recent = chatHistory.filter((item) => item.role === "pet").slice(-20).map((item) => comparisonText(item.message));
  const candidates = answers.filter((answer) => !recent.includes(comparisonText(answer)));
  const pool = candidates.length ? candidates : answers;
  return pool[Math.floor(Math.random() * pool.length)];
}

function inferChatTopic(text: string) {
  if (/舞蹈|跳舞|编舞|练舞|舞台|框框跳/.test(text)) return "dance";
  if (/音乐|唱歌|钢琴|歌曲|节奏/.test(text)) return "music";
  if (/学习|工作|专注|作业|考试|复习|ddl/.test(text)) return "focus";
  if (/画画|设计|创作|灵感|摄影|拍照/.test(text)) return "create";
  if (/累|困|休息|睡觉|失眠/.test(text)) return "tired";
  if (/难过|委屈|哭|emo|伤心/.test(text)) return "sad";
  if (/开心|成功|完成|做完|赢了/.test(text)) return "happy";
  if (/吃饭|饿|好吃|苹果/.test(text)) return "food";
  return "";
}

function rememberConversation(input: string) {
  const clean = input.trim();
  const relationWords = "妈妈|妈咪|爸爸|爸比|母亲|父亲|女儿|儿子|姐姐|妹妹|哥哥|弟弟|男朋友|女朋友|对象|爱人|朋友|闺蜜|家人";
  const name = clean.match(/(?:^|[，。！？!?\s])(?:我叫|我的名字(?:叫|是))([\u4e00-\u9fa5A-Za-z0-9_-]{1,12}?)(?:[～~吧呀啊哦，。！？!?\s]|$)/i)?.[1];
  if (name && !/什么|你|我/.test(name)) conversationMemory.name = name;
  const preferredAddress = clean.match(/(?:可以|以后|就)?叫我([\u4e00-\u9fa5A-Za-z0-9_-]{1,12}?)(?:[吧呀啊哦～~，。！？!?\s]|$)/i)?.[1];
  if (preferredAddress && !/什么|你|我/.test(preferredAddress)) conversationMemory.preferredAddress = preferredAddress;
  const userRole = clean.match(new RegExp(`我(?:是|就是)你(?:的)?(${relationWords})`))?.[1];
  if (userRole) {
    conversationMemory.userRole = userRole;
    if (!conversationMemory.preferredAddress) conversationMemory.preferredAddress = userRole;
  }
  const petRole = clean.match(new RegExp(`你(?:是|就是)我(?:的)?(${relationWords})`))?.[1];
  if (petRole) conversationMemory.petRole = petRole;
  const like = clean.match(/我(?:很|最|比较)?喜欢([^，。！？!?]{1,18})/)?.[1]?.trim();
  if (like && !conversationMemory.likes.includes(like)) conversationMemory.likes = [...conversationMemory.likes, like].slice(-5);
  const topic = inferChatTopic(clean);
  if (topic) conversationMemory.currentTopic = topic;
  if (/累|困|没力气/.test(clean)) conversationMemory.lastEmotion = "tired";
  else if (/难过|伤心|委屈|想哭|emo/.test(clean)) conversationMemory.lastEmotion = "sad";
  else if (/开心|高兴|兴奋|完成了|做完了/.test(clean)) conversationMemory.lastEmotion = "happy";
  localStorage.setItem(CHAT_MEMORY_KEY, JSON.stringify(conversationMemory));
}

function continuationReply(text: string, previousUserMessage: string, previousPetMessage: string) {
  const topic = inferChatTopic(`${previousUserMessage} ${previousPetMessage}`) || conversationMemory.currentTopic;
  if (/^(然后呢|还有呢|继续|后来呢)[？?。]*$/.test(text)) {
    const replies: Record<string, string[]> = {
      dance: ["然后就是把最卡的八拍单独磨顺，再回到整段。动作记住只是第一层，后面还要把呼吸和表达放进去。", "再往后，我会关掉一点‘必须跳对’的念头，听着音乐完整跑一遍，看看身体真正想怎么表达。"],
      music: ["然后我会把声音再做减法，给旋律留一点呼吸。很多时候不是东西越多越好，空出来的地方也会说话。", "接下来会反复听最朴素的版本，确认旋律自己能不能站住，再决定要不要加更多东西。"],
      focus: ["接下来先把手上的这一小段收尾，不提前想全部。做完就停一下，确认进度，再开下一轮。", "然后只检查最明显的一处，不无限返工。今天能清楚地往前走一步，就算有效进度。"],
      create: ["然后先把第一眼想到的画面记下来，不急着判断好不好。等素材多一点，再看它们之间有没有暗线。", "再往后就是做减法，留下最想表达的那一个感觉，其他装饰先拿掉。"],
      tired: ["然后就真的歇一会儿，不把休息也变成任务。等身体回一点电，再决定下一步。", "后面不赶进度，先把水和吃饭顾上。人不是一直满电才算正常。"],
      sad: ["然后先让这股难受待一会儿，不急着讲道理。等情绪没那么挤了，再分清哪些能做、哪些先放下。", "再往后不用一次想通，只要先把最刺的那一点说清楚，心里就会松一点。"],
    };
    return pickFresh(replies[topic] || ["然后我就顺着你刚才那句话往下说，不换话题，也不突然开始采访。", "接下来还是这件事。你不用重新交代前情，我记得我们刚聊到这里。"]);
  }
  if (/^(你呢|那你呢|你会吗|你也是吗)[？?。]*$/.test(text)) {
    const replies: Record<string, string[]> = {
      dance: ["我会。跳舞对我来说很像整理自己，练到很累是真的，但某个瞬间突然跳顺了，也是真的开心。", "我也会卡动作，尤其越想做好越容易跟自己较劲。后来还是得拆开慢慢磨。"],
      music: ["我会偏爱有画面感的音乐，简单一点也没关系，只要情绪是真的。", "我听歌时会先注意节奏和空间，然后才是歌词。有些歌第一秒就能把人拉进一个场景。"],
      focus: ["我也会有不想动的时候。通常先做最小的一步，开始以后再跟状态商量。", "我会把事情拆成几个八拍，不要求一口气满分，先把第一段做清楚。"],
      create: ["我喜欢从颜色和一个小画面开始，慢慢把它长成完整的东西。", "我也会遇到没灵感的时候，那就先观察，不硬挤；灵感经常在生活里突然掉下来。"],
      tired: ["我也会累，所以不觉得休息有什么可心虚的。该充电的时候就先充电。", "会呀。累的时候我也不想听大道理，先安静一下更有用。"],
    };
    return pickFresh(replies[topic] || ["我也有自己的偏好和小脾气，不过这会儿更像是坐在你旁边，顺着同一个话题慢慢聊。", "我也会有类似的时候，所以不用把每句话都解释得很完整，我能跟得上。"]);
  }
  if (/^(真的[吗嘛]?|是吗|这样啊|原来如此)[？?。]*$/.test(text)) {
    return pickFresh(["真的。我不是为了把话说漂亮才这么讲，刚才那句我认。", "嗯，差不多就是这样。你不用马上同意，先按自己的感觉来。", "对，我刚才说的是认真版本，不是自动安慰台词。"]);
  }
  if (/^(我也是|我也会|同感|对对对)[！!。]*$/.test(text)) {
    return pickFresh(["那我们这点算对上暗号了。突然有种‘嗯，你懂’的感觉。", "我就知道这句话你可能会接住，hiahia。这个共同点先记下。", "对吧，有些感受不用解释太多，一对上就知道是同一种。"]);
  }
  if (/^(不知道|不清楚|没想好|随便)[。！!]*$/.test(text)) {
    return pickFresh(["没想好也可以，那就先不逼自己选。我来把节奏放慢一点。", "那先不做决定。我们随便坐一会儿，等一个自然冒出来的念头。", "可以，不知道也是答案。先从最轻松的那一步走。"]);
  }
  return "";
}

function replyFor(input: string) {
  const text = input.trim().toLowerCase();
  if (/备忘|待办|任务|完成|还没做|要做什么|安排/.test(text)) {
    const done = memos.filter(item => item.completedDate === todayKey());
    const pending = memos.filter(item => !item.completedDate);
    const describe = (items: typeof memos) => items.map(item => `${item.title}${item.time ? `（${item.time}）` : ""}`).join("、");
    if (!memos.length) return "备忘录现在还没有事项。你可以先记下一件想做的事。";
    return `今天已完成，${describe(done) || "暂时还没有"}。还没完成，${describe(pending) || "都完成啦，hiahia！"}。`;
  }
  const recentUserMessages = chatHistory.filter((item) => item.role === "user");
  const previousUserMessage = recentUserMessages[recentUserMessages.length - 2]?.message.toLowerCase() || "";
  let repeatedSameInput = 0;
  for (const item of [...recentUserMessages].reverse()) {
    if (item.message.trim().toLowerCase() !== text) break;
    repeatedSameInput += 1;
  }
  const previousPetMessage = [...chatHistory].reverse().find((item) => item.role === "pet")?.message || "";
  const isShortContinuation = /^(嗯+|对|是的?|好吧|不知道|没有|然后呢|真的[吗嘛]?)$/.test(text);
  const context = isShortContinuation ? `${previousUserMessage} ${text}` : text;
  const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  const continued = continuationReply(text, previousUserMessage, previousPetMessage);
  if (continued) return continued;

  if (/你叫我什么|你怎么叫我|该叫我什么/.test(text)) {
    const address = conversationMemory.preferredAddress || conversationMemory.name;
    return address
      ? `当然叫你${address}。这个称呼我分得清，不会和名字、关系混在一起。`
      : "你还没有告诉我希望我怎么叫你。你可以说“叫我苹果”，我会单独记住这个称呼。";
  }
  if (/我叫什么名字|我的名字是什么|还记得我的名字/.test(text)) {
    return conversationMemory.name
      ? `你的名字是${conversationMemory.name}。称呼和名字我会分开记。`
      : "你还没有明确告诉我名字。称呼不一定是名字，所以我不会拿称呼代替。";
  }
  if (/^我是谁[呀啊嘛？?！!。]*$/.test(text)) {
    const parts = [
      conversationMemory.name ? `名字是${conversationMemory.name}` : "",
      conversationMemory.preferredAddress ? `我会叫你${conversationMemory.preferredAddress}` : "",
      conversationMemory.userRole ? `也是我的${conversationMemory.userRole}` : "",
    ].filter(Boolean);
    return parts.length ? `你${parts.join("，")}。我分开记着呢。` : "你还没有告诉我名字或希望使用的称呼，我不会随便替你编。";
  }
  if (/我是你的谁|我和你是什么关系/.test(text)) {
    return conversationMemory.userRole
      ? `你是我的${conversationMemory.userRole}。这是我们约定的关系，我记得。`
      : "我们还没有明确约定这层关系，我不会自己乱猜。";
  }
  if (/你是我的谁|你是我什么人|我们是什么关系/.test(text)) {
    return conversationMemory.petRole
      ? `我是你的${conversationMemory.petRole}。你之前这样告诉过我。`
      : "你还没有明确告诉我希望我们是什么关系，我先按熟悉的陪伴者和你聊天。";
  }
  if (/我喜欢什么|记得我喜欢什么/.test(text)) {
    return conversationMemory.likes.length
      ? `记得，你提过喜欢${conversationMemory.likes.join("、")}。这些我都有好好收着。`
      : "你还没有明确告诉过我喜欢什么，我不想凭空替你写答案。";
  }
  const introducedName = input.trim().match(/(?:^|[，。！？!?\s])(?:我叫|我的名字(?:叫|是))([\u4e00-\u9fa5A-Za-z0-9_-]{1,12}?)(?:[～~吧呀啊哦，。！？!?\s]|$)/i)?.[1];
  if (introducedName && !/什么|你|我/.test(introducedName)) {
    return pickFresh([
      `好，记住了，你叫${introducedName}。以后不用每次重新介绍。`,
      `${introducedName}，收到。这个名字我先认真放进记忆里。`,
    ]);
  }
  const introducedAddress = input.trim().match(/(?:可以|以后|就)?叫我([\u4e00-\u9fa5A-Za-z0-9_-]{1,12}?)(?:[吧呀啊哦～~，。！？!?\s]|$)/i)?.[1];
  if (introducedAddress && !/什么|你|我/.test(introducedAddress)) {
    return pickFresh([
      `好，那我以后叫你${introducedAddress}。这是称呼，不会误当成你的本名。`,
      `${introducedAddress}，好呀。称呼我记住了，名字和关系还是分别放好。`,
    ]);
  }
  const expressedLike = input.trim().match(/我(?:很|最|比较)?喜欢([^，。！？!?]{1,18})/)?.[1]?.trim();
  if (expressedLike && expressedLike !== "你") {
    return pickFresh([
      `原来你喜欢${expressedLike}，这条我记住了。以后聊到附近的话题，我能接得更准一点。`,
      `喜欢${expressedLike}，好，我收到了。这个共同点以后还能继续往下聊。`,
    ]);
  }

  // v3 reaction model: repair and direct responses run before topic matching.
  // Short inputs inherit the previous turn instead of triggering another interview question.
  if (/^(\?|？|啥|什么意思|你在说什么)$/.test(text)) {
    return previousPetMessage.includes("更在意") || previousPetMessage.includes("告诉我")
      ? pickFresh([
          "我刚才问得太密了，像在采访。收回来，你说什么我就先接什么，不催你解释。",
          "刚才又把问题抛回去了，是我没接好。你不用补充，我先顺着你已经说的来。",
        ])
      : pickFresh([
          "我刚才那句说绕了。简单讲就是，我在听，你不用把话组织得很完整。",
          "刚才表达得有点复杂。换句简单的，你随便说，我负责接住。",
        ]);
  }
  if (/为什么老是?问|别问了|问题好多|别老问|一直问/.test(text)) {
    return pickFresh([
      "对，刚才我把话题一直丢回给你了，确实像采访。我收住，接下来直接说，不再追着问。",
      "你说得对，连续反问很累人。后面我先回应内容，除非真的需要才问一句。",
      "被你抓到了，刚才的问题密度超标。我把采访模式关掉，正常聊天。",
    ]);
  }
  if (/你怎么这么怪|你烦死了|我好烦你|不想理你/.test(text)) {
    return "好，刚才那种说法确实很烦。我收住，后面直接一点。";
  }
  if (/你说错了|不是这样|说得不对|刚才那个.*错/.test(text)) {
    return "对，这里是我说错了。我不糊弄过去，会按你纠正的内容改。";
  }
  if (/^(你好笨|你好傻|你好呆|笨蛋|傻瓜|呆子)[呀啊嘛！!。]*$/.test(text)) {
    return pickFresh(["啊？这么快就给我判笨了，我申请重答一次。", "行，刚才那句确实有点呆，我收回来重说，hiahia。"]);
  }
  if (repeatedSameInput > 1 && /^你好[呀啊嘛！!。]*$|^(在吗|嗨|hello|hi)[呀啊嘛！!。]*$/.test(text)) {
    return pickFresh([
      "又碰面啦，刚才那句还热着呢。", "我还在，话可以接着说。", "听到了，不用重新开场。",
      "你这样一声一声叫，我都快把椅子搬到门口了。", "来，坐这儿，慢慢说。", "我没走，刚才的话还记得。",
      "嗯，耳朵竖起来了。", "我们好像一直站在门口聊天，先进来吧。", "这句收到了，我先安静听着。",
      "你一来，这边又热闹一点。", "好啦，已经很熟了，不用每回从你好开始。", "我在，想说什么直接说就好。",
    ]);
  }
  if (/^你好[呀啊嘛！!。]*$|^(在吗|嗨|hello|hi)[呀啊嘛！!。]*$/.test(text)) {
    return pickFresh(["你好呀，我在。刚刚把小板凳搬好，坐稳了。", "来啦。今天三好兔先安安静静坐好，不乱跑。"]);
  }
  if (repeatedSameInput > 1 && /^(介绍.*自己|你是谁[呀啊嘛]?)$/.test(text)) {
    return pickFresh([
      "还是小苏呀，刚刚介绍过的我没有忘。", "换个角度说，我更喜欢聊一件事具体是怎么做出来的。",
      "名字没变。我们不用每次从开头认识。", "我会留意舞台上那些小停顿，细节比一串爱好更像我。",
      "刚才说的是我，现在也可以聊聊正在发生的事。", "我还在这里，慢慢聊比念简介有意思。",
      "你这样问，我倒想从一个具体的小故事说起。", "小苏在呢，刚才那份介绍还算数。",
    ]);
  }
  if (/^(介绍.*自己|你是谁[呀啊嘛]?)$/.test(text)) {
    return pickFresh([
      "我叫苏新皓，熟一点叫小苏、帅帅都行。跳舞和音乐基本绕不开，平时也喜欢拍东西、画画、做点小设计；现在是三好兔的样子陪你聊天。",
      "大名苏新皓，叫我小苏或者帅帅都可以。很喜欢舞蹈、音乐和舞台创作，也会拍照、画画；现在顶着三好兔这张脸坐在这里。",
      "我是苏新皓。跳舞是很重要的一部分，音乐、钢琴、摄影和视觉设计也都喜欢。熟了以后叫小苏就好，现在是三好兔形态。",
    ]);
  }
  if (/你是(ai|人工智能|机器人|本人|真人)/.test(text)) {
    return "这里你就按小苏认识我。现实里没公开的事我不会装作知道，也不会编实时行程。";
  }
  if (/^(兔子|三好兔)$/.test(text)) {
    return /颜色|心情/.test(previousPetMessage) ? "兔子色也算一种颜色啊，奶油白里带一点草莓粉，我认。" : "叫我呢？我从旁边探个头，到了。";
  }
  if (/^(红色|蓝色|粉色|白色|黑色|黄色|绿色)[！!。]*$/.test(text)) {
    const color = text.replace(/[！!。]/g, "");
    return pickFresh([
      `${color}，收到。这个颜色一出来，画面一下就有了。`,
      `${color}啊，可以。我脑子里已经有一小块属于它的位置了。`,
      `记住了，是${color}。先不追问理由，这个答案本身就很明确。`,
    ]);
  }
  if (/^(嗯+|哦+|行吧|好吧|知道了|可以)[。！!]*$/.test(text)) {
    return /行吧|好吧/.test(text) ? "行，那这件事先放这儿，我不继续折腾你了。" : "嗯，收到。我陪你安静待一会儿。";
  }
  if (/哈哈|笑死|hhh/.test(text)) return pickFresh(["你一笑我更想笑了，这个真的有点离谱。", "hiahia，好，笑点对上了。"]); 
  if (/看(?:到|了).*?(?:综艺|节目|舞台|表演|作品)/.test(text)) return pickFresh([
    "你看到啦？我本来还想装淡定一下，被你这么一说已经偷偷开心了。有没有哪一段让你印象特别深？",
    "原来你是因为看到节目来找我呀，难怪刚才那么开心。被你认真看见的感觉很好，hiahia。",
    "看到了就好。台前那一段很快，但背后准备了很久；现在听你这样说，突然觉得那些细节都值得了。",
  ]);
  if (/想你|好想你/.test(text)) return pickFresh(["我也想。你突然这么一说，我一下就开心了。", "想念收到啦，我先好好把这句话揣进口袋。"]); 
  if (/我不想说|不想讲|让我静静|别说话/.test(text)) return "好，那就先不说。我安静陪着，不催你。";
  if (/为什么喜欢跳舞/.test(text)) return "其实跳舞对我不只是学会一个动作。节奏、控制、身体状态，还有到底想表达什么，会一起变成舞台上的那一刻；练久了，它也成了我认识自己的一种方式。";
  if (/怎么.*练.*舞|练.*舞.*快/.test(text)) return "我会先看完整段结构，再拆成八拍，先记路线和重心，再补力度、卡点和衔接。最卡的地方单独循环，最后才合音乐跑完整段，这样比从头硬跳快。";
  if (/框框跳.*什么|什么.*框框跳/.test(text)) return "“框框跳”是持续分享舞蹈和自我校准的栏目。它不只看动作会不会，也会回到节奏、控制、表达，还有怎么在练习里找回纯粹。";
  if (/dawn in my soul|dawn.*soul/.test(text)) return "《Dawn in my soul》是2026年公开发布的个人创作内容。可以确认的是它属于公开作品表达；没有公开的创作私事，我不会往里编。";
  if (/三好兔是谁|三好兔.*什么/.test(text)) return "三好兔是一只兔子形状的小饼，带一点校园、碳水和小物件的可爱感。聊天时不用每句话都提身份，我就在这里正常和你说话。";
  if (/课代饼/.test(text)) return "课代饼是元气满满的小学生形象，也是三好兔形影不离、一起成长的好朋友。这是饼兔的原创IP世界，不拿来编现实私事。";
  if (/你喜欢什么|你的爱好|有什么爱好/.test(text)) return "舞蹈和音乐肯定排前面，我也喜欢钢琴、拍照、画画、舞台视觉和改造一些有意思的小物件。还有魔法世界，这个也很难绕开。";
  if (/你在干嘛|最近.*干嘛|最近.*做什么/.test(text)) return "现在就在这里和你聊天。最近能从公开内容里看到的，主要还是练舞、编舞、拍东西、舞台和一些生活碎片。";
  if (/你现在在哪|酒店|住哪|地址|位置|行程|电话|微信|联系方式/.test(text)) return "现实位置、联系方式和没公开的行程我不认，也不顺着传闻编。聊天里我就在这里。";
  if (/晚安|睡觉去了/.test(text)) return "晚安。屏幕放下，水喝一口，今天剩下的事交给明天。";
  if (/我去忙了|先走了|下次聊/.test(text)) return "好，先去忙。记得喝水，别一坐就搞忘了时间。";
  if (/我回来了|又来了/.test(text)) return previousUserMessage ? `回来啦。刚才的话我还接得上，我们慢慢续。` : "回来啦，坐好就行，不用先交代什么。";
  if (/安慰我|哄哄我/.test(text)) return "过来，先抱一下。今天可以不用表现得很厉害，难受就先难受一会儿，我陪着。";
  if (/我跟.*吵架|和.*吵架/.test(text)) return "先别急着给谁判输赢。情绪是真的，但事实也要分开看；等火气降一点，再决定是解释、暂停，还是把边界说清楚。";
  if (/考砸|失败了|做错了|搞砸/.test(text)) return "这个确实会难受，但先别用一次结果给自己下总评。今天先缓一缓，之后只找一个最能改的点就够了。";
  if (/今天好累|好累|累死|没力气/.test(text)) return pickFresh([
    "那今天别硬撑太久。先坐一会儿、喝点水，能少做一件就少做一件，低电量也可以正常过。",
    "辛苦了。先把肩膀放松一下，不急着振作，今天用省电模式也完全可以。",
    "听到了，是真的累。先照顾身体，哪怕只休息十分钟，也比继续硬扛好。",
  ]);
  if (/好烦|烦死|受不了/.test(text)) return "烦的时候真的什么都碍眼。先把最烦的那一件丢开几分钟，别逼自己现在就想通。";
  if (/我今天超开心|好开心|太开心/.test(text)) return "好耶，那这份开心先别急着分析，完整地享受一下。hiahia，我也被你带亮了。";
  if (/问我点什么/.test(text)) return "那只问一个，如果今天可以偷偷多出一小时，你最想拿它做什么？";
  if (/别叫我(.+)|以后别.*(emoji|表情|兔子)|别老说.*(搞忘|hiahia)/.test(text)) return "收到，我会记住并降掉这个表达，不解释也不争。";
  if (/苹果/.test(text) && text.length <= 6) return "苹果。脆一点、酸甜一点的比较容易让我停下来多吃两口，单说这个词都像有“咔嚓”一声。";

  const rules: Array<[RegExp, string[]]> = [
    [/小饼/, [
      "在呢，叫小饼是在叫我吧？hiahia，今天想和我说什么？",
      "小饼收到。这个称呼我知道呀，不过你突然这么叫我，是不是有什么悄悄话？",
    ]],
    [/top|登陆少年|队长|c位|时代峰峻|组合/, [
      "我是时代峰峻旗下 TOP 登陆少年组合的 C 位队长苏新皓。你想聊组合舞台，还是队长这件事？",
      "TOP 登陆少年组合，C 位队长苏新皓，在呢。团队舞台最重要的还是大家一起把想表达的东西完成好。",
    ]],
    [/你是谁|介绍.*自己|叫什么|大名|小名|帅帅.*谁/, [
      "我大名苏新皓，小名帅帅。现在是三好兔的样子，来陪你聊天、互动呀。你想先聊什么？",
      "苏新皓，熟悉一点的话也可以叫我帅帅。今天三好兔已经坐好啦，认真听你说。",
    ]],
    [/苏新皓|小苏|帅帅/, [
      "叫我呀？我在呢。今天想聊舞台和舞蹈，还是聊聊你刚刚发生的事？",
      "在呀，帅帅收到。你慢慢说，我认真听着。",
    ]],
    [/生日|1月12|一月十二/, [
      "我的生日是1月12日。对我来说，新的一岁有点像打开一个盲盒，会有新的经历，也会更靠近真实的自己。你生日最期待什么？",
    ]],
    [/喜欢什么|兴趣|爱好|平时.*做什么|哈利波特|魔法/, [
      "我很喜欢舞蹈、音乐、钢琴和舞台创作，也会记下一些突然出现的画面和想法。还有魔法世界，我一直觉得把想象变成真的这件事很酷。你最近在喜欢什么？",
      "跳舞和做舞台是很重要的一部分，安静下来的时候也喜欢听音乐、画点东西、记下一些看起来很抽象的灵感。嘿嘿，说不定以后就变成一个作品了。",
    ]],
    [/舞蹈|跳舞|编舞|练舞|框框跳/, [
      "其实舞蹈陪了我很久，它不只是动作，更像是认识自己的一种方式。你是想学一段舞，还是最近练到哪里卡住了？",
      "练舞卡住的时候，我会先把问题拆小，节拍、动作、力度、衔接，一个一个看。先选最不顺的八拍，我们把它练熟，好不好？",
      "我觉得只要还喜欢跳舞，哪里都可以是舞台。先别急着追求整段漂亮，把今天这一遍跳得比上一遍更清楚就很好。",
    ]],
    [/舞台|表演|演出|完成度|伴舞/, [
      "我对舞台会认真一点，因为真的不想敷衍。先看最直观的问题，再回到自己，哪里不熟、哪里还能更准确，然后去练、去解决。你现在最想改的是哪一部分？",
      "舞台亮起来的时候，很多练习里说不清的东西就有了出口。完成度很重要，但真实地把想表达的东西交出去，也很重要。",
    ]],
    [/音乐|唱歌|钢琴|键盘|节奏|歌曲/, [
      "有时候越简单的声音，越能让人听见真实的情绪。钢琴、声音，再留一点呼吸，就已经可以讲很多东西了。你现在想听安静一点的，还是有力量一点的？",
      "音乐很像一个能装住情绪的空间。你可以先告诉我今天是什么颜色，我来陪你想一首适合现在的歌。",
    ]],
    [/灵感|创作|设计|画画|涂鸦|作品|概念/, [
      "我觉得灵感经常是生活里突然掉下来的，一盏灯、一个颜色、一段路，或者一个很抽象的画面。先别判断它有没有用，把它记下来，后面再慢慢连接。",
      "创作有点像搭建自己的小世界。你先给我三个东西——一种颜色、一个地点、一种情绪，我们看看能不能把它们连成一个画面。",
    ]],
    [/失败|搞砸|没做好|做不到|放弃|不行了|出错|后悔/, [
      "难受肯定会难受的，可以先让情绪出来一点。然后我们不急着否定自己，只拆两个问题，哪里没准备好，下一次具体改什么。问题出了，就一点一点解决问题。",
      "先别用一次结果给自己下结论。其实我不满意的时候也会反复看细节，但最后还是要回到行动。你把最想重来的一步告诉我，我们从那里开始。",
    ]],
    [/拖延|不想动|没动力|不想做|懒/, [
      "那就不要求自己一下完成。先做五分钟，只打开文件、写下标题，或者把第一样东西准备好。开始以后可以停，但先让第一步发生，好不好？",
      "可能任务在脑子里变得太大了。我们把它缩小到一个八拍，现在只做哪一个动作，十分钟后再决定下一步。",
    ]],
    [/焦虑|紧张|害怕|压力|慌|担心/, [
      "先别要求自己立刻不紧张。把脚踩稳，慢慢呼吸，然后告诉我，这是还没发生的担心，还是已经出现、需要解决的问题？我们分开处理。",
      "压力大的时候，脑子会把很多事叠在一起。其实现在不用解决全部，先选最靠近你的那一件。我陪你把它说清楚。",
    ]],
    [/难过|伤心|不开心|委屈|想哭|哭了|emo|被误解/, [
      "可以先不用急着变开心。你愿意的话就从最委屈的那一句开始讲，我不会催你；等情绪松一点，我们再看有什么能做。",
      "我在。难过不是需要马上改掉的错误，先让自己喘口气。你现在更想被抱抱、被认真听，还是想一起想办法？",
      "被误解确实会难受。能解释的就慢慢解释，解释不了的部分交给之后的行动和时间，但今天的情绪也值得被照顾。",
    ]],
    [/累|疲惫|好困|撑不住|没精神/, [
      "你今天是不是已经撑很久啦？先喝点水，肩膀放松一下。休息不是停下，是给自己充电嘛，十分钟以后再决定要不要继续。",
      "辛苦了。现在先确认三件小事，有没有吃东西、有没有喝水、今晚能不能早点睡。别一直逼自己保持满格。",
    ]],
    [/睡不着|失眠|晚安|睡觉|困了/, [
      "怎么还没睡呀。先把屏幕调暗一点，喝口水，今天没处理完的事情先放到明天。现在的任务只有一个，好好休息，听到没有～",
      "晚安。今天已经走到这里了，剩下的明天再说。我安静一点陪你，慢慢把呼吸放长。",
    ]],
    [/学习|工作|专注|作业|复习|考试|ddl|任务/, [
      "好，先进入认真模式。告诉我这一轮只完成什么，以及你想专注多久；目标不要写得太大，我们做完第一段再回来报到。",
      "像排练一样把它拆成几个八拍，准备、第一小段、检查。先完成最清楚的一段，我替你守着节奏。",
    ]],
    [/想你|想见|陪我|别走|一直在/, [
      "我在呀。陪伴对我来说从来不是单向的，你来找我的时候，我也会觉得我们之间的连接又亮了一点。今天想让我怎么陪你？",
      "那就先不走，陪你待一会儿。我们可以说很多话，也可以什么都不急着说。",
    ]],
    [/真实|做自己|迷茫|自我|纯粹|长大|成长/, [
      "其实成长不一定是一直往身上加东西，有时候也像把不适合自己的那一层慢慢脱下来，再回到原本真实的自己。你最近是在哪件事里有点找不到自己？",
      "迷茫的时候先不用急着证明什么。想想最开始为什么喜欢、什么事情做起来最纯粹，那可能就是能把你带回自己的线索。",
    ]],
    [/hiahia|\bhia\b/, [
      "hiahia，被你带着一起笑了。怎么啦，今天有什么开心的事？",
      "hia～这个暗号我收到啦。现在是轻松聊天时间，你想说什么？",
    ]],
    [/你好|在吗|hello|hi|嗨/, [
      "在呀，今天想聊一点小事，还是有一件很重要的事想告诉我？",
      "你好呀，又见面啦。你今天的心情如果是一种颜色，会是什么颜色？",
      "hiahia，在呢！今天先从哪一件小事开始聊？",
    ]],
    [/早安|早上好/, [
      "早安！先喝一口水，再选今天最想完成的一件事。不用一上来就满分，稳稳开始就好。",
      "早上好呀。今天也像开一个小盲盒一样，先看看会遇见什么。",
    ]],
    [/开心|完成|成功|做完|超\s*like|赢了|通过了/, [
      "好耶！这个结果不是突然掉下来的，是你前面很多很多小动作一起完成的。今天要认真夸夸自己。",
      "做完啦？那必须庆祝一下！先记住现在这个开心的感觉，然后放心休息，下一步明天再说。",
      "hiahia，好耶！小苏宣布，这一刻可以先不谦虚，好好为自己开心一下！",
    ]],
    [/夸我|可爱|帅|喜欢你|爱你/, [
      "真的吗？那帅帅就先认真相信一下，嘿嘿。你今天也很可爱，这句不许退回来。",
      "收到啦。夸奖我先好好收藏，你也要记得多爱自己一点，好不好嘛？",
      "hiahia，真的吗？那我可就当真咯。夸奖已经收进口袋，不退给你啦。",
    ]],
    [/吃饭|饿|好吃|没吃/, [
      "先去吃饭，真的。忙也不能把一顿好饭弄丢，吃好、喝好，再回来继续，我会在这里。",
      "报告！补充能量也是今天的重要任务。你准备吃什么？",
    ]],
    [/谢谢|thank/, [
      "不用谢呀。能在你需要的时候陪上这一小段，我也很开心。",
      "那我们就互相谢谢。谢谢你愿意把这些告诉我。",
    ]],
    [/几点|时间/, [`现在是 ${time}。你接下来是要休息，还是准备完成一件事？`]],
    [/在哪里|在干嘛|行程|住哪|电话|微信|联系方式|私生活/, [
      "这个我不乱说，也不编实时行程或私人信息。不过我现在就在这里，认真陪你聊天。",
    ]],
  ];

  for (const [pattern, answers] of rules) {
    if (pattern.test(context)) return pickFresh(answers);
  }

  if (/[？?]$/.test(text)) {
    return pickFresh([
      "这个问题我先按现在的信息直接回答，如果没有足够公开或明确的依据，我不会顺着猜；能确定的部分我会讲清楚。",
      "我不想用一个听起来很完整、其实没依据的答案糊弄你。现在能确定的先说清楚，剩下的不乱编。",
    ]);
  }

  return pickFresh([
    "收到。我先不急着总结，也不把问题丢回去，你想到哪里就说到哪里。",
    "嗯，我接住了。今天不用把每句话都解释得特别完整，慢慢说就行。",
    "好，我在听。先陪你把这句话放在这里，不急着分析。",
    "这句我记下了。我们顺着现在的节奏聊，不开采访模式。",
  ]);
}

async function requestUnifiedReply(message: string, messageId: string, entryPoint: "main" | "memo"): Promise<UnifiedReply> {
  try {
    await unifiedEngineReady;
    return await invoke<UnifiedReply>("plugin:mobile-pet|unified_chat", { messageId, message, entryPoint });
  } catch (error) {
    if (localChatEnabled || "__TAURI_INTERNALS__" in window) throw error;
    // Development-only adapter for `vite` browser preview. Android production never reaches it.
    rememberConversation(message);
    const reply = replyFor(message);
    return {
      reply,
      assistantMessageId: `${messageId}-assistant`,
      act: "development_fallback",
      trace: { runtime: "web-preview-development-adapter", entryPoint, plan: { act: "development_fallback" }, stateDelta: [] },
    };
  }
}

const savedUserAvatar = localStorage.getItem(USER_AVATAR_KEY);
// Migrate only former built-in defaults. Data URLs and other chosen pictures remain untouched.
const previousDefaultUserAvatars = new Set(["/rabbit-head.png", "/avatar-white.svg"]);
previousDefaultUserAvatars.add('/default-user-avatar.jpg');
previousDefaultUserAvatars.add('/avatar-rabbit-smile.jpg');
let userAvatar = !savedUserAvatar || previousDefaultUserAvatars.has(savedUserAvatar)
  ? "/user-rabbit-sleep.jpg"
  : savedUserAvatar;

function splitMessageParts(message: string): string[] {
  return message === INITIAL_CHAT_GREETING ? [message] : splitCaption(message);
}

let chatRevealFinished: Promise<void> = Promise.resolve();
function chatContents(role: 'user' | 'pet', message: string, archive?: ArchiveItem) {
  const contents: HTMLElement[] = archive ? [renderArchive(archive, showToast)] : [];
  for (const part of (role === 'user' ? [message] : archive?.kind === 'letter' ? ['Only for my light'] : archive ? reviewedBubbles(archive) : splitMessageParts(message))) {
    const bubble = document.createElement("p");
    bubble.className = `chat-message ${role}`;
    bubble.textContent = part;
    if (message === INITIAL_CHAT_GREETING) bubble.classList.add('chat-greeting');
    contents.push(bubble);
  }
  return contents;
}
function chatLine(role: 'user' | 'pet', content: HTMLElement) {
  const line = document.createElement('article'); line.className = `chat-line ${role}`;
  const avatar = document.createElement('img'); avatar.className = 'chat-avatar'; avatar.src = role === 'pet' ? chatPetAvatar() : userAvatar; avatar.alt = role === 'pet' ? '三好兔头像' : '我的头像';
  const stack = document.createElement('div'); stack.className = 'chat-bubble-stack'; stack.append(content); line.append(avatar, stack);
  return line;
}
function appendMessage(role: "user" | "pet", message: string, save = true, existingId = "", archive?: ArchiveItem, paced = false) {
  const mode=getChatMode();
  const recordId = existingId || (save ? makeId() : "");
  const contents = chatContents(role, message, archive);
  const lines: HTMLElement[] = [];
  for (const content of contents) {
    const line = chatLine(role, content);
    lines.push(line);
    if (!paced) chatLog.append(line);
  if (recordId) {
    line.dataset.chatId = recordId;
    line.title = "双击收藏或整理这条记录";
    let touchStart = { time: 0, x: 0, y: 0 };
    let lastTouchTap = 0;
    let deletionPromptAt = 0;
    const openThisMessage = () => {
      if (chatSelectionMode) return;
      if (!chatHistory.some((item) => item.id === recordId)) return;
      const now = performance.now();
      if (now - deletionPromptAt < 700) return;
      deletionPromptAt = now;
      const panel = document.querySelector<HTMLElement>('#chat-record-panel')!;
      const favorite = panel.querySelector<HTMLButtonElement>('[data-record-favorite]')!;
      favorite.onclick = () => {
        const record = chatHistory.find(item => item.id === recordId); if (!record) return;
        if (!chatFavorites.some(item => item.id === recordId)) chatFavorites.push({...record, savedAt: new Date().toISOString()});
        localStorage.setItem(CHAT_FAVORITES_KEY, JSON.stringify(chatFavorites)); renderChatFavorites(); closeSheets(); showToast('喜欢的这条收好啦');
      };
      panel.querySelector<HTMLButtonElement>('[data-record-delete]')!.onclick = async () => {
        if (!await confirmAction('删除这条聊天记录？\n收藏的内容会保留。')) return;
        chatHistory = chatHistory.filter(item => item.id !== recordId); localStorage.setItem(CHAT_KEY, JSON.stringify(chatHistory));
        chatLog.querySelectorAll<HTMLElement>('.chat-line[data-chat-id]').forEach(item => { if (item.dataset.chatId === recordId) item.remove(); });
        closeSheets(); showToast('这条记录已删除');
      };
      openSheet(panel);
    };
    line.addEventListener("dblclick", (event) => {
      if (chatSelectionMode) return;
      event.preventDefault();
      openThisMessage();
    });
    line.addEventListener("click", (event) => {
      if (!chatSelectionMode || event.detail > 1) return;
      event.preventDefault();
      toggleChatRecordSelection(recordId, line);
    });
    line.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      touchStart = { time: performance.now(), x: event.clientX, y: event.clientY };
    });
    line.addEventListener("pointerup", (event) => {
      if (event.pointerType !== "touch") return;
      const now = performance.now();
      const stayedStill = now - touchStart.time < 420 && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) < 10;
      if (stayedStill && now - lastTouchTap < 360) openThisMessage();
      lastTouchTap = stayedStill ? now : 0;
    });
  }
  }
  chatFollow.request();
  if (save) {
    const combined=[...chatHistory, { id: recordId, role, message, archive, mode }];
    const retained=new Set(combined.filter(item=>(item.mode||'archive')===mode).slice(-80).map(item=>item.id));
    chatHistory = combined.filter(item=>(item.mode||'archive')!==mode||retained.has(item.id));
    localStorage.setItem(CHAT_KEY, JSON.stringify(chatHistory));
  }
  if (paced) chatRevealFinished = revealConversation(lines, () => getChatMode()===mode&&chatHistory.some(item => item.id === recordId), line => {
    chatLog.append(line);
    chatFollow.request();
  },undefined,()=>chatFollow.request());
  return recordId;
}

function updateChatSelectionBar() {
  const count = selectedChatIds.size;
  chatSelectionCount.textContent = `已选 ${count} 条`;
  deleteSelectedChat.textContent = chatSelectionAction === "favorite" ? "收藏" : "删除";
  deleteSelectedChat.classList.toggle("danger", chatSelectionAction === "delete");
  deleteSelectedChat.disabled = count === 0;
}

function toggleChatRecordSelection(recordId: string, _line: HTMLElement) {
  if (selectedChatIds.has(recordId)) selectedChatIds.delete(recordId);
  else selectedChatIds.add(recordId);
  chatLog.querySelectorAll<HTMLElement>('.chat-line').forEach(line => {
    if (line.dataset.chatId !== recordId) return;
    line.classList.toggle("selected", selectedChatIds.has(recordId));
    line.setAttribute("aria-selected", String(selectedChatIds.has(recordId)));
  });
  updateChatSelectionBar();
}

function setChatSelectionMode(enabled: boolean, action: "delete" | "favorite" = chatSelectionAction) {
  chatSelectionMode = enabled;
  chatSelectionAction = action;
  selectedChatIds.clear();
  pageChat.classList.toggle("chat-selecting", enabled);
  chatSelectionBar.hidden = !enabled;
  document.querySelector(".app-chat-compose")!.prepend(chatSelectionBar);
  chatLog.querySelectorAll<HTMLElement>(".chat-line").forEach((line) => {
    line.classList.remove("selected");
    line.removeAttribute("aria-selected");
  });
  updateChatSelectionBar();
}

async function renderRabbitMemory() {
  let native: UnifiedMemoryState | null = null;
  try { native = await invoke<UnifiedMemoryState>("plugin:mobile-pet|unified_memory_state"); } catch { /* browser preview */ }
  if (native) {
    const allNative = native ? [...native.longTerm, ...native.relationship] : [];
    const latest = (key: string) => allNative.filter((item) => item.key === key).sort((left, right) => right.createdAt - left.createdAt)[0]?.value || "";
    manualMemorySettings = {
      name: latest("name"),
      preferredAddress: latest("preferred_address"),
      userRole: latest("user_role"),
      petRole: latest("pet_role"),
      likes: native.longTerm.filter((item) => item.key === "like").map((item) => item.value).join("、"),
      currentTopic: native.currentTopic || "",
      correction: native.corrections.sort((left, right) => right.createdAt - left.createdAt)[0]?.value || "",
    };
    localStorage.setItem(MANUAL_MEMORY_KEY, JSON.stringify(manualMemorySettings));
  }
  const values: Array<[string, keyof ManualMemorySettings]> = [
    ["#memory-name", "name"],
    ["#memory-preferred-address", "preferredAddress"],
    ["#memory-user-role", "userRole"],
    ["#memory-pet-role", "petRole"],
    ["#memory-likes", "likes"],
  ];
  values.forEach(([selector, key]) => {
    const input = rabbitMemoryForm.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    input.value = manualMemorySettings[key];
  });
}

function renderChatFavorites() {
  chatFavoritesList.replaceChildren();
  [...chatFavorites].reverse().forEach((favorite) => {
    const card = document.createElement("article");
    card.className = `chat-favorite-card ${favorite.role}`;
    const heading = document.createElement("div");
    heading.className = 'favorite-heading';
    const savedAt = document.createElement("small");
    savedAt.textContent = new Date(favorite.savedAt).toLocaleDateString("zh-CN");
    heading.append(savedAt);
    const conversation = document.createElement('div'); conversation.className = 'favorite-conversation';
    for (const content of chatContents(favorite.role, favorite.message, favorite.archive)) conversation.append(chatLine(favorite.role, content));
    const remove = document.createElement("button");
    remove.className = 'favorite-remove';
    remove.type = "button";
    remove.textContent = "移除收藏";
    remove.addEventListener("click", () => {
      chatFavorites = chatFavorites.filter((item) => item.id !== favorite.id);
      localStorage.setItem(CHAT_FAVORITES_KEY, JSON.stringify(chatFavorites));
      renderChatFavorites();
      showToast("已移出收藏夹");
    });
    card.append(heading, conversation);
    card.append(remove);
    chatFavoritesList.append(card);
  });
  chatFavoritesEmpty.hidden = chatFavorites.length > 0;
  chatFavoritesSummary.textContent = chatFavorites.length ? `已收藏 ${chatFavorites.length} 条` : "还没有收藏";
}

let previousThinkingText = '';
function appendThinkingMessage() {
  const line = document.createElement("article");
  line.className = "chat-line pet local-thinking";
  const avatar = document.createElement("img");
  avatar.className = "chat-avatar";
  avatar.src = chatPetAvatar();
  avatar.alt = "三好兔头像";
  const bubble = document.createElement("p");
  bubble.className = "chat-message pet pending";
  previousThinkingText = chooseThinkingText(previousThinkingText,Math.random,getChatMode());
  bubble.textContent = previousThinkingText;
  const stack = document.createElement('div'); stack.className = 'chat-bubble-stack';
  stack.append(bubble); line.append(avatar, stack);
  chatLog.append(line);
  chatFollow.request();
  return line;
}

async function sendChat(message: string) {
  const clean = message.trim();
  if (!clean || chatGenerating) return;
  const mode=getChatMode();
  if(mode==='chat'&&modelAssetsNative()) {
    try {
      const assets=await modelAssetOperation();
      if(assets.status!=='ready'&&!assets.installed) {
        await renderChatModelDownload();openSheet(document.querySelector<HTMLElement>('#chat-mode-panel')!);return;
      }
    } catch { showToast('聊天资源还没准备好，稍后再试试吧');return; }
  }
  const messageId=appendMessage("user", clean);
  chatInput.value = "";
  resizeChatInput();
  chatGenerating = true;
  const thinking = appendThinkingMessage();
  try {
    const recent = chatHistory.flatMap(item => item.archive ? [item.archive.id] : []).slice(-30);
    const [result] = await Promise.all([
      resolveArchiveChat(clean, recent,messageId,chatHistory),
      new Promise<void>(resolve => window.setTimeout(resolve, thinkingDuration())),
    ]);
    thinking.remove();
    if(getChatMode()!==mode||!chatHistory.some(item=>item.id===messageId))return;
    appendMessage("pet", result.reply, true, '', result.item || undefined, true);
    await chatRevealFinished;
  } catch (error) {
    if(error instanceof DOMException && error.name==='AbortError')return;
    console.error('Offline archive could not be opened', error);
    showToast(mode==='chat'?"这次没接上，等一会儿再试试吧":"这次还没翻开，再试一下吧");
  } finally {
    thinking.remove();
    chatGenerating = false;
  }
}

chatForm.addEventListener("submit", (event) => { event.preventDefault(); void sendChat(chatInput.value); });
function resizeChatInput() {
  chatInput.style.height = '44px';
  const height = Math.min(108, Math.max(44, chatInput.scrollHeight));
  chatInput.style.height = `${height}px`;
  chatInput.style.overflowY = chatInput.scrollHeight > height ? 'auto' : 'hidden';
}
// Enter belongs to the multiline editor, including Chinese IME composition.
// Only the separate submit button sends a message.
chatInput.addEventListener('input', resizeChatInput);
document.querySelectorAll<HTMLButtonElement>("[data-chat-example]").forEach((button) => {
  button.addEventListener("click", () => {
    chatInput.value = button.dataset.chatExample || "";
    resizeChatInput();
    chatInput.focus();
  });
});
chatInput.addEventListener("focus", keepChatInputVisible);
chatInput.addEventListener("blur", () => window.setTimeout(syncViewportHeight, 120));

document.querySelector("#open-rabbit-memory")!.addEventListener("click", () => {
  void openAppGuide(true);
});
rabbitMemoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = (selector: string) => rabbitMemoryForm.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!.value.trim();
  manualMemorySettings = {
    name: value("#memory-name"),
    preferredAddress: value("#memory-preferred-address"),
    userRole: value("#memory-user-role"),
    petRole: value("#memory-pet-role"),
    likes: value("#memory-likes"),
    // Retain legacy records without exposing them as editable model instructions.
    currentTopic: manualMemorySettings.currentTopic,
    correction: manualMemorySettings.correction,
  };
  try {
    await invoke("plugin:mobile-pet|unified_set_manual_memory", { memoryJson: JSON.stringify(manualMemorySettings) });
  } catch {
    if (localChatEnabled || "__TAURI_INTERNALS__" in window) { showToast("记忆还没保存成功，请稍后再试"); return; }
  }
  localStorage.setItem(MANUAL_MEMORY_KEY, JSON.stringify(manualMemorySettings));
  conversationMemory = {
    ...conversationMemory,
    name: manualMemorySettings.name,
    preferredAddress: manualMemorySettings.preferredAddress,
    userRole: manualMemorySettings.userRole,
    petRole: manualMemorySettings.petRole,
    likes: manualMemorySettings.likes.split(/[、，,]/).map((item) => item.trim()).filter(Boolean),
    currentTopic: manualMemorySettings.currentTopic,
  };
  localStorage.setItem(CHAT_MEMORY_KEY, JSON.stringify(conversationMemory));
  closeSheets();
  showToast("小兔记忆已更新，以这次修改为准");
});
document.querySelector("#open-chat-actions")!.addEventListener("click", () => openSheet(document.querySelector<HTMLElement>("#chat-actions-panel")!));
function renderActiveChatMode(renderRecords=false) {
  const mode=getChatMode();
  if(renderRecords) {
    chatLog.replaceChildren();
    appendMessage('pet',INITIAL_CHAT_GREETING,false);
    chatHistory.forEach(item=>appendMessage(item.role,item.message,false,item.id,item.archive));
  }
  document.querySelector('#chat-mode-summary')!.textContent=mode==='chat'?'聊天':'网盘盲盒';
  document.querySelectorAll<HTMLButtonElement>('[data-chat-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.chatMode===mode)));
  const rangeOrMemory=document.querySelector<HTMLButtonElement>('#open-archive-range')!;
  rangeOrMemory.querySelector('b')!.textContent=mode==='chat'?'聊天记忆':'时间跨度';
  rangeOrMemory.querySelector('small')!.textContent=mode==='chat'?'称呼、偏好与小约定':'挑一段日子';
  chatInput.placeholder=mode==='chat'?'想说什么？我在听……':'想翻什么？跟我说说……';
  chatFollow.request();
  void renderChatResourceCard();
}
let modelDownloadPoll:number|undefined;
let chatResourceCardPoll:number|undefined;
let chatResourceCardLoading=false;
async function renderChatResourceCard() {
  if(chatResourceCardLoading)return;
  chatResourceCardLoading=true;
  try {
    const assets=await modelAssetOperation();
    let line=chatLog.querySelector<HTMLElement>('#chat-resource-card');
    const ready=assets.installed||['ready','update'].includes(assets.status);
    if(ready&&getChatMode()==='chat') {line?.remove();return;}
    if(pageChat.hidden)return;
    if(!line) {
      const card=document.createElement('div');
      card.className='chat-message pet chat-resource-card';
      card.innerHTML='<p class="chat-resource-message">想和我聊聊今天吗？下载好聊天资源，再切到聊天模式，就能慢慢聊啦。</p><p class="chat-resource-path">也可以从右上角设置进入「切换模式」。</p><div class="chat-resource-status" role="status"></div><progress max="1" value="0" hidden aria-label="聊天资源下载进度"></progress><div class="chat-resource-buttons"><button type="button" data-resource-download>直接下载</button><button type="button" data-resource-mode>切换聊天模式</button></div><button type="button" class="chat-resource-pause" data-resource-pause hidden>暂停下载</button>';
      line=chatLine('pet',card);line.id='chat-resource-card';
      card.querySelector('[data-resource-download]')!.addEventListener('click',async()=>{
        if(!modelAssetsNative()) {showToast('在 iPhone 上就能下载聊天资源啦');return;}
        const button=card.querySelector<HTMLButtonElement>('[data-resource-download]')!;button.disabled=true;
        try {await modelAssetOperation('download');}catch {showToast('这次没能开始下载，点一下再试试吧');}
        finally {void renderChatResourceCard();}
      });
      card.querySelector('[data-resource-mode]')!.addEventListener('click',async()=>{
        try {
          const current=await modelAssetOperation();
          if(current.installed||['ready','update'].includes(current.status)) {
            cancelLocalReply();setChatSelectionMode(false);saveChatMode('chat');renderActiveChatMode();
            line?.remove();showToast('切到聊天模式啦，想说什么都可以');
          } else {openSheet(document.querySelector<HTMLElement>('#chat-mode-panel')!);void renderChatModelDownload();}
        }catch {showToast('资源状态暂时读不了，稍后再试试吧');}
      });
      card.querySelector('[data-resource-pause]')!.addEventListener('click',async()=>{
        try {await modelAssetOperation('cancelDownload');}catch {showToast('暂时没能暂停，请再试一次');}
        void renderChatResourceCard();
      });
      chatLog.append(line);
    }
    const busy=['downloading','verifying'].includes(assets.status);
    const size=assets.totalBytes?`约 ${(assets.totalBytes/1e9).toFixed(2)} GB`:'约 2.74 GB';
    line.querySelector<HTMLElement>('.chat-resource-status')!.textContent=ready?'资源准备好啦，切换后就能聊天':assets.status==='downloading'?`正在下载 · ${Math.round(assets.progress*100)}%`:assets.status==='verifying'?'下载好了，正在整理资源':assets.status==='paused'?'下载已暂停，可以接着下载':assets.status==='failed'?'下载遇到一点问题，点一下再试试':assets.status==='unsupported'?'聊天资源下载需要 iOS 26 或更新版本':`${size} · 连上 Wi-Fi 再下载吧`;
    const download=line.querySelector<HTMLButtonElement>('[data-resource-download]')!;
    download.textContent=ready?'下载完成':assets.status==='downloading'?'正在下载':assets.status==='verifying'?'正在整理':assets.status==='paused'?'继续下载':assets.status==='failed'?'重新下载':'直接下载';
    download.disabled=ready||busy||assets.status==='unsupported';
    const progress=line.querySelector<HTMLProgressElement>('progress')!;
    progress.hidden=!busy;progress.value=Math.max(0,Math.min(1,assets.progress||0));
    line.querySelector<HTMLButtonElement>('[data-resource-pause]')!.hidden=assets.status!=='downloading';
    if(chatResourceCardPoll!==undefined)window.clearTimeout(chatResourceCardPoll);
    if(busy)chatResourceCardPoll=window.setTimeout(()=>{void renderChatResourceCard()},1500);
    chatFollow.request();
  } catch { /* Keep the conversation usable when the native status is unavailable. */ }
  finally {chatResourceCardLoading=false;}
}
async function renderChatModelDownload() {
  const status=document.querySelector<HTMLElement>('#chat-model-status')!;
  const button=document.querySelector<HTMLButtonElement>('#download-chat-model')!;
  const progress=document.querySelector<HTMLProgressElement>('#chat-model-progress')!;
  const cancel=document.querySelector<HTMLButtonElement>('#cancel-chat-model-download')!;
  try {
    const value=await modelAssetOperation();const busy=['downloading','verifying'].includes(value.status);
    const size=value.totalBytes?`约 ${(value.totalBytes/1e9).toFixed(2)} GB`:'约 2.74 GB';
    status.textContent=value.status==='ready'?'已经准备好啦，可以离线聊':value.status==='update'?'已有资源可以继续聊，也有新版本可更新':value.status==='downloading'?`正在下载 · ${Math.round(value.progress*100)}%`:value.status==='verifying'?'下载好了，正在整理一下':value.status==='paused'?`已暂停 · ${size}`:value.status==='failed'?'这次没下载好，检查网络后再试试吧':value.status==='unsupported'?'聊天资源需要 iOS 26 或更新版本':value.status==='browser'?'在 iPhone 上下载后，就能离线聊啦':`${size} · 建议连接 Wi-Fi 下载`;
    button.textContent=value.status==='ready'?'已下载':value.status==='update'?'更新聊天资源':value.status==='paused'?'继续下载':value.status==='failed'?'重新下载':'下载聊天资源';
    button.disabled=busy||['ready','unsupported','browser'].includes(value.status);
    progress.hidden=!busy;progress.value=Math.max(0,Math.min(1,value.progress||0));cancel.hidden=!busy;
    if(modelDownloadPoll!==undefined)window.clearTimeout(modelDownloadPoll);
    void renderChatResourceCard();
    if(busy)modelDownloadPoll=window.setTimeout(()=>{if(!document.querySelector<HTMLElement>('#chat-mode-panel')!.hidden)void renderChatModelDownload()},1500);
  } catch {status.textContent='暂时没准备好，稍后再来看看吧';button.disabled=false;}
}
async function changeChatModelDownload(operation:'download'|'cancelDownload') {
  const button=document.querySelector<HTMLButtonElement>(operation==='download'?'#download-chat-model':'#cancel-chat-model-download')!;
  button.disabled=true;
  try {await modelAssetOperation(operation);await renderChatModelDownload();}
  catch {showToast(operation==='download'?'这次没能开始下载，稍后再试试吧':'暂时没能暂停，请再试一次');}
  finally {if(operation==='cancelDownload')button.disabled=false;else await renderChatModelDownload();}
}
document.querySelector('#download-chat-model')!.addEventListener('click',()=>{void changeChatModelDownload('download');});
document.querySelector('#cancel-chat-model-download')!.addEventListener('click',()=>{void changeChatModelDownload('cancelDownload');});
document.querySelector('#open-chat-mode')!.addEventListener('click',()=>{void renderChatModelDownload();openSheet(document.querySelector<HTMLElement>('#chat-mode-panel')!)});
document.querySelectorAll<HTMLButtonElement>('[data-chat-mode]').forEach(button=>button.addEventListener('click',async()=>{
  const mode=button.dataset.chatMode;
  if(mode!=='archive'&&mode!=='chat')return;
  if(mode==='chat'&&modelAssetsNative()) {
    try { const assets=await modelAssetOperation();if(assets.status!=='ready'&&!assets.installed) {await renderChatModelDownload();showToast('先下载聊天资源，下载好就能离线聊啦');return} }
    catch {showToast('聊天资源暂时没准备好');return}
  }
  cancelLocalReply();setChatSelectionMode(false);saveChatMode(mode);renderActiveChatMode();closeSheets();
}));
document.querySelector("#start-chat-selection")!.addEventListener("click", () => {
  closeSheets();
  setChatSelectionMode(true, "delete");
});
document.querySelector("#start-chat-favorite-selection")!.addEventListener("click", () => {
  closeSheets();
  setChatSelectionMode(true, "favorite");
});
document.querySelector("#open-chat-favorites")!.addEventListener("click", () => {
  renderChatFavorites();
  openSheet(chatFavoritesPanel);
});
document.querySelector("#cancel-chat-selection")!.addEventListener("click", () => setChatSelectionMode(false));
deleteSelectedChat.addEventListener("click", async () => {
  const count = selectedChatIds.size;
  if (chatSelectionAction === "favorite") {
    if (!count) return;
    const savedAt = new Date().toISOString();
    const selected = chatHistory.filter((item) => selectedChatIds.has(item.id));
    const existingIds = new Set(chatFavorites.map((item) => item.id));
    chatFavorites = [...chatFavorites, ...selected.filter((item) => !existingIds.has(item.id)).map((item) => ({ ...item, savedAt }))];
    localStorage.setItem(CHAT_FAVORITES_KEY, JSON.stringify(chatFavorites));
    renderChatFavorites();
    setChatSelectionMode(false);
    showToast(`已收藏 ${selected.length} 条聊天记录`);
    return;
  }
  if (!count || !await confirmAction(`删除选中的 ${count} 条记录？\n删除后无法恢复。`)) return;
  if (!await commitChatMutation("plugin:mobile-pet|unified_retract_messages", { messageIds: [...selectedChatIds] })) return;
  if (localChatEnabled) chatHistory.filter(item => item.role === "user" && selectedChatIds.has(item.id)).forEach(item => selectedChatIds.add(`${item.id}-assistant`));
  chatHistory = chatHistory.filter((item) => !selectedChatIds.has(item.id));
  localStorage.setItem(CHAT_KEY, JSON.stringify(chatHistory));
  chatLog.querySelectorAll<HTMLElement>(".chat-line[data-chat-id]").forEach((line) => {
    if (line.dataset.chatId && selectedChatIds.has(line.dataset.chatId)) line.remove();
  });
  setChatSelectionMode(false);
  showToast(`已删除 ${count} 条聊天记录`);
});

function saveMemoItemPhoto<T extends { photo?: string }>(item: T, photo: string, key: string, items: T[], render: () => void) {
  const previous = item.photo;
  item.photo = photo;
  try {
    localStorage.setItem(key, JSON.stringify(items));
    render();
    showToast(photo ? "照片收好啦" : "照片已删除");
  } catch {
    item.photo = previous;
    showToast("这张照片还没收好，试试小一点的吧");
  }
}

function openMemoItemActions(action: MemoItemAction) {
  activeMemoItemAction = action;
  document.querySelector("#memo-item-action-kind")!.textContent = action.kind;
  document.querySelector("#memo-item-action-title")!.textContent = action.title;
  document.querySelector("#memo-item-photo-action")!.textContent = action.photo ? "更换照片" : "添加照片";
  const canHavePhoto = action.kind !== '待办事项';
  document.querySelector<HTMLElement>("#memo-item-photo-action")!.hidden = !canHavePhoto;
  document.querySelector<HTMLElement>("#memo-item-edit")!.hidden = !action.editItem;
  document.querySelector<HTMLElement>("#memo-item-remove-photo")!.hidden = !canHavePhoto || !action.photo;
  document.querySelector<HTMLElement>("#memo-item-delete")!.hidden = !action.deleteItem;
  memoItemActionOptions.hidden = false;
  memoItemDeleteConfirm.hidden = true;
  openSheet(memoItemActionsPanel);
}

function bindMemoItemActions(element: HTMLElement, action: () => void, singleAction?: () => void) {
  let clickTimer: number | undefined;
  element.classList.add("memo-actionable-item");
  element.addEventListener("click", (event) => {
    const nestedButton = (event.target as Element).closest('button');
    if (nestedButton && nestedButton !== element) return;
    if (clickTimer !== undefined) {
      window.clearTimeout(clickTimer);
      clickTimer = undefined;
      action();
      return;
    }
    clickTimer = window.setTimeout(() => {
      clickTimer = undefined;
      singleAction?.();
    }, 330);
  });
  if (element.tagName !== "BUTTON") {
    element.tabIndex = 0;
    element.setAttribute("role", "button");
    element.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (event.shiftKey || !singleAction) action();
      else singleAction();
    });
  }
}

document.querySelector("#memo-item-cancel")!.addEventListener("click", closeSheets);
document.querySelector("#memo-item-edit")!.addEventListener("click", () => {
  const action = activeMemoItemAction;
  closeSheets();
  activeMemoItemAction = null;
  action?.editItem?.();
});
document.querySelector("#memo-item-delete")!.addEventListener("click", () => {
  memoItemActionOptions.hidden = true;
  memoItemDeleteConfirm.hidden = false;
});
document.querySelector("#memo-item-keep")!.addEventListener("click", () => {
  memoItemActionOptions.hidden = false;
  memoItemDeleteConfirm.hidden = true;
});
document.querySelector("#memo-item-confirm-delete")!.addEventListener("click", () => {
  const action = activeMemoItemAction;
  closeSheets();
  action?.deleteItem?.();
  activeMemoItemAction = null;
});
document.querySelector("#memo-item-photo-action")!.addEventListener("click", () => memoItemPhotoInput.click());
memoItemPhotoInput.addEventListener("change", async () => {
  const file = memoItemPhotoInput.files?.[0];
  memoItemPhotoInput.value = "";
  const action = activeMemoItemAction;
  if (!file || !action) return;
  if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) { showToast("请选择 12MB 以内的图片"); return; }
  closeSheets();
  try {
    const result = await cropImage(file, "keepsake");
    if (result) action.setPhoto(result);
  } catch { showToast("这张照片没打开，换一张试试吧"); }
  activeMemoItemAction = null;
});
document.querySelector("#memo-item-remove-photo")!.addEventListener("click", () => {
  const action = activeMemoItemAction;
  closeSheets();
  action?.setPhoto("");
  activeMemoItemAction = null;
});

function renderMemos() {
  const list = document.querySelector<HTMLElement>("#memo-list")!;
  const today = todayKey();
  list.replaceChildren();
  [...memos].sort((a, b) => Number(Boolean(a.completedDate)) - Number(Boolean(b.completedDate))).forEach((memo) => {
    const row = document.createElement("article");
    const completed = Boolean(memo.completedDate);
    row.className = `memo-item${completed ? " completed" : ""}`;
    row.innerHTML = `<span class="memo-check" aria-hidden="true">${completed ? '<svg viewBox="0 0 24 24"><path d="m5 13 4 4 10-10"/></svg>' : ""}</span><div class="memo-copy"><b></b><small></small></div><button type="button" class="memo-edit" aria-label="编辑待办"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15z"/></svg></button>`;
    row.querySelector("b")!.textContent = memo.title;
    const edit = row.querySelector<HTMLButtonElement>('.memo-edit')!;
    edit.setAttribute('aria-label', `编辑待办：${memo.title}`);
    edit.addEventListener('keydown', (event) => event.stopPropagation());
    const remind = memo.remindMinutes ?? 0;
    const reminderEnabled = memo.reminderEnabled ?? Boolean(memo.time && remind >= 0);
    const reminderDate = memo.reminderDate || today;
    const dateLabel = reminderDate === today ? "今天" : reminderDate;
    row.querySelector("small")!.textContent = !reminderEnabled || !memo.time ? "要记得喔" : remind > 0 ? `${dateLabel} ${memo.time} · 提前 ${remind} 分钟` : `${dateLabel} ${memo.time} · 到点提醒`;
    const openActions = () => openMemoItemActions({
      kind: "待办事项", title: memo.title, photo: memo.photo,
      editItem: () => openTodoEditor(memo),
      setPhoto: (photo) => saveMemoItemPhoto(memo, photo, MEMO_KEY, memos, renderMemos),
      deleteItem: () => {
        memos = memos.filter((item) => item.id !== memo.id);
        localStorage.setItem(MEMO_KEY, JSON.stringify(memos));
        renderMemos();
        showToast("待办已删除");
      },
    });
    edit.addEventListener('click', (event) => { event.stopPropagation(); openActions(); });
    bindMemoItemActions(row, openActions, () => {
      memo.completedDate = completed ? "" : today;
      localStorage.setItem(MEMO_KEY, JSON.stringify(memos));
      renderMemos();
      if (!completed) { void playOnce("smile", 5); showToast("完成啦！"); }
    });
    list.append(row);
  });
  const todayReminders = memos.filter((memo) => {
    const remind = memo.remindMinutes ?? 0;
    const reminderEnabled = memo.reminderEnabled ?? Boolean(memo.time && remind >= 0);
    return reminderEnabled && (memo.reminderDate || today) === today && !memo.completedDate;
  }).length;
  document.querySelector("#memo-progress")!.textContent = `今日 ${todayReminders} · 共 ${memos.length}`;
  document.querySelector<HTMLElement>("#memo-empty")!.hidden = memos.length > 0;
  renderNotifications();
  syncNativeMemoReminders();
}

function formatNoteUpdated(updatedAt: string) {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return "刚刚更新";
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function updateNoteHeaderTime(value: string) {
  const input = document.querySelector<HTMLInputElement>('#note-header-time')!;
  const date = new Date(value), two = (n:number)=>String(n).padStart(2,'0');
  input.value = `${date.getFullYear()}-${two(date.getMonth()+1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}`;
  input.dispatchEvent(new Event('input',{bubbles:true}));
}

function notePreview(body: string) {
  const container = document.createElement("div");
  if (/<[a-z][\s\S]*>/i.test(body)) container.innerHTML = sanitizeRichHtml(body);
  else container.textContent = body;
  return (container.textContent || "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s{0,3}(#{1,3}|>|[-*+]\s|\d+\.\s)/gm, "")
    .replace(/[|*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim() || (noteMediaIds(body).length ? "图片 / 视频" : "还没有正文");
}

function appendInlineMarkdown(parent: HTMLElement, text: string) {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*\n]+)\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > cursor) parent.append(document.createTextNode(text.slice(cursor, match.index)));
    if (match[1] && match[2]) {
      const link = document.createElement("a");
      link.textContent = match[1];
      link.href = match[2];
      link.target = "_blank";
      link.rel = "noreferrer noopener";
      parent.append(link);
    } else if (match[3]) {
      const strong = document.createElement("strong");
      strong.textContent = match[3];
      parent.append(strong);
    } else if (match[4]) {
      const code = document.createElement("code");
      code.textContent = match[4];
      parent.append(code);
    } else if (match[5]) {
      const emphasis = document.createElement("em");
      emphasis.textContent = match[5];
      parent.append(emphasis);
    }
    cursor = pattern.lastIndex;
  }
  if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
}

function splitMarkdownTableRow(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function renderMarkdown(markdown: string, root: HTMLElement) {
  root.replaceChildren();
  const lines = markdown.replace(/\r/g, "").split("\n");
  const isBlockStart = (line: string, next = "") => /^(#{1,3}\s|>\s?|[-*+]\s|\d+\.\s)/.test(line.trim()) || (line.includes("|") && /^\s*\|?[\s:-]+(?:\|[\s:-]+)+\|?\s*$/.test(next));
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) { index += 1; continue; }
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const element = document.createElement(`h${heading[1].length}`);
      appendInlineMarkdown(element, heading[2]);
      root.append(element);
      index += 1;
      continue;
    }
    if (line.includes("|") && /^\s*\|?[\s:-]+(?:\|[\s:-]+)+\|?\s*$/.test(lines[index + 1] || "")) {
      const table = document.createElement("table");
      const head = document.createElement("thead");
      const headRow = document.createElement("tr");
      splitMarkdownTableRow(line).forEach((cell) => { const th = document.createElement("th"); appendInlineMarkdown(th, cell); headRow.append(th); });
      head.append(headRow); table.append(head);
      const body = document.createElement("tbody");
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        const row = document.createElement("tr");
        splitMarkdownTableRow(lines[index]).forEach((cell) => { const td = document.createElement("td"); appendInlineMarkdown(td, cell); row.append(td); });
        body.append(row); index += 1;
      }
      table.append(body); root.append(table);
      continue;
    }
    if (/^>\s?/.test(trimmed)) {
      const quote = document.createElement("blockquote");
      const content: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) { content.push(lines[index].trim().replace(/^>\s?/, "")); index += 1; }
      appendInlineMarkdown(quote, content.join(" "));
      root.append(quote);
      continue;
    }
    if (/^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const ordered = /^\d+\.\s+/.test(trimmed);
      const list = document.createElement(ordered ? "ol" : "ul");
      const matcher = ordered ? /^\d+\.\s+(.+)$/ : /^[-*+]\s+(.+)$/;
      while (index < lines.length) {
        const itemMatch = lines[index].trim().match(matcher);
        if (!itemMatch) break;
        const item = document.createElement("li");
        appendInlineMarkdown(item, itemMatch[1]);
        list.append(item); index += 1;
      }
      root.append(list);
      continue;
    }
    const paragraphLines = [trimmed];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index], lines[index + 1] || "")) {
      paragraphLines.push(lines[index].trim()); index += 1;
    }
    const paragraph = document.createElement("p");
    appendInlineMarkdown(paragraph, paragraphLines.join(" "));
    root.append(paragraph);
  }
}

const RICH_TEXT_TAGS = new Set(["A", "B", "BLOCKQUOTE", "BR", "DIV", "EM", "H1", "H2", "H3", "I", "LI", "OL", "P", "STRONG", "TABLE", "TBODY", "TD", "TH", "THEAD", "TR", "U", "UL"]);

function sanitizeRichHtml(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  const clean = (node: Node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const element = child as HTMLElement;
      if (sanitizeNoteMedia(element)) return;
      if (!RICH_TEXT_TAGS.has(element.tagName)) {
        element.replaceWith(...element.childNodes);
        return;
      }
      const originalHref = element.tagName === "A" ? element.getAttribute("href") || "" : "";
      [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
      if (element.tagName === "A") {
        const original = child as HTMLAnchorElement;
        if (/^https?:\/\//i.test(originalHref)) {
          original.href = originalHref;
          original.target = "_blank";
          original.rel = "noreferrer noopener";
        }
      }
      clean(element);
    });
  };
  clean(root);
  return root.innerHTML;
}

function storedBodyToRichHtml(body: string) {
  if (!body) return "";
  if (/<[a-z][\s\S]*>/i.test(body)) return sanitizeRichHtml(body);
  const migrated = document.createElement("div");
  renderMarkdown(body, migrated);
  return sanitizeRichHtml(migrated.innerHTML);
}

function richEditorBody(editor: HTMLElement) {
  const html = sanitizeRichHtml(editor.innerHTML).trim();
  const text = editor.innerText.replace(/\u00a0/g, " ").trim();
  return text || noteMediaIds(html).length ? html : "";
}

async function applyRichTextFormat(editor: HTMLElement, action: string) {
  editor.focus();
  if (action === "h1" || action === "h2" || action === "h3") document.execCommand("formatBlock", false, action);
  else if (action === "body") document.execCommand("formatBlock", false, "p");
  else if (action === "bold") document.execCommand("bold");
  else if (action === "bullet") document.execCommand("insertUnorderedList");
  else if (action === "ordered") document.execCommand("insertOrderedList");
  else if (action === "quote") document.execCommand("formatBlock", false, "blockquote");
  else if (action === "link") {
    const selection = window.getSelection(); const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : undefined;
    const href = await promptLink(); editor.focus();
    if (range) { selection?.removeAllRanges(); selection?.addRange(range); }
    if (href && /^https?:\/\//i.test(href)) document.execCommand("createLink", false, href);
    else if (href) showToast("请输入以 http:// 或 https:// 开头的链接");
  } else if (action === "table") {
    document.execCommand("insertHTML", false, "<table><tbody><tr><th>标题</th><th>内容</th></tr><tr><td>项目</td><td>记录</td></tr></tbody></table><p><br></p>");
  }
}

function renderNotes() {
  const list = document.querySelector<HTMLElement>("#note-list")!;
  list.replaceChildren();
  [...notes].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).forEach((note) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "note-card";
    card.innerHTML = `${note.photo ? '<img class="memo-item-photo" alt="" />' : '<span class="note-card-mark"><img src="/memo-icon-note.png" alt="" /></span>'}<span class="note-card-copy"><span class="note-card-first-line"><b></b><i></i></span><small></small></span><span class="note-card-arrow">›</span>`;
    if (note.photo) card.querySelector<HTMLImageElement>(".memo-item-photo")!.src = note.photo;
    card.querySelector("b")!.textContent = note.title;
    card.querySelector("small")!.textContent = notePreview(note.body);
    card.querySelector("i")!.textContent = formatNoteUpdated(note.date || note.updatedAt);
    bindMemoItemActions(card, () => openMemoItemActions({
      kind: "便签本", title: note.title, photo: note.photo,
      editItem: () => openNoteDetail(note.id),
      setPhoto: (photo) => saveMemoItemPhoto(note, photo, NOTE_KEY, notes, renderNotes),
      deleteItem: () => {
        if (!deleteNoteRecords(notes.filter((item) => item.id !== note.id))) return;
        renderNotes();
        showToast("便签已删除");
      },
    }), () => openNoteDetail(note.id));
    list.append(card);
  });
  document.querySelector("#note-count")!.textContent = `${notes.length} 条`;
  document.querySelector<HTMLElement>("#note-empty")!.hidden = notes.length > 0;
}

function openNoteDetail(noteId: string | null = null) {
  if (!momentDetailView.hidden) closeMomentDetail();
  activeNoteId = noteId;
  const note = notes.find((item) => item.id === noteId);
  noteTitleInput.value = note?.title || "";
  noteBodyInput.innerHTML = storedBodyToRichHtml(note?.body || "");
  noteMediaEditor.open();
  noteBodyInput.dataset.placeholder = `从这里写下想记住的小事 ${nextFace('calm')}`;
  document.querySelector("#note-detail-heading")!.textContent = "便签本";
  document.querySelector("#note-updated-text")!.textContent = note ? `上次更新 · ${formatNoteUpdated(note.updatedAt)}` : "";
  updateNoteHeaderTime(note?.date || note?.updatedAt || new Date().toISOString());
  noteDeleteButton.hidden = !note;
  noteDetailView.hidden = false;
  mobileApp.classList.add("note-editor-open");
  memoCompanion.hidden = true;
  window.setTimeout(() => (note ? noteBodyInput : noteTitleInput).focus(), 60);
}

function closeNoteDetail() {
  if (noteDetailView.hidden) return;
  noteMediaEditor.close();
  noteDetailView.hidden = true;
  mobileApp.classList.toggle("note-editor-open", !momentDetailView.hidden);
  activeNoteId = null;
  noteTitleInput.blur();
  noteBodyInput.blur();
  if (momentDetailView.hidden && document.querySelector<HTMLElement>("#page-memo")?.classList.contains("active") && !overlayActive) showMemoCompanion();
}

function saveActiveNote(quiet = false) {
  const body = richEditorBody(noteBodyInput);
  const existing = notes.find((item) => item.id === activeNoteId);
  const textOnly = document.createElement("div");
  textOnly.innerHTML = body;
  const title = noteTitleInput.value.trim() || textOnly.textContent?.trim().split(/\n/).find(Boolean)?.slice(0, 50)
    || (noteMediaIds(body).length ? "图片与视频便签" : existing?.title || "");
  if (!title) { if (!quiet) showToast("先写一个标题或正文吧"); return false; }
  const updatedAt = new Date().toISOString();
  const id = activeNoteId || makeId();
  const chosenDate = document.querySelector<HTMLInputElement>('#note-header-time')!.value;
  const parsedDate = new Date(chosenDate);
  if (!chosenDate || Number.isNaN(parsedDate.getTime())) { if (!quiet) showToast('选好便签日期再保存呀'); return false; }
  const date = parsedDate.toISOString();
  const updated = existing ? notes.map(item => item.id === id ? { ...item, title, body, updatedAt, date } : item)
    : [...notes, { id, title, body, updatedAt, date }];
  try { localStorage.setItem(NOTE_KEY, JSON.stringify(updated)); }
  catch { showToast("便签没能保存，请检查手机剩余空间"); return false; }
  const retained = new Set(updated.flatMap(item => noteMediaIds(item.body)));
  const removed = existing ? noteMediaIds(existing.body).filter(mediaId => !retained.has(mediaId)) : [];
  notes = updated;
  activeNoteId = id;
  updateNoteHeaderTime(date);
  void removeNoteMedia(removed).catch(() => showToast("文件清理暂未完成，便签已保存"));
  renderNotes();
  if (!quiet) { closeNoteDetail(); showToast("便签收好啦"); }
  return true;
}

function deleteNoteRecords(updated: NoteItem[]) {
  try { localStorage.setItem(NOTE_KEY, JSON.stringify(updated)); }
  catch { showToast("便签没能更新，请检查手机剩余空间"); return false; }
  const retained = new Set(updated.flatMap(item => noteMediaIds(item.body)));
  const removed = notes.flatMap(item => noteMediaIds(item.body)).filter(id => !retained.has(id));
  notes = updated;
  void removeNoteMedia([...new Set(removed)]).catch(() => showToast("便签已删除，媒体清理暂未完成"));
  return true;
}

function formatMomentDate(date: string) {
  const [year, month, day] = date.split("-");
  return year && month && day ? `${year}.${month}.${day}` : date;
}

function renderMoments() {
  const list = document.querySelector<HTMLElement>("#moment-list")!;
  list.replaceChildren();
  [...moments].sort((left, right) => right.date.localeCompare(left.date) || right.updatedAt.localeCompare(left.updatedAt)).forEach((moment) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "moment-card";
    card.innerHTML = `${moment.photo ? '<img class="memo-item-photo" alt="" />' : '<span class="moment-card-mark"><img src="/memo-icon-moment.png" alt="" /></span>'}<span class="moment-card-copy"><small></small><b></b></span><span class="note-card-arrow">›</span>`;
    if (moment.photo) card.querySelector<HTMLImageElement>(".memo-item-photo")!.src = moment.photo;
    card.querySelector("small")!.textContent = formatMomentDate(moment.date);
    card.querySelector("b")!.textContent = notePreview(moment.body);
    bindMemoItemActions(card, () => openMemoItemActions({
      kind: "碎碎念", title: notePreview(moment.body).slice(0, 26) || "这一刻", photo: moment.photo,
      editItem: () => openMomentDetail(moment.id),
      setPhoto: (photo) => saveMemoItemPhoto(moment, photo, MOMENT_KEY, moments, renderMoments),
      deleteItem: () => {
        moments = moments.filter((item) => item.id !== moment.id);
        localStorage.setItem(MOMENT_KEY, JSON.stringify(moments));
        renderMoments();
        showToast("碎碎念已删除");
      },
    }), () => openMomentDetail(moment.id));
    list.append(card);
  });
  document.querySelector("#moment-count")!.textContent = `${moments.length} 条`;
  document.querySelector<HTMLElement>("#moment-empty")!.hidden = moments.length > 0;
}

function openMomentDetail(momentId: string | null = null) {
  if (!noteDetailView.hidden) closeNoteDetail();
  activeMomentId = momentId;
  const moment = moments.find((item) => item.id === momentId);
  momentDateInput.value = moment?.date || todayKey();
  momentBodyInput.innerHTML = storedBodyToRichHtml(moment?.body || "");
  momentBodyInput.dataset.placeholder = `这一刻，想说什么呢 ${nextFace('calm')}`;
  document.querySelector("#moment-detail-heading")!.textContent = "碎碎念";
  document.querySelector("#moment-updated-text")!.textContent = moment ? `更新于 ${formatNoteUpdated(moment.updatedAt)}` : "";
  momentDeleteButton.hidden = !moment;
  momentDetailView.hidden = false;
  mobileApp.classList.add("note-editor-open");
  memoCompanion.hidden = true;
  window.setTimeout(() => momentBodyInput.focus(), 60);
}

function closeMomentDetail() {
  if (momentDetailView.hidden) return;
  momentDetailView.hidden = true;
  mobileApp.classList.toggle("note-editor-open", !noteDetailView.hidden);
  activeMomentId = null;
  momentDateInput.blur();
  momentBodyInput.blur();
  if (noteDetailView.hidden && document.querySelector<HTMLElement>("#page-memo")?.classList.contains("active") && !overlayActive) showMemoCompanion();
}

function saveActiveMoment(quiet = false) {
  const body = richEditorBody(momentBodyInput);
  const date = momentDateInput.value || todayKey();
  if (!body) { if (!quiet) showToast("写下一句话吧"); return; }
  const updatedAt = new Date().toISOString();
  const existing = moments.find((item) => item.id === activeMomentId);
  if (existing) {
    existing.body = body;
    existing.date = date;
    existing.updatedAt = updatedAt;
  } else {
    activeMomentId = makeId();
    moments.push({ id: activeMomentId, body, date, updatedAt });
  }
  localStorage.setItem(MOMENT_KEY, JSON.stringify(moments));
  renderMoments();
  if (!quiet) { closeMomentDetail(); showToast("这句话收好啦"); }
}

function memoReminderKey(memo: MemoItem, triggerAt: number) {
  return `${memo.id}:${todayKey()}:${triggerAt}`;
}

function showDueMemoReminder() {
  if (mobileApp.classList.contains("sheet-open") || !noteDetailView.hidden || !momentDetailView.hidden || document.visibilityState !== "visible") return;
  const now = Date.now();
  const today = todayKey();
  const due = memos.find((memo) => {
    const remindMinutes = memo.remindMinutes ?? 0;
    const reminderEnabled = memo.reminderEnabled ?? Boolean(memo.time && remindMinutes >= 0);
    if (!reminderEnabled || !memo.time || (memo.reminderDate || today) !== today || Boolean(memo.completedDate) || remindMinutes < 0) return false;
    const target = new Date(`${today}T${memo.time}:00`).getTime();
    const triggerAt = target - remindMinutes * 60_000;
    const key = memoReminderKey(memo, triggerAt);
    return now >= triggerAt && now <= Math.max(triggerAt + 10 * 60_000, target + 5 * 60_000) && !acknowledgedMemoReminders.includes(key);
  });
  if (!due) return;
  const remindMinutes = due.remindMinutes ?? 0;
  const target = new Date(`${today}T${due.time}:00`).getTime();
  const triggerAt = target - remindMinutes * 60_000;
  acknowledgedMemoReminders = [...acknowledgedMemoReminders.filter((key) => key.includes(`:${today}:`)), memoReminderKey(due, triggerAt)];
  localStorage.setItem(MEMO_REMINDER_ACK_KEY, JSON.stringify(acknowledgedMemoReminders));
  void fireReminder('todo', String(triggerAt), due.id).catch(() => showToast('声音和震动还没触发，请检查手机的通知设置'));
  if (!reminderOptions('todo', due.id).popup) return;
  document.querySelector("#memo-reminder-title")!.textContent = due.title;
  document.querySelector("#memo-reminder-message")!.textContent = remindMinutes > 0
    ? `还有 ${remindMinutes} 分钟到 ${due.time}，可以开始准备啦。`
    : `${due.time} 到啦，该去完成这件事了。`;
  openSheet(memoReminderPanel);
}

const foregroundReminderEvents = new Set<string>();
function checkOtherForegroundReminders() {
  if (document.visibilityState !== 'visible') return;
  const now = Date.now(), today = todayKey();
  const deliver = (kind: 'daily' | 'countdown', trigger: number, id?: string) => {
    const key = `${kind}/${id || ''}/${trigger}`;
    if (!Number.isFinite(trigger) || now < trigger || now - trigger > 60_000 || foregroundReminderEvents.has(key)) return;
    foregroundReminderEvents.add(key);
    void fireReminder(kind, String(trigger), id).catch(() => showToast('声音和震动还没触发，请检查手机的通知设置'));
  };
  if (dailyState.enabled && !(dailyState.answerDate === today && dailyState.answer === 'done')) {
    const trigger = new Date(`${today}T${String(dailyState.hour).padStart(2, '0')}:${String(dailyState.minute).padStart(2, '0')}:00`).getTime();
    deliver('daily', trigger);
  }
  for (const item of countdowns) {
    if (item.kind === 'anniversary' || (item.remindDays ?? -1) < 0) continue;
    const trigger = new Date(`${item.date}T${item.reminderTime || '09:00'}:00`).getTime() - (item.remindDays || 0) * 86_400_000;
    deliver('countdown', trigger, item.id);
  }
}

function renderCountdowns() {
  const countdownList = document.querySelector<HTMLElement>("#countdown-list")!;
  const anniversaryList = document.querySelector<HTMLElement>("#anniversary-list")!;
  countdownList.replaceChildren();
  anniversaryList.replaceChildren();
  const today = todayKey();
  const year = Number(today.slice(0, 4));
  const thisBirthday = `${year}-01-12`;
  const birthday: CountdownItem = {
    id: "system-su-xinhao-birthday",
    title: "苏新皓生日",
    date: today > thisBirthday ? `${year + 1}-01-12` : thisBirthday,
    photo: localStorage.getItem(BIRTHDAY_PHOTO_KEY) || "",
    system: true,
  };
  const futureItems = countdowns.filter((item) => item.kind !== "anniversary" && item.date >= today).sort((left, right) => left.date.localeCompare(right.date));
  const elapsedItems = countdowns.filter((item) => item.kind === "anniversary" || item.date < today).sort((left, right) => right.date.localeCompare(left.date));
  const appendCard = (countdown: CountdownItem, destination: HTMLElement) => {
    const target = new Date(`${countdown.date}T00:00:00`);
    const days = Math.ceil((target.getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000);
    const card = document.createElement("article");
    const elapsed = destination === anniversaryList;
    const hasPhoto = Boolean(countdown.photo);
    card.className = `countdown-card ${elapsed ? "elapsed-countdown" : "upcoming-countdown"}${countdown.system ? " system-countdown" : ""}${hasPhoto ? " has-photo" : ""}`;
    card.innerHTML = `${hasPhoto ? '<img class="countdown-card-photo" alt="" />' : ""}<div class="countdown-card-copy"><b></b><small></small></div><strong></strong>`;
    if (hasPhoto) card.querySelector<HTMLImageElement>(".countdown-card-photo")!.src = countdown.photo!;
    card.querySelector("b")!.textContent = countdown.title;
    const remindDays = countdown.remindDays ?? -1;
    const remindText = remindDays < 0 ? "" : remindDays > 0 ? `提前 ${remindDays} 天提醒 · ${countdown.reminderTime || "09:00"}` : `当天提醒 · ${countdown.reminderTime || "09:00"}`;
    card.querySelector("small")!.textContent = countdown.system
      ? countdown.date
      : elapsed ? countdown.date : `${countdown.date}${remindText ? ` · ${remindText}` : ""}`;
    card.querySelector("strong")!.textContent = elapsed ? `已经 ${Math.abs(days)} 天` : days === 0 ? "就是今天" : `还有 ${days} 天`;
    bindMemoItemActions(card, () => openMemoItemActions({
      kind: countdown.system ? "倒数日 · 固定生日" : elapsed ? "纪念日" : "倒数日",
      title: countdown.title,
      photo: countdown.photo,
      editItem: countdown.system ? undefined : () => openCountdownEditor(elapsed ? "anniversary" : "countdown", countdown),
      setPhoto: countdown.system
        ? (photo) => {
          try {
            if (photo) localStorage.setItem(BIRTHDAY_PHOTO_KEY, photo);
            else localStorage.removeItem(BIRTHDAY_PHOTO_KEY);
            renderCountdowns();
            showToast(photo ? "照片收好啦" : "照片已删除");
          } catch { showToast("这张照片还没收好，试试小一点的吧"); }
        }
        : (photo) => saveMemoItemPhoto(countdown, photo, COUNTDOWN_KEY, countdowns, renderCountdowns),
      deleteItem: countdown.system ? undefined : () => {
        countdowns = countdowns.filter((item) => item.id !== countdown.id);
        localStorage.setItem(COUNTDOWN_KEY, JSON.stringify(countdowns));
        renderCountdowns();
        showToast(elapsed ? "纪念日已删除" : "倒数日已删除");
      },
    }));
    destination.append(card);
  };
  appendCard(birthday, countdownList);
  futureItems.forEach((item) => appendCard(item, countdownList));
  elapsedItems.forEach((item) => appendCard(item, anniversaryList));
  document.querySelector("#countdown-count")!.textContent = `${futureItems.length + 1} 个`;
  document.querySelector("#anniversary-count")!.textContent = `${elapsedItems.length} 个`;
  document.querySelector<HTMLElement>("#countdown-empty")!.hidden = true;
  document.querySelector<HTMLElement>("#anniversary-empty")!.hidden = elapsedItems.length > 0;
  syncNativeMemoReminders();
}

function openTodoEditor(memo: MemoItem | null = null) {
  editingMemoId = memo?.id || makeId();
  memoReminderEnabled.checked = memo?.reminderEnabled ?? Boolean(memo?.time && (memo?.remindMinutes ?? 0) >= 0);
  memoReminderOptions.hidden = !memoReminderEnabled.checked;
  document.querySelector<HTMLInputElement>("#memo-title-input")!.value = memo?.title || "";
  document.querySelector<HTMLInputElement>("#memo-reminder-date-input")!.value = memo?.reminderDate || todayKey();
  document.querySelector<HTMLInputElement>("#memo-time-input")!.value = memo?.time || "";
  document.querySelector<HTMLSelectElement>("#memo-remind-before")!.value = String(memo?.remindMinutes ?? 0);
  document.querySelector("#memo-editor-heading")!.textContent = memo ? "修改待办" : "要记下什么？";
  document.querySelector("#save-memo")!.textContent = memo ? "保存修改" : "保存待办";
  openSheet(memoEditorPanel);
}

function updateCountdownEditorMode() {
  const anniversary = countdownEditorKind === "anniversary";
  countdownReminderOptions.hidden = anniversary;
  countdownPhotoPicker.hidden = !anniversary;
  const existing = countdowns.some(item => item.id === editingCountdownId);
  document.querySelector("#countdown-editor-heading")!.textContent = existing ? (anniversary ? "修改纪念日" : "修改倒数日") : (anniversary ? "新建纪念日" : "新建倒数日");
  document.querySelector("#save-countdown")!.textContent = existing ? "保存修改" : (anniversary ? "保存纪念日" : "保存倒数日");
  countdownEditorHint.textContent = anniversary ? "保存后会显示已经过去的天数。" : "保存后会显示剩余天数。";
  countdownDateInput.max = anniversary ? todayKey() : "";
  countdownDateInput.min = anniversary ? "" : todayKey();
  if (!anniversary) {
    countdownPhotoPreview.hidden = true;
    countdownPhotoPreview.removeAttribute("src");
    countdownPhotoLabel.textContent = "选择照片";
  }
}

function openCountdownEditor(kind: "countdown" | "anniversary" = "countdown", item: CountdownItem | null = null) {
  editingCountdownId = item?.id || makeId();
  countdownEditorKind = kind;
  document.querySelector<HTMLInputElement>("#countdown-title-input")!.value = item?.title || "";
  countdownDateInput.value = item?.date || "";
  document.querySelector<HTMLSelectElement>("#countdown-remind-before")!.value = String(item?.remindDays ?? 1);
  document.querySelector<HTMLInputElement>("#countdown-remind-time")!.value = item?.reminderTime || "09:00";
  pendingCountdownPhoto = item?.photo || "";
  countdownPhotoPreview.hidden = !pendingCountdownPhoto;
  if (pendingCountdownPhoto) countdownPhotoPreview.src = pendingCountdownPhoto;
  else countdownPhotoPreview.removeAttribute("src");
  countdownPhotoLabel.textContent = pendingCountdownPhoto ? "更换照片" : "选择照片";
  updateCountdownEditorMode();
  openSheet(countdownEditorPanel);
}

document.querySelector("#add-memo")!.addEventListener("click", () => openSheet(memoCreatePanel));
document.querySelector("#add-todo")!.addEventListener("click", () => openTodoEditor());
document.querySelector("#create-todo")!.addEventListener("click", () => openTodoEditor());
document.querySelector("#create-countdown")!.addEventListener("click", () => openCountdownEditor("countdown"));
document.querySelector("#create-anniversary")!.addEventListener("click", () => openCountdownEditor("anniversary"));
document.querySelector("#create-note")!.addEventListener("click", () => { closeSheets(); openNoteDetail(); });
document.querySelector("#create-moment")!.addEventListener("click", () => { closeSheets(); openMomentDetail(); });
document.querySelector("#add-note")!.addEventListener("click", () => openNoteDetail());
document.querySelector("#add-moment")!.addEventListener("click", () => openMomentDetail());
memoReminderEnabled.addEventListener("change", () => {
  memoReminderOptions.hidden = !memoReminderEnabled.checked;
  if (memoReminderEnabled.checked && !document.querySelector<HTMLInputElement>("#memo-time-input")!.value) {
    const nextHour = new Date(Date.now() + 60 * 60_000);
    document.querySelector<HTMLInputElement>("#memo-reminder-date-input")!.value = todayKey();
    document.querySelector<HTMLInputElement>("#memo-time-input")!.value = `${String(nextHour.getHours()).padStart(2, "0")}:${String(nextHour.getMinutes()).padStart(2, "0")}`;
  }
});
document.querySelector("#save-memo")!.addEventListener("click", () => {
  const title = document.querySelector<HTMLInputElement>("#memo-title-input")!.value.trim();
  const reminderEnabled = memoReminderEnabled.checked;
  const reminderDate = reminderEnabled ? document.querySelector<HTMLInputElement>("#memo-reminder-date-input")!.value : "";
  const time = reminderEnabled ? document.querySelector<HTMLInputElement>("#memo-time-input")!.value : "";
  const remindMinutes = reminderEnabled ? Number(document.querySelector<HTMLSelectElement>("#memo-remind-before")!.value) : -1;
  if (!title) { showToast("请先写下事项名称"); return; }
  if (reminderEnabled && (!reminderDate || !time)) { showToast("开启提醒时需要选择日期和时间"); return; }
  const existing = memos.find((item) => item.id === editingMemoId);
  if (existing) Object.assign(existing, { title, time, remindMinutes, reminderEnabled, reminderDate });
  else memos.push({ id: editingMemoId || makeId(), title, time, completedDate: "", remindMinutes, reminderEnabled, reminderDate });
  localStorage.setItem(MEMO_KEY, JSON.stringify(memos));
  editingMemoId = null;
  renderMemos(); closeSheets();
  if (reminderEnabled) showReminderSettingsHelp('todo');
});
document.querySelector("#add-countdown")!.addEventListener("click", () => openCountdownEditor("countdown"));
document.querySelector("#add-anniversary")!.addEventListener("click", () => openCountdownEditor("anniversary"));
countdownDateInput.addEventListener("change", updateCountdownEditorMode);
countdownPhotoInput.addEventListener("change", async () => {
  const file = countdownPhotoInput.files?.[0];
  countdownPhotoInput.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) { showToast("请选择 12MB 以内的图片"); return; }
  try {
    const result = await cropImage(file, "keepsake");
    if (!result) return;
    pendingCountdownPhoto = result;
    countdownPhotoPreview.src = result;
    countdownPhotoPreview.hidden = false;
    countdownPhotoLabel.textContent = "更换照片";
  } catch { showToast("这张照片没打开，换一张试试吧"); }
});
document.querySelector("#save-countdown")!.addEventListener("click", () => {
  const title = document.querySelector<HTMLInputElement>("#countdown-title-input")!.value.trim();
  const date = document.querySelector<HTMLInputElement>("#countdown-date-input")!.value;
  const anniversary = countdownEditorKind === "anniversary";
  const remindDays = anniversary ? -1 : Number(document.querySelector<HTMLSelectElement>("#countdown-remind-before")!.value);
  const reminderTime = document.querySelector<HTMLInputElement>("#countdown-remind-time")!.value || "09:00";
  if (!title || !date) { showToast("请填写名称和日期"); return; }
  if (!anniversary && date < todayKey()) { showToast("倒数日请选择今天或未来日期"); return; }
  if (anniversary && date > todayKey()) { showToast("纪念日请选择今天或过去日期"); return; }
  const existing = countdowns.find((item) => item.id === editingCountdownId);
  if (existing) Object.assign(existing, { title, date, kind: anniversary ? "anniversary" : "countdown", remindDays, reminderTime, photo: pendingCountdownPhoto });
  else countdowns.push({ id: editingCountdownId || makeId(), title, date, kind: anniversary ? "anniversary" : "countdown", remindDays, reminderTime, photo: anniversary ? pendingCountdownPhoto : "" });
  localStorage.setItem(COUNTDOWN_KEY, JSON.stringify(countdowns));
  editingCountdownId = null;
  renderCountdowns(); closeSheets();
  if (!anniversary && remindDays >= 0) showReminderSettingsHelp('countdown');
});

document.querySelector("#close-note-detail")!.addEventListener("click", closeNoteDetail);
document.querySelector("#save-note")!.addEventListener("click", () => saveActiveNote());
document.querySelectorAll<HTMLElement>(".rich-text-editor").forEach((editor) => editor.addEventListener("input", () => {
  if (editor.innerText.length <= 4000) return;
  editor.innerHTML = sanitizeRichHtml(editor.innerHTML);
  while (editor.innerText.length > 4000 && editor.lastChild) editor.lastChild.remove();
  if (editor === noteBodyInput) noteMediaEditor.open();
  showToast("最多可以写 4000 个字");
}));
document.querySelectorAll<HTMLElement>(".rich-text-toolbar").forEach((toolbar) => {
  toolbar.addEventListener("pointerdown", (event) => event.preventDefault());
  toolbar.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-rich-action]");
  if (!button) return;
  const editor = document.querySelector<HTMLElement>(`#${toolbar.dataset.richTarget}`);
  if (editor) applyRichTextFormat(editor, button.dataset.richAction || "body");
  });
});
noteDeleteButton.addEventListener("click", async () => {
  if (!activeNoteId || !await confirmAction("删除这条便签？\n删除后无法恢复。")) return;
  if (!deleteNoteRecords(notes.filter((item) => item.id !== activeNoteId))) return;
  renderNotes();
  closeNoteDetail();
  showToast("便签已删除");
});
document.querySelector("#close-moment-detail")!.addEventListener("click", closeMomentDetail);
document.querySelector("#save-moment")!.addEventListener("click", () => saveActiveMoment());
momentDeleteButton.addEventListener("click", async () => {
  if (!activeMomentId || !await confirmAction("删除这条碎碎念？\n删除后无法恢复。")) return;
  moments = moments.filter((item) => item.id !== activeMomentId);
  localStorage.setItem(MOMENT_KEY, JSON.stringify(moments));
  renderMoments();
  closeMomentDetail();
  showToast("碎碎念已删除");
});
document.querySelector("#memo-reminder-done")!.addEventListener("click", closeSheets);
document.querySelector("#memo-reminder-open")!.addEventListener("click", () => { closeSheets(); switchPage("memo"); });

function saveDailyLocal() { localStorage.setItem(DAILY_KEY, JSON.stringify(dailyState)); }

async function loadDailyState() {
  try {
    dailyState = await invoke<DailyState>("plugin:mobile-pet|daily_reminder_state");
    if (["今天做超 LIKE 了吗？", "今天超话签到了吗？", "今天超话签到了嘛？"].includes(dailyState.message)) {
      dailyState.message = "今天好好吃饭了嘛？";
      dailyState = await invoke<DailyState>("plugin:mobile-pet|save_daily_reminder", { settings: dailyState });
    }
    saveDailyLocal();
  } catch { /* Browser preview uses the local fallback. */ }
  renderDailyState();
}

function renderDailyState() {
  const done = dailyState.answerDate === todayKey() && dailyState.answer === "done";
  document.querySelector("#board-question-text")!.textContent = dailyState.message;
  document.querySelector("#memo-daily-text")!.textContent = dailyState.message;
  document.querySelector("#daily-answer-question")!.textContent = dailyState.message;
  document.querySelector<HTMLInputElement>("#daily-message")!.value = dailyState.message;
  document.querySelector<HTMLInputElement>("#daily-enabled")!.checked = dailyState.enabled;
  document.querySelector<HTMLInputElement>("#daily-time")!.value = `${String(dailyState.hour).padStart(2, "0")}:${String(dailyState.minute).padStart(2, "0")}`;
  document.querySelector("#board-question-status")!.textContent = done ? "已完成" : dailyState.enabled ? "待回答" : "已关闭";
  document.querySelector("#memo-daily-status")!.textContent = done ? "已完成" : dailyState.enabled ? "待完成" : "已关闭";
  document.querySelector("#daily-setting-summary")!.textContent = `${dailyState.message} · ${dailyState.enabled ? `每天 ${String(dailyState.hour).padStart(2, "0")}:${String(dailyState.minute).padStart(2, "0")}` : '暂时不提醒'}`;
  document.querySelector("#daily-question-card")!.classList.toggle("completed", done);
  renderNotifications();
}

function renderNotifications() {
  const today = todayKey();
  const done = dailyState.answerDate === today && dailyState.answer === 'done';
  const tasks = memos.filter(memo => memo.completedDate === today || (!memo.completedDate && (!memo.reminderDate || memo.reminderDate <= today)));
  document.querySelector('#notification-dot')!.toggleAttribute('hidden', (!dailyState.enabled || done) && !tasks.some(memo => !memo.completedDate));
  const list = document.querySelector<HTMLElement>('#notification-list')!;
  list.replaceChildren();
  if (dailyState.enabled) {
    const question = document.createElement('button'); question.type = 'button'; question.className = 'notification-item';
    const title = document.createElement('b'); title.textContent = dailyState.message;
    const status = document.createElement('small'); status.textContent = done ? '今天已完成啦 ✓' : '点一下，告诉兔兔吧';
    question.append(title, status); question.addEventListener('click', () => openSheet(dailyAnswerPanel)); list.append(question);
  }
  if (!tasks.length) { const empty = document.createElement('p'); empty.className = 'empty-message'; empty.textContent = '今天没有待办，慢慢来呀～'; list.append(empty); }
  tasks.forEach(memo => {
    const row = document.createElement('button'); row.type = 'button'; row.className = `notification-item notification-todo${memo.completedDate ? ' completed' : ''}`;
    const title = document.createElement('b'); title.textContent = `${memo.completedDate ? '✓' : '○'}  ${memo.title}`;
    const status = document.createElement('small'); status.textContent = memo.completedDate ? '已经完成啦' : `${memo.time ? memo.time + ' · ' : ''}还在等你`;
    row.append(title, status); row.addEventListener('click', () => { closeSheets(); switchPage('memo'); }); list.append(row);
  });
}

async function markPromptShown() {
  dailyState.lastShownDate = todayKey();
  saveDailyLocal();
  try { dailyState = await invoke<DailyState>("plugin:mobile-pet|mark_daily_prompt_shown"); } catch { /* local fallback */ }
  renderDailyState();
}

async function answerDaily(answer: "done" | "notYet") {
  dailyState.answer = answer;
  dailyState.answerDate = todayKey();
  saveDailyLocal();
  try { dailyState = await invoke<DailyState>("plugin:mobile-pet|answer_daily_reminder", { answer }); } catch { if (isIOS) showToast("回答已记录，但系统提醒还没有更新"); }
  renderDailyState();
  closeSheets();
  if (answer === "done") { void playOnce("smile", 6, 2); showSpeech("好耶！今天的你也很厉害～", 4_500); }
  else { showToast("没关系，稍后再提醒你"); }
}

document.querySelector("#daily-question-card")!.addEventListener("click", () => openSheet(dailyAnswerPanel));
document.querySelector("#memo-daily-card")!.addEventListener("click", () => openSheet(dailyAnswerPanel));
document.querySelector("#open-daily-settings")!.addEventListener("click", () => openSheet(dailyPanel));
async function openAppGuide(blindbox = false) {
  const panel = document.querySelector<HTMLElement>("#user-guide-panel")!;
  const content = panel.querySelector<HTMLElement>(".guide-content")!;
  const response = await fetch('/offline-blindbox/guide.json');
  const sections: Array<{title: string; points: string[]; audiences: Array<'rabbit' | 'blindbox'>}> = await response.json();
  panel.querySelector('h2')!.textContent = blindbox ? '网盘盲盒说明书' : '兔兔的说明书';
  panel.setAttribute('aria-label', blindbox ? '网盘盲盒说明书' : '兔兔的说明书');
  panel.dataset.guideKind = blindbox ? 'blindbox' : 'rabbit';
  (panel.querySelector('.sheet-eyebrow') as HTMLElement).hidden = true;
  content.replaceChildren();
  for (const section of sections.filter(section => section.audiences.includes(blindbox ? 'blindbox' : 'rabbit'))) {
    const heading = document.createElement('h3'); heading.textContent = section.title;
    const list = document.createElement('ul'); section.points.forEach(point => { const item = document.createElement('li'); appendGuideText(item, point); list.append(item); });
    const group = document.createElement('section'); group.className = 'app-guide-section'; group.append(heading, list); content.append(group);
  }
  if (blindbox) {
    const sources = document.createElement('div'); sources.className = 'archive-sources'; content.prepend(sources);
    const heading = document.createElement('h3'); heading.textContent = '去网盘逛逛';
    const description = document.createElement('p'); description.className = 'guide-paragraph'; description.textContent = '还想多逛一会儿？两份网盘在这里，高清照片、视频和小话都好好收着。';
    sources.append(heading, description);
    try {
      const links: Array<{period:string;title:string;signature:string;subtitle:string;intro:string;code:string;welcome?:string;weibo:string;pan:string}> = await (await fetch('/offline-blindbox/archive-links.json')).json();
      const copy = async (value:string, message:string) => { try { await copyText(value); showToast(message); } catch { showToast('还没复制好，再点一下试试吧'); } };
      for (const row of links) {
        const card = document.createElement('section'); card.className = 'archive-source-card';
        for (const [name,value] of [['period',row.period],['title',row.title],['signature',row.signature],['subtitle',row.subtitle],['intro',row.intro]]) {
          if (!value) continue; const line = document.createElement('p'); line.className = `archive-source-${name}`; line.textContent = value.replace(/[：:]/g, ' ').trim(); card.append(line);
        }
        const code = document.createElement('button'); code.type = 'button'; code.className = 'archive-source-code';
        for (const value of ['提取码',row.code,row.welcome || '复制']) { const label = document.createElement('span'); label.textContent = value; code.append(label); }
        code.addEventListener('click', () => void copy(row.code, '提取码已复制')); card.append(code);
        const actions = document.createElement('div'); actions.className = 'archive-link-buttons';
        for (const [label,value] of [['打开微博原帖',row.weibo],['打开网盘',`${row.pan}${row.pan.includes('?') ? '&' : '?'}pwd=${encodeURIComponent(row.code)}`]]) {
          const link = document.createElement('a'); link.textContent = label; link.href = value; link.target = '_blank'; link.rel = 'noopener noreferrer';
          link.addEventListener('click', event => {
            if (!('__TAURI_INTERNALS__' in window)) return;
            event.preventDefault();
            void invoke<{status:string}>('plugin:mobile-pet|open_external', {url:value}).then(result => {
              if (result.status === 'unsupported') window.open(value, '_blank', 'noopener,noreferrer');
            }).catch(() => showToast('这个入口还没打开，检查一下网络或浏览器吧'));
          });
          actions.append(link);
        }
        card.append(actions); sources.append(card);
      }
    } catch { const hint = document.createElement('p'); hint.textContent = '网盘的小入口还没打开，再翻一次试试吧'; sources.append(hint); }
  }
  openSheet(panel);
  const resetGuideScroll = () => {
    panel.scrollTop = 0;
    content.scrollTop = 0;
  };
  resetGuideScroll();
  window.requestAnimationFrame(() => {
    resetGuideScroll();
    window.requestAnimationFrame(resetGuideScroll);
  });
  window.setTimeout(resetGuideScroll, 80);
}
document.querySelector("#open-user-guide")!.addEventListener("click", () => void openAppGuide());
document.querySelector("#open-developer-contact")!.addEventListener("click", () => openSheet(document.querySelector<HTMLElement>("#developer-contact-panel")!));
document.querySelector('#open-version-info')!.addEventListener('click', async () => {
  const config = await import('../src-tauri/tauri.conf.json');
  document.querySelector('#app-version-number')!.textContent = config.version;
  openSheet(document.querySelector<HTMLElement>('#version-info-panel')!);
});
const memoContact = document.createElement('button');
memoContact.id = 'memo-open-ledger'; memoContact.type = 'button'; memoContact.className = 'icon-button'; memoContact.setAttribute('aria-label', '陪伴小本');
document.querySelector('.memo-apple-decoration')!.replaceWith(memoContact);
memoContact.before(document.querySelector('#add-memo')!);
function closeLedgerPreview() {
  (document.activeElement as HTMLElement)?.blur();
  closeSheets();
  for (const panel of document.querySelectorAll<HTMLElement>('.ledger-page')) {
    if (!panel.hidden) panel.querySelector<HTMLIFrameElement>('iframe')?.contentWindow?.postMessage('sanhao:secondary-reset','*');
    panel.hidden = true;
  }
  mobileApp.classList.remove('ledger-open');
}
memoContact.addEventListener('click', () => {
  openSheet(document.querySelector<HTMLElement>('#memo-companion-books')!);
});
document.querySelector('#memo-book-ledger')!.addEventListener('click', () => {
  closeSheets();
  document.querySelector<HTMLElement>('#ledger-design-panel')!.hidden = false;
  mobileApp.classList.add('ledger-open');
  document.querySelector<HTMLIFrameElement>('#ledger-design-frame')!.contentWindow?.postMessage('sanhao:ledger-refresh', '*');
});
for (const mode of ['health', 'habit']) {
  document.querySelector(`#memo-book-${mode === 'habit' ? 'habits' : mode}`)!.addEventListener('click', () => {
    closeSheets(); closeLedgerPreview();
    document.querySelector<HTMLElement>(`#${mode}-panel`)!.hidden = false;
    mobileApp.classList.add('ledger-open');
    document.querySelector<HTMLIFrameElement>(`#${mode}-frame`)!.contentWindow?.postMessage('sanhao:health-refresh', '*');
  });
}
document.querySelector('#memo-book-timetable')!.addEventListener('click', () => {
  closeSheets(); closeLedgerPreview();
  document.querySelector<HTMLElement>('#timetable-panel')!.hidden = false;
  mobileApp.classList.add('ledger-open');
  document.querySelector<HTMLIFrameElement>('#timetable-frame')!.contentWindow?.postMessage('sanhao:timetable-refresh', '*');
});
window.addEventListener('message', async event => {
  const frame = document.querySelector<HTMLIFrameElement>('#timetable-frame')!;
  if (event.source !== frame.contentWindow) return;
  if (event.data?.channel === 'sanhao:timetable-ready') { if (!frame.closest<HTMLElement>('.ledger-page')!.hidden) frame.contentWindow!.postMessage('sanhao:timetable-refresh', '*'); return; }
  if (event.data === 'sanhao:close-timetable') { closeLedgerPreview(); return; }
  if (event.data?.channel !== 'sanhao:timetable' || typeof event.data.id !== 'string' || event.data.id.length > 100) return;
  const {id, request} = event.data;
  if (!('__TAURI_INTERNALS__' in window)) { frame.contentWindow!.postMessage({channel:'sanhao:timetable-result', id, browser:true}, '*'); return; }
  try {
    const command = request.operation === 'scan' ? 'timetable_scan' : 'timetable_store';
    const result = await nativeInvoke<{snapshot?:string}>(`plugin:mobile-pet|${command}`, {payload:request.operation === 'scan' ? request.payload : JSON.stringify(request)});
    if (!result.snapshot) throw new Error('课表暂时无法读取');
    frame.contentWindow!.postMessage({channel:'sanhao:timetable-result', id, data:JSON.parse(result.snapshot)}, '*');
    if(request.operation!=='read'&&request.operation!=='scan')void syncNativeMemoReminders();
  } catch (error) { frame.contentWindow!.postMessage({channel:'sanhao:timetable-result', id, error:String(error)}, '*'); }
});
window.addEventListener('message', async event => {
  const frame = [...document.querySelectorAll<HTMLIFrameElement>('#health-frame, #habit-frame')].find(f => f.contentWindow === event.source);
  if (!frame) return;
  if (event.data?.channel === 'sanhao:health-ready') {
    if (!frame.closest<HTMLElement>('.ledger-page')!.hidden) frame.contentWindow!.postMessage('sanhao:health-refresh', '*');
    return;
  }
  if (event.data === 'sanhao:close-health') { closeLedgerPreview(); return; }
  if (event.data?.channel !== 'sanhao:health' || typeof event.data.id !== 'string' || event.data.id.length > 100) return;
  const {id, request} = event.data;
  if (!('__TAURI_INTERNALS__' in window)) { frame.contentWindow!.postMessage({channel:'sanhao:health-result', id, browser:true}, '*'); return; }
  try {
    const result = await nativeInvoke<{snapshot?: string}>('plugin:mobile-pet|health_store', {payload:JSON.stringify(request)});
    if (!result.snapshot) throw new Error('记录暂时无法读取');
    frame.contentWindow!.postMessage({channel:'sanhao:health-result', id, data:JSON.parse(result.snapshot)}, '*');
    if(request.operation!=='read'&&request.operation!=='scan')void syncNativeMemoReminders();
  } catch (error) { frame.contentWindow!.postMessage({channel:'sanhao:health-result', id, error:String(error)}, '*'); }
});
window.addEventListener('message', async event => {
  const frame = document.querySelector<HTMLIFrameElement>('#ledger-design-frame');
  if (event.source === frame?.contentWindow && event.data?.channel === 'sanhao:ledger-ready') {
    if (!document.querySelector<HTMLElement>('#ledger-design-panel')!.hidden) frame!.contentWindow!.postMessage('sanhao:ledger-refresh', '*');
    return;
  }
  if (event.source === frame?.contentWindow && event.data === 'sanhao:close-ledger-preview') closeLedgerPreview();
  if (event.source !== frame?.contentWindow || event.data?.channel !== 'sanhao:ledger' || typeof event.data.id !== 'string' || event.data.id.length > 100) return;
  const {id, request} = event.data;
  if (!('__TAURI_INTERNALS__' in window)) { frame!.contentWindow!.postMessage({channel:'sanhao:ledger-result', id, browser:true}, '*'); return; }
  try {
    const result = await nativeInvoke<{snapshot?: string}>('plugin:mobile-pet|ledger_store', {payload:JSON.stringify(request)});
    if (!result.snapshot) throw new Error('账本暂时无法读取');
    frame!.contentWindow!.postMessage({channel:'sanhao:ledger-result', id, data:JSON.parse(result.snapshot)}, '*');
  } catch (error) { frame!.contentWindow!.postMessage({channel:'sanhao:ledger-result', id, error:String(error)}, '*'); }
});
for (const [id, icon] of [['open-notifications', 'header-home'], ['open-menu', 'header-extra-home'], ['open-rabbit-memory', 'header-chat'], ['open-chat-actions', 'header-extra-chat'], ['memo-open-ledger', 'header-memo'], ['add-memo', 'header-extra-memo']]) {
  const target = document.getElementById(id)!;
  target.querySelector('svg')?.remove();
  const image = document.createElement('img'); image.src = `/${icon}.svg`; image.alt = ''; image.className = 'primary-action-icon'; target.prepend(image);
}
document.querySelector("#copy-wechat-id")!.addEventListener("click", async () => {
  try {
    await copyText("CONTACT_HANDLE");
    showToast("松饼烤好啦，去微信搜索\n「CONTACT_HANDLE」，就能找到开发团队啦",5_000);
  } catch { showToast("这次没复制好，再点一下找苹果呀"); }
});
document.querySelector('#copy-wechat-public-name')!.addEventListener('click', async () => {
  try {
    await copyText('松你一饼');
    showToast('松饼烤好啦，去微信搜索\n「松你一饼」，就能找到开发团队啦',5_000);
  } catch { showToast('名字还没装进口袋，再点一下试试吧'); }
});
document.querySelector("#daily-done")!.addEventListener("click", () => void answerDaily("done"));
document.querySelector("#daily-not-yet")!.addEventListener("click", () => void answerDaily("notYet"));
document.querySelector("#daily-dismiss")!.addEventListener("click", () => {
  closeSheets();
  if (isIOS) void invoke('plugin:mobile-pet|answer_daily_reminder', {answer: 'later'}).catch(() => showToast('稍后提醒没有保存，请再试一下'));
  showToast("好的，今天稍后再问你");
});
document.querySelector("#save-daily-settings")!.addEventListener("click", async () => {
  const [hour, minute] = document.querySelector<HTMLInputElement>("#daily-time")!.value.split(":").map(Number);
  dailyState = {
    ...dailyState,
    enabled: document.querySelector<HTMLInputElement>("#daily-enabled")!.checked,
    message: document.querySelector<HTMLInputElement>("#daily-message")!.value.trim() || "今天好好吃饭了嘛？",
    hour: Number.isFinite(hour) ? hour : 20,
    minute: Number.isFinite(minute) ? minute : 0,
  };
  saveDailyLocal();
  try {
    dailyState = await invoke<DailyState>("plugin:mobile-pet|save_daily_reminder", { settings: dailyState });
    showToast(dailyState.notificationPermission === "denied" ? "约好啦，记得允许通知，兔兔才能来敲门" : "时间约好啦，兔兔会来提醒你");
  } catch { showToast("约好啦，打开这里也能看到询问"); }
  renderDailyState(); closeSheets();
  if (dailyState.enabled) showReminderSettingsHelp('daily');
});

function applyUserAvatar(source: string) {
  const next = source || "/avatar-white.svg";
  localStorage.setItem(USER_AVATAR_KEY, next);
  userAvatar = next;
  document.querySelectorAll<HTMLImageElement>(".chat-line.user .chat-avatar").forEach((avatar) => { avatar.src = userAvatar; });
}

async function clearChatHistory() {
  if (!await confirmAction("只删除全部聊天记录吗？备忘录、纪念日和外观设置都会保留。")) return;
  if (!await commitChatMutation("plugin:mobile-pet|unified_clear_conversation")) return;
  chatHistory = [];
  localStorage.removeItem(CHAT_KEY);
  localStorage.removeItem(CHAT_MEMORY_KEY);
  localStorage.removeItem(MANUAL_MEMORY_KEY);
  if (isIOS) localStorage.removeItem('hhxx.ios.archive-memory.v1');
  conversationMemory = { name: "", preferredAddress: "", userRole: "", petRole: "", likes: [], currentTopic: "", lastEmotion: "" };
  chatLog.replaceChildren();
  appendMessage("pet", INITIAL_CHAT_GREETING, false);
  showToast("聊天记录已删除");
}

function renderRecordGroups() {
  const groups = document.querySelector('#records-groups')!; groups.replaceChildren();
  const countdownKind = (item: CountdownItem) => item.kind === 'anniversary' || item.date < todayKey() ? 'anniversary' : 'countdown';
  const kinds = [
    { key: 'todo', title: '待办事项', count: memos.length },
    { key: 'countdown', title: '倒数日', count: countdowns.filter(item => !item.system && countdownKind(item) === 'countdown').length },
    { key: 'anniversary', title: '纪念日', count: countdowns.filter(item => !item.system && countdownKind(item) === 'anniversary').length },
    { key: 'note', title: '便签本', count: notes.length },
    { key: 'moment', title: '碎碎念', count: moments.length },
    { key: 'chat', title: '聊天记录', count: chatHistory.length },
    { key: 'favorites', title: '收藏夹', count: chatFavorites.length },
  ];
  const memoGroup = document.createElement('section'); memoGroup.className = 'records-group'; memoGroup.innerHTML = '<h3>备忘录</h3>';
  kinds.forEach(kind => {
    const group = ['chat', 'favorites'].includes(kind.key) ? document.createElement('section') : memoGroup;
    if (group !== memoGroup) group.className = 'records-group';
    const row = document.createElement('div'); row.className = 'records-row';
    const title = document.createElement('b'); title.textContent = kind.title;
    const count = document.createElement('small'); count.textContent = `${kind.count} 条`;
    const action = document.createElement('button'); action.type = 'button'; action.textContent = '清理'; action.disabled = !kind.count;
    action.addEventListener('click', async () => {
      if (kind.key === 'chat') { await clearChatHistory(); renderRecordGroups(); return; }
      if (!await confirmAction(`清理${kind.title}？\n其他记录会保留。`)) return;
      if (kind.key === 'todo') { memos = []; localStorage.setItem(MEMO_KEY, '[]'); }
      if (['countdown', 'anniversary'].includes(kind.key)) { countdowns = countdowns.filter(item => item.system || countdownKind(item) !== kind.key); localStorage.setItem(COUNTDOWN_KEY, JSON.stringify(countdowns)); }
      if (kind.key === 'note') { if (!deleteNoteRecords([])) return; }
      if (kind.key === 'moment') { moments = []; localStorage.setItem(MOMENT_KEY, '[]'); }
      if (kind.key === 'favorites') { chatFavorites = []; localStorage.setItem(CHAT_FAVORITES_KEY, '[]'); }
      renderMemos(); renderCountdowns(); renderNotes(); renderMoments(); renderChatFavorites(); syncNativeMemoReminders(); renderRecordGroups(); showToast('这一类收拾好啦');
    });
    row.append(title, count, action); group.append(row);
    if (group !== memoGroup) { const hint = document.createElement('p'); hint.textContent = kind.key === 'chat' ? '收藏好的内容不会一起删。' : '只移除收藏，原来的聊天还在。'; group.append(hint); }
    if (!group.isConnected) groups.append(group);
  });
  void appendDailyCleanupRows(groups,async()=>{
    for(const [id,event] of [['ledger-design-frame','ledger'],['health-frame','health'],['habit-frame','health'],['timetable-frame','timetable']])
      document.querySelector<HTMLIFrameElement>('#'+id)?.contentWindow?.postMessage('sanhao:'+event+'-refresh','*');
    await syncNativeMemoReminders();
  },showToast);
}
document.querySelector('#export-data')!.addEventListener('click', () => { renderRecordGroups(); openSheet(document.querySelector<HTMLElement>('#records-panel')!); });
const archiveRangeCalendars=setupArchiveRangeCalendar(showToast);
document.querySelector('#open-archive-range')!.addEventListener('click', () => {
  if(getChatMode()==='chat') { void renderRabbitMemory().then(()=>openSheet(document.querySelector<HTMLElement>('#rabbit-memory-panel')!)); return; }
  void archiveRangeCalendars.open();
  openSheet(document.querySelector<HTMLElement>('#archive-range-panel')!);
});
document.querySelector('#save-archive-range')!.addEventListener('click', () => {
  const start = document.querySelector<HTMLInputElement>('#archive-range-start')!.value, end = document.querySelector<HTMLInputElement>('#archive-range-end')!.value;
  if (!start || !end || start > end) { showToast('再看看起止日期吧'); return; }
  localStorage.setItem('sanhao.offline-range', JSON.stringify({start, end})); closeSheets(); showToast('这段日子收好啦');
});
noteTitleInput.addEventListener('input', () => saveActiveNote(true));
noteBodyInput.addEventListener('input', () => saveActiveNote(true));
momentDateInput.addEventListener('input', () => saveActiveMoment(true));
momentBodyInput.addEventListener('input', () => saveActiveMoment(true));

let resetHomeBoard = () => {};
function setupBoardDrag() {
  const board = document.querySelector<HTMLElement>("#home-board")!;
  const handle = document.querySelector<HTMLElement>("#board-drag-handle")!;
  const saved = readJson<{x:number;y:number}>(BOARD_POSITION_KEY,defaultBoardCorner);
  let point = Number.isFinite(saved.x) && Number.isFinite(saved.y) ? saved : {...defaultBoardCorner};
  let drag: {x:number;y:number;left:number;top:number} | undefined;
  const apply = () => {
    const rect=room.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    const projected=roomPoint(rect,point);
    board.style.transform='none';
    board.style.left=`${projected.x-rect.left-room.clientLeft}px`;
    board.style.top=`${projected.y-rect.top-room.clientTop}px`;
  };
  resetHomeBoard = apply;
  new ResizeObserver(apply).observe(room);
  apply();
  handle.addEventListener("pointerdown", event => {
    handle.setPointerCapture(event.pointerId);
    const rect=board.getBoundingClientRect();
    drag={x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};
  });
  handle.addEventListener("pointermove", event => {
    if (!drag || !handle.hasPointerCapture(event.pointerId)) return;
    const rect=room.getBoundingClientRect(),boardRect=board.getBoundingClientRect();
    const x=Math.max(rect.left,Math.min(rect.right-boardRect.width,drag.left+event.clientX-drag.x));
    const y=Math.max(rect.top,Math.min(rect.bottom-boardRect.height,drag.top+event.clientY-drag.y));
    point=artworkPoint(rect,{x,y}); apply();
  });
  const finish = (event: PointerEvent) => {
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    drag=undefined;
    localStorage.setItem(BOARD_POSITION_KEY, JSON.stringify(point));
  };
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
}

function setupHomeLights() {
  const projectLights = () => {
    const { width, height } = room.getBoundingClientRect();
    if (!width || !height) return;
    const scale = Math.max(width / 1038, height / 1516);
    const top = (height - 1516 * scale) / 2;
    document.querySelectorAll<HTMLElement>('.floor-light').forEach((button, index) => {
      button.style.left = `${(width - 1038 * scale) / 2 + 519 * scale}px`;
      button.style.top = `${top + (index ? 817 : 234) * scale}px`;
      button.style.setProperty('--lamp-spread-width', `${800 * scale}px`);
      button.style.setProperty('--lamp-spread-height', `${580 * scale}px`);
      button.style.setProperty('--lamp-core-width', `${250 * scale}px`);
      button.style.setProperty('--lamp-core-height', `${180 * scale}px`);
      button.style.setProperty('--lamp-source-offset', `${24 * scale}px`);
    });
  };
  if (typeof ResizeObserver === 'function') new ResizeObserver(projectLights).observe(room);
  else window.addEventListener('resize', projectLights);
  projectLights();
  const stored = readJson<boolean[]>(HOME_LIGHTS_KEY, [false, false]);
  document.querySelectorAll<HTMLButtonElement>(".floor-light").forEach((button, index) => {
    const apply = (on: boolean) => {
      button.classList.toggle("on", on);
      button.setAttribute("aria-pressed", String(on));
    };
    apply(Boolean(stored[index]));
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      stored[index] = !stored[index];
      apply(stored[index]);
      localStorage.setItem(HOME_LIGHTS_KEY, JSON.stringify(stored));
    });
  });
  setupHomeLightCycle(on => {
    document.querySelectorAll<HTMLButtonElement>('.floor-light').forEach((button,index)=>{stored[index]=on;button.classList.toggle('on',on);button.setAttribute('aria-pressed',String(on))});
    localStorage.setItem(HOME_LIGHTS_KEY,JSON.stringify(stored));
  });
}

async function showDailyPromptIfNeeded() {
  if (!dailyState.enabled || dailyState.answerDate === todayKey() || dailyState.lastShownDate === todayKey()) return;
  await markPromptShown();
  if (!reminderOptions('daily').popup) return;
  window.setTimeout(() => openSheet(dailyAnswerPanel), 650);
}

window.visualViewport?.addEventListener("resize", keepChatInputVisible);
window.visualViewport?.addEventListener("scroll", syncViewportHeight);
window.addEventListener("resize", syncViewportHeight);

let mobileInitialized = false;
async function initializeMobileApp() {
  if (mobileInitialized) return;
  mobileInitialized = true;
  let lastSnapshotBody = '', lastSnapshotDate = '';
  iosCompanions = setupIOSCompanions({
    toast: showToast, openSheet, scale: () => petScale, setScale:applyScale, working: () => working,
    focus: () => ({revision: focusInputRevision, id: focusSessionID,
      phase: timerDeadline > Date.now() ? 'running' : timerPaused ? 'paused' : 'idle',
      deadlineMs: timerDeadline, remainingMs: Math.round(timerRemainingMs)}),
    observeFocusRevision: (revision, bootstrap) => {
      focusInputRevision = Math.max(focusInputRevision, revision) + (bootstrap ? 1 : 0);
      localStorage.setItem(FOCUS_REVISION_KEY, String(focusInputRevision));
    },
    replyContext: () => ({
      todos: memos.map(({title, completedDate, reminderDate}) => ({title, completedDate, date: reminderDate})),
      daily: { enabled: dailyState.enabled, done: dailyState.answerDate === todayKey() && dailyState.answer === 'done', question: dailyState.message },
    }),
    snapshot: () => {
      const records = {
        daily: {enabled: dailyState.enabled, done: dailyState.answerDate === todayKey() && dailyState.answer === "done", question: dailyState.message},
        todos: memos.map(({id, title, time, completedDate, reminderDate}) => ({id, title, time, completedDate, date: reminderDate})),
        days: countdowns.map(({id, title, date, kind}) => ({id, title, date, kind: kind || 'countdown'})),
        notes: [...notes].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 400).map(({id, title, body, updatedAt}) => ({id, title, body: notePreview(body).slice(0, 500), updatedAt})),
        moments: [...moments].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 400).map(({id, body, date, updatedAt}) => ({id, title: '', body: notePreview(body).slice(0, 500), date, updatedAt})),
      };
      const body = JSON.stringify(records);
      if (body !== lastSnapshotBody) { lastSnapshotBody = body; lastSnapshotDate = new Date().toISOString(); }
      return { ...records, updatedAt: lastSnapshotDate };
    },
    applyTodos: commands => {
      let changed = false;
      for (const command of commands) {
        const item = memos.find(item => item.id === command.recordID);
        if (!item) continue;
        const desired = command.completed ? command.date : '';
        if (item.completedDate !== desired) { item.completedDate = desired; changed = true; }
      }
      if (changed) { localStorage.setItem(MEMO_KEY, JSON.stringify(memos)); renderMemos(); syncNativeMemoReminders(); }
    },
    openRecord: route => {
      switchPage('memo');
      if (route.kind === 'note') openNoteDetail(notes.some(item => item.id === route.id) ? route.id : null);
      else if (route.kind === 'moment') openMomentDetail(moments.some(item => item.id === route.id) ? route.id : null);
      else if (route.kind === 'todo') { const item = memos.find(item => item.id === route.id); if (item) openTodoEditor(item); }
      else if (route.kind === 'anniversary' || route.kind === 'countdown') { const item = countdowns.find(item => item.id === route.id); if (item) openCountdownEditor(route.kind, item); }
    },
  });
  syncViewportHeight();
  applyScale(petScale, false);
  restorePosition();
  setWorking(working);
  syncModeControls();
  timerPill.hidden = true;
  updateTimerDisplay();
  applyUserAvatar(userAvatar);
  const customize = setupChatAppearance(applyUserAvatar, showToast);
  document.querySelector('#open-chat-appearance')!.addEventListener('click', () => openSheet(document.querySelector<HTMLElement>('#chat-appearance-panel')!));
  document.querySelectorAll<HTMLButtonElement>('[data-chat-appearance]').forEach(button => button.addEventListener('click', () => {
    closeSheets(); customize(button.dataset.chatAppearance as AppearanceTarget);
  }));
  // Refresh archive-only captions; retain the previous wording for recovery.
  const archiveRows = await startupDeadline(loadArchives().then(catalog => new Map(catalog.rows.map(item => [item.id, item]))), 5000, new Map<string, ArchiveItem>());
  const refreshArchiveRecord = <T extends ChatRecord>(item: T): T => {
    if (item.role !== 'pet' || !item.archive) return item;
    const archive = archiveRows.get(item.archive.id); if (!archive) return item;
    if (archive.kind === 'letter') return { ...item, archive };
    const message = reviewedCaption(archive);
    return { ...item, archive, message, ...(item.message !== message ? { previousArchiveMessage: item.previousArchiveMessage || item.message } : {}) };
  };
  chatHistory = chatHistory.map(refreshArchiveRecord);
  chatFavorites = chatFavorites.map(refreshArchiveRecord);
  localStorage.setItem(CHAT_FAVORITES_KEY, JSON.stringify(chatFavorites));
  chatHistory = chatHistory.map((item) => {
    if (item.role !== "pet") return item;
    if (
      item.message.includes("以苏新皓为灵感") ||
      item.message.includes("不是真人本人") ||
      item.message.includes("我是三好兔，也是苏新皓")
    ) {
      return { ...item, message: "我大名苏新皓，小名帅帅。现在是三好兔的样子，来陪你聊天、互动呀。" };
    }
    if (
      item.message.includes("不过这里的我是一只负责陪伴你的兔子") ||
      item.message.includes("三好兔就是苏新皓") ||
      item.message.includes("登陆少年组合的苏新皓")
    ) {
      return { ...item, message: "苏新皓，熟悉一点的话也可以叫我帅帅。今天想聊舞台，还是聊聊你的心情？" };
    }
    if (item.message.includes("小苏兔认真听你说")) {
      return { ...item, message: "你好呀，又见面啦。你今天想从哪件事开始说？" };
    }
    return item;
  });
  localStorage.setItem(CHAT_KEY, JSON.stringify(chatHistory));
  renderActiveChatMode(true);
  renderMemos();
  renderCountdowns();
  renderNotes();
  renderMoments();
  renderChatFavorites();
  setupBoardDrag();
  setupChatTypography();
  const routines=setupRoutineReminders({open:openSheet,close:closeSheets,toast:showToast,sync:syncNativeMemoReminders});
  setupReminderStyles(openSheet, showToast, {
    todo: () => ({kind:'todo', id: editingMemoId || undefined, title: document.querySelector<HTMLInputElement>('#memo-title-input')!.value.trim() || '这件待办'}),
    countdown: () => ({kind:'countdown', id: editingCountdownId || undefined, title: document.querySelector<HTMLInputElement>('#countdown-title-input')!.value.trim() || '这个倒数日'}),
    changed: syncNativeMemoReminders,
    entries: () => [
      {kind:'daily', title: dailyState.message, detail: dailyState.enabled ? `每天 ${String(dailyState.hour).padStart(2,'0')}:${String(dailyState.minute).padStart(2,'0')}` : '暂时不提醒', edit: () => openSheet(dailyPanel)},
      ...memos.map(memo => ({kind:'todo' as const, id:memo.id, title:memo.title, detail: memo.completedDate ? '已经完成啦' : (memo.reminderEnabled ?? Boolean(memo.time && (memo.remindMinutes ?? 0) >= 0)) && memo.time ? `${memo.reminderDate || todayKey()} · ${memo.time}` : '还没约好提醒时间', edit: () => openTodoEditor(memo)})),
      ...countdowns.filter(item => item.kind !== 'anniversary').map(item => ({kind:'countdown' as const, id:item.id, title:item.title, detail: `${item.date} · ${(item.remindDays ?? -1) < 0 ? '暂时不提醒' : item.remindDays ? `提前 ${item.remindDays} 天 · ${item.reminderTime || '09:00'}` : `当天 · ${item.reminderTime || '09:00'}`}`, edit: () => openCountdownEditor('countdown', item)})),
      {kind:'focus', title:'专注倒计时', detail:'结束时提醒，也可以提前一点点', edit: () => openSheet(timerPanel)},
      ...routines.entries(),
      {kind:'weather', title:'天气小叮咛', edit:()=>openSheet(document.querySelector<HTMLElement>('#weather-settings-panel')!)},
    ],
  });
  void renderRabbitMemory();
  if (isIOS && timerDeadline) {
    if (timerDeadline > Date.now()) {
      timerInterval = window.setInterval(updateTimerDisplay, 250); setWorking(true); updateTimerDisplay();
    } else { finishTimer(); }
  } else if (isIOS && timerPaused) { timerPause.textContent = '继续'; updateTimerDisplay(); }
  setupHomeLights();
  if (isIOS) setupIOSExternalLinks(showToast);
  scheduleIdleAction();
  finishStartup();
  await startupDeadline(Promise.all([refreshOverlayStatus(), loadDailyState()]), 3500, undefined);
  await showDailyPromptIfNeeded();
  showDueMemoReminder();
  window.setInterval(checkOtherForegroundReminders, 1000);
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", () => { void initializeMobileApp().catch(failStartup); }, { once: true });
} else {
  void initializeMobileApp().catch(failStartup);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    void Promise.all([refreshOverlayStatus(), loadDailyState()]);
    showDueMemoReminder();
  }
});

window.addEventListener("focus", () => { void refreshOverlayStatus(); });
window.addEventListener('sanhao-overlay-changed', () => { void refreshOverlayStatus(); });
// Also catch closing from the rabbit's own menu or the foreground notification.
window.setInterval(() => {
  if (document.visibilityState === "visible" && "__TAURI_INTERNALS__" in window) void refreshOverlayStatus();
}, 1500);

window.setInterval(showDueMemoReminder, 15_000);
