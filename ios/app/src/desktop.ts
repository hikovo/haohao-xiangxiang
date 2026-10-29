import {
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
} from "@tauri-apps/api/window";

type AnimationName =
  | "blink"
  | "swingRight"
  | "swingLeft"
  | "hop"
  | "wink"
  | "dizzy"
  | "wait"
  | "typing"
  | "smile";

type AnimationSpec = {
  row: number;
  frames: number;
  frameMs: number;
  baselineOffset?: number;
};

const animations: Record<AnimationName, AnimationSpec> = {
  blink: { row: 0, frames: 6, frameMs: 115 },
  swingRight: { row: 1, frames: 8, frameMs: 105 },
  swingLeft: { row: 2, frames: 8, frameMs: 105 },
  hop: { row: 3, frames: 4, frameMs: 105 },
  wink: { row: 4, frames: 5, frameMs: 125, baselineOffset: -1 },
  dizzy: { row: 5, frames: 8, frameMs: 105 },
  wait: { row: 6, frames: 6, frameMs: 180 },
  typing: { row: 7, frames: 6, frameMs: 115 },
  smile: { row: 8, frames: 6, frameMs: 145 },
};

const appWindow = getCurrentWindow();
const stage = document.querySelector<HTMLElement>("#stage")!;
const pet = document.querySelector<HTMLButtonElement>("#pet")!;
const menu = document.querySelector<HTMLElement>("#pet-menu")!;
const workToggle = document.querySelector<HTMLButtonElement>("#work-toggle")!;
const sizeSlider = document.querySelector<HTMLInputElement>("#size-slider")!;
const sizeValue = document.querySelector<HTMLOutputElement>("#size-value")!;
const resetPosition = document.querySelector<HTMLButtonElement>("#reset-position")!;
const quit = document.querySelector<HTMLButtonElement>("#quit")!;
const confirmMenu = document.querySelector<HTMLButtonElement>("#confirm-menu")!;

const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const POSITION_KEY = "sanhao-tune.window-position.v1";
const SIZE_KEY = "sanhao-tune.pet-size.v2";
const DEFAULT_SIZE = 55;
const MIN_SIZE = 40;
const MAX_SIZE = 100;
const SIZE_STEP = 5;
const MENU_PANEL_WIDTH = 176;
const MENU_PANEL_HEIGHT = 208;
const MENU_GAP = 12;
const WINDOW_PADDING = 12;

let animationRun = 0;
let currentPriority = 0;
let working = false;
let dragging = false;
let pointerStart: {
  x: number;
  y: number;
  id: number;
  startedAt: number;
  allowDrag: boolean;
} | null = null;
let clickTimes: number[] = [];
let idleTimer: number | undefined;
let petSizePercent = DEFAULT_SIZE;
let petScale = DEFAULT_SIZE / 100;
let lastPointerUpAt = 0;

const DRAG_DISTANCE = 12;
const DRAG_HOLD_MS = 80;
const DOUBLE_CLICK_WINDOW_MS = 420;

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function setFrame(row: number, frame: number, baselineOffset = 0) {
  const x = -frame * CELL_WIDTH * petScale;
  const y = (-row * CELL_HEIGHT + baselineOffset) * petScale;
  pet.style.backgroundPosition = `${x}px ${y}px`;
}

function setIdleFrame() {
  setFrame(0, 0);
  pet.dataset.animation = "idle";
}

function touchActivity() {
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    if (!working && !dragging && menu.hidden) void playOnce("wait", 1, 2);
  }, 24_000);
}

