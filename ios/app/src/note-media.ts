import { cropImage } from "./image-cropper";
import { mediaId } from "./compat";
// Note bodies keep stable references; binary media lives separately in IndexedDB.
const DATABASE = "sanhao-tu.note-media.v1";
const STORE = "media";
const ID_PATTERN = /^note-media-[a-z0-9-]+$/;
type MediaKind = "image" | "video";
type MediaRecord = { id: string; kind: MediaKind; blob: Blob };
let database: Promise<IDBDatabase> | undefined;

function openDatabase() {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(request.error); };
    request.onblocked = () => { database = undefined; reject(new Error("媒体存储暂时不可用，请重新打开 App")); };
  });
}

async function putMedia(record: MediaRecord) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getMedia(id: string) {
  const db = await openDatabase();
  return new Promise<MediaRecord | undefined>((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function noteMediaIds(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  return [...root.querySelectorAll<HTMLElement>("figure[data-note-media-id]")]
    .map(element => element.dataset.noteMediaId || "").filter(id => ID_PATTERN.test(id));
}

export async function removeNoteMedia(ids: string[]) {
  if (!ids.length) return;
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    ids.forEach(id => transaction.objectStore(STORE).delete(id));
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

export function makeNoteMediaFigure(id: string, kind: MediaKind) {
  const figure = document.createElement("figure");
  figure.dataset.noteMediaId = id;
  figure.dataset.noteMediaKind = kind;
  figure.className = "note-inline-media";
  figure.contentEditable = "false";
  if (kind === "video") {
    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    figure.append(video);
  } else {
    const image = document.createElement("img");
    image.alt = "便签图片";
    figure.append(image);
  }
  return figure;
}

// Never persist temporary blob URLs, external media URLs or executable attributes.
export function sanitizeNoteMedia(element: HTMLElement) {
  if (element.tagName !== "FIGURE") return false;
  const id = element.dataset.noteMediaId || "";
  const kind = element.dataset.noteMediaKind;
  if (!ID_PATTERN.test(id) || (kind !== "image" && kind !== "video")) {
    element.remove();
  } else {
    element.replaceWith(makeNoteMediaFigure(id, kind));
  }
  return true;
}

export function setupNoteMedia(editor: HTMLElement, input: HTMLInputElement, addButton: HTMLButtonElement,
  changed: () => boolean, notify: (message: string) => void) {
  let generation = 0;
  let selection: Range | undefined;
  let busy = false;
  const urls = new Map<HTMLElement, string>();

  const captureSelection = () => {
    const selected = window.getSelection();
    if (selected?.rangeCount && editor.contains(selected.getRangeAt(0).commonAncestorContainer))
      selection = selected.getRangeAt(0).cloneRange();
  };
  const releaseUrls = () => {
    editor.querySelectorAll("video").forEach(video => video.pause());
    urls.forEach(url => URL.revokeObjectURL(url));
    urls.clear();
  };
  const hydrate = async (figure: HTMLElement, session: number) => {
    const id = figure.dataset.noteMediaId || "";
    try {
      const record = await getMedia(id);
      if (session !== generation || !editor.contains(figure)) return;
      if (!record) {
        const missing = document.createElement("span");
        missing.className = "note-media-unavailable";
        missing.textContent = "这个文件暂时打不开";
        figure.prepend(missing);
      } else {
        const media = figure.querySelector<HTMLImageElement | HTMLVideoElement>("img, video")!;
        const url = URL.createObjectURL(record.blob);
        urls.set(figure, url);
        media.src = url;
      }
    } catch {
      if (session === generation && editor.contains(figure)) notify("媒体没能打开，请重新进入便签试试");
    }
    if (session !== generation || !editor.contains(figure)) return;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "note-media-remove";
    remove.textContent = "移除";
    remove.setAttribute("aria-label", figure.dataset.noteMediaKind === "video" ? "移除便签视频" : "移除便签图片");
    remove.addEventListener("click", () => {
      const sibling = figure.nextSibling;
      figure.remove();
      if (!changed()) { editor.insertBefore(figure, sibling); return; }
      figure.querySelector("video")?.pause();
      const url = urls.get(figure);
      if (url) URL.revokeObjectURL(url);
      urls.delete(figure);
    });
    figure.append(remove);
  };

  addButton.addEventListener("click", () => {
    if (busy) return;
    captureSelection();
    input.click();
  });
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file || busy) return;
    const kind: MediaKind | undefined = file.type.startsWith("image/") ? "image"
      : file.type.startsWith("video/") ? "video" : undefined;
    if (!kind || file.type === "image/svg+xml") { notify("请选择照片或视频文件"); return; }
    if (file.size > (kind === "video" ? 200 : 20) * 1024 * 1024) {
      notify(kind === "video" ? "请选择 200MB 以内的视频" : "请选择 20MB 以内的图片"); return;
    }
    const session = generation;
    const id = `note-media-${mediaId()}`;
    busy = true;
    addButton.disabled = true;
    try {
      let blob: Blob = file.slice(0, file.size, file.type);
      if (kind === "image") {
        const cropped = await cropImage(file, "note");
        if (!cropped) return;
        const [header, encoded] = cropped.split(",");
        const raw = atob(encoded);
        blob = new Blob([Uint8Array.from(raw, char => char.charCodeAt(0))], { type: header.match(/data:([^;]+)/)?.[1] || "image/webp" });
      }
      if (session !== generation) return;
      await putMedia({ id, kind, blob });
      if (session !== generation) { await removeNoteMedia([id]); return; }
      const figure = makeNoteMediaFigure(id, kind);
      const after = document.createElement("p");
      after.append(document.createElement("br"));
      if (selection && editor.contains(selection.commonAncestorContainer)) {
        const range = selection.cloneRange();
        range.collapse(false);
        range.insertNode(figure);
        figure.after(after);
      } else editor.append(figure, after);
      selection = undefined;
      if (!changed()) { figure.remove(); after.remove(); await removeNoteMedia([id]); return; }
      await hydrate(figure, session);
      if (session !== generation) return;
      const caret = document.createRange();
      caret.selectNodeContents(after);
      caret.collapse(true);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(caret);
      figure.scrollIntoView({ block: "nearest" });
      notify(kind === "video" ? "视频放进便签啦" : "图片放进便签啦");
    } catch {
      notify("媒体没能保存，请检查手机剩余空间后再试");
    } finally { busy = false; addButton.disabled = false; }
  });

  return {
    open() {
      generation += 1;
      releaseUrls();
      selection = undefined;
      const session = generation;
      editor.querySelectorAll<HTMLElement>("figure[data-note-media-id]").forEach(figure => void hydrate(figure, session));
    },
    close() { generation += 1; releaseUrls(); selection = undefined; },
  };
}