function restoreBackgroundState() {
  currentPriority = 0;
  if (working) {
    startLoop("typing", 2);
  } else {
    setIdleFrame();
    touchActivity();
  }
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

function scheduleBlink() {
  const delay = 3_000 + Math.random() * 3_500;
  window.setTimeout(async () => {
    if (!working && !dragging && menu.hidden && currentPriority === 0) {
      await playOnce("blink", 1);
    }
    scheduleBlink();
  }, delay);
}

function petWindowSize(percent = petSizePercent) {
  const scale = percent / 100;
  return {
    width: Math.round(CELL_WIDTH * scale + 24),
    height: Math.round(CELL_HEIGHT * scale + 24),
  };
}

async function resizeWindowToPet() {
  const size = petWindowSize();
  await appWindow.setSize(new LogicalSize(size.width, size.height));
}

function menuWindowSize() {
  const width = WINDOW_PADDING * 2 + CELL_WIDTH + MENU_GAP + MENU_PANEL_WIDTH;
  const height = WINDOW_PADDING * 2 + Math.max(CELL_HEIGHT, MENU_PANEL_HEIGHT);
  return { width, height };
}

async function openMenu() {
  if (!menu.hidden) return;

  const previousPosition = await appWindow.outerPosition();
  const scaleFactor = await appWindow.scaleFactor();
  const petWidth = Math.round(CELL_WIDTH * petScale);
  const size = menuWindowSize();
  stage.style.visibility = "hidden";
  menu.hidden = false;
  stage.classList.add("menu-open");
  try {
    await Promise.all([
      appWindow.setSize(new LogicalSize(size.width, size.height)),
      appWindow.setPosition(
        new PhysicalPosition(
          previousPosition.x + Math.round((petWidth - CELL_WIDTH) * scaleFactor),
          previousPosition.y,
        ),
      ),
    ]);
  } finally {
    stage.style.visibility = "";
  }
}

async function closeMenu() {
  if (menu.hidden) return;

  const previousPosition = await appWindow.outerPosition();
  const scaleFactor = await appWindow.scaleFactor();
  const petWidth = Math.round(CELL_WIDTH * petScale);
  const size = petWindowSize();
  stage.style.visibility = "hidden";
  menu.hidden = true;
  stage.classList.remove("menu-open");
  try {
    await Promise.all([
      appWindow.setSize(new LogicalSize(size.width, size.height)),
      appWindow.setPosition(
        new PhysicalPosition(
          previousPosition.x + Math.round((CELL_WIDTH - petWidth) * scaleFactor),
          previousPosition.y,
        ),
      ),
    ]);
    await savePosition();
  } finally {
    stage.style.visibility = "";
  }
}

async function savePosition() {
  const position = await appWindow.outerPosition();
  localStorage.setItem(POSITION_KEY, JSON.stringify({ x: position.x, y: position.y }));
}

async function restorePosition() {
  const saved = localStorage.getItem(POSITION_KEY);
  if (!saved) return;
  try {
    const position = JSON.parse(saved) as { x: number; y: number };
    if (Number.isFinite(position.x) && Number.isFinite(position.y)) {
      await appWindow.setPosition(new PhysicalPosition(position.x, position.y));
    }
  } catch {
    localStorage.removeItem(POSITION_KEY);
  }
}

async function applyPetSize(percent: number, save = true) {
  const clamped = Math.min(MAX_SIZE, Math.max(MIN_SIZE, percent));
  const snapped = Math.round(clamped / SIZE_STEP) * SIZE_STEP;
  petSizePercent = snapped;
  petScale = snapped / 100;
  document.documentElement.style.setProperty("--pet-scale", String(petScale));
  const spec = animations[(pet.dataset.animation ?? "blink") as AnimationName];
  setFrame(spec?.row ?? 0, 0, spec?.baselineOffset);
  sizeSlider.value = String(snapped);
  sizeValue.textContent = `${snapped}%`;
  if (menu.hidden) await resizeWindowToPet();
  if (save) localStorage.setItem(SIZE_KEY, String(snapped));
}

function restorePetSize() {
  const saved = Number(localStorage.getItem(SIZE_KEY));
  return Number.isFinite(saved) && saved >= MIN_SIZE && saved <= MAX_SIZE
    ? saved
    : DEFAULT_SIZE;
}

pet.addEventListener("pointerenter", () => {
  touchActivity();
  if (!dragging && menu.hidden) void playOnce("hop", 3);
});

pet.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  void closeMenu();
  touchActivity();
  const now = performance.now();
  pointerStart = {
    x: event.screenX,
    y: event.screenY,
    id: event.pointerId,
    startedAt: now,
    allowDrag: now - lastPointerUpAt > DOUBLE_CLICK_WINDOW_MS,
  };
  pet.setPointerCapture(event.pointerId);
});

pet.addEventListener("pointermove", async (event) => {
  if (!pointerStart || dragging || event.pointerId !== pointerStart.id) return;
  const dx = event.screenX - pointerStart.x;
  const dy = event.screenY - pointerStart.y;
  if (!pointerStart.allowDrag) return;
  if (performance.now() - pointerStart.startedAt < DRAG_HOLD_MS) return;
  if (Math.hypot(dx, dy) < DRAG_DISTANCE) return;

  dragging = true;
  startLoop(dx < 0 ? "swingLeft" : "swingRight", 5);
  try {
    await appWindow.startDragging();
    await savePosition();
  } finally {
    pointerStart = null;
    dragging = false;
    restoreBackgroundState();
  }
});

pet.addEventListener("pointerup", (event) => {
  if (!pointerStart || event.pointerId !== pointerStart.id) return;
  pointerStart = null;
  if (dragging) return;

  const now = Date.now();
  const isRapidSecondClick = performance.now() - lastPointerUpAt <= DOUBLE_CLICK_WINDOW_MS;
  lastPointerUpAt = performance.now();
  clickTimes = [...clickTimes.filter((time) => now - time < 1_100), now];
  if (clickTimes.length >= 4) {
    clickTimes = [];
    void playOnce("dizzy", 4, 2);
  } else if (!isRapidSecondClick) {
    void playOnce("wink", 4);
  }
});

pet.addEventListener("dblclick", (event) => {
  event.preventDefault();
  event.stopPropagation();
  pointerStart = null;
});

pet.addEventListener("pointercancel", () => {
  pointerStart = null;
});

pet.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  touchActivity();
  if (menu.hidden) void openMenu();
  else void closeMenu();
});

document.addEventListener("pointerdown", (event) => {
  if (!menu.hidden && !menu.contains(event.target as Node)) void closeMenu();
});

workToggle.addEventListener("click", () => {
  working = !working;
  workToggle.textContent = working ? "休息一下" : "一起工作";
  void closeMenu();
  touchActivity();
  if (working) startLoop("typing", 2);
  else void playOnce("smile", 3);
});

sizeSlider.addEventListener("input", () => {
  void applyPetSize(Number(sizeSlider.value));
});

resetPosition.addEventListener("click", async () => {
  await closeMenu();
  localStorage.removeItem(POSITION_KEY);
  await appWindow.center();
  await savePosition();
});

quit.addEventListener("click", async () => {
  await appWindow.close();
});

confirmMenu.addEventListener("click", () => {
  void closeMenu();
});

window.addEventListener("DOMContentLoaded", async () => {
  setIdleFrame();
  try {
    await applyPetSize(restorePetSize(), false);
    await restorePosition();
  } finally {
    await appWindow.show();
  }
  scheduleBlink();
  touchActivity();
});
