// Keep newer convenience APIs from interrupting older Android WebViews.
function replaceChildren(this: Node, ...nodes: (Node | string)[]) {
  const doc = this.ownerDocument || document;
  const fragment = doc.createDocumentFragment();
  for (const node of nodes) fragment.appendChild(typeof node === "string" ? doc.createTextNode(node) : node);
  while (this.firstChild) this.removeChild(this.firstChild);
  this.appendChild(fragment);
}
for (const prototype of [Element.prototype, Document.prototype, DocumentFragment.prototype]) {
  if (!("replaceChildren" in prototype) || typeof prototype.replaceChildren !== "function") {
    Object.defineProperty(prototype, "replaceChildren", { configurable: true, writable: true, value: replaceChildren });
  }
}

function flatten(source: ArrayLike<unknown>, depth: number, result: unknown[]) {
  for (let i = 0; i < source.length; i++) {
    if (!(i in source)) continue;
    const value = source[i];
    if (depth > 0 && Array.isArray(value)) flatten(value, depth - 1, result);
    else result.push(value);
  }
  return result;
}
if (typeof Array.prototype.flat !== "function") {
  Object.defineProperty(Array.prototype, "flat", { configurable: true, writable: true,
    value: function(this: unknown[], depth = 1) { return flatten(this, Math.max(0, Math.floor(Number(depth) || 0)), []); } });
}
if (typeof Array.prototype.flatMap !== "function") {
  Object.defineProperty(Array.prototype, "flatMap", { configurable: true, writable: true,
    value: function(this: unknown[], callback: (value: unknown, index: number, source: unknown[]) => unknown, thisArg?: unknown) {
      return flatten(Array.prototype.map.call(this, callback, thisArg), 1, []);
    } });
}
if (typeof Object.fromEntries !== "function") {
  Object.defineProperty(Object, "fromEntries", { configurable: true, writable: true,
    value: function(entries: Iterable<[PropertyKey, unknown]>) {
      const result = {};
      for (const [key, value] of entries) Object.defineProperty(result, key, { value, configurable: true, enumerable: true, writable: true });
      return result;
    } });
}

export function mediaId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

let comparisonPattern: RegExp;
try { comparisonPattern = new RegExp("[\\p{P}\\p{S}\\s]", "gu"); }
catch { comparisonPattern = /[\s!-/:-@\[-`{-~\u2000-\u206f\u3000-\u303f\uff00-\uff65]/g; }
export function comparisonText(text: string): string { return text.replace(comparisonPattern, ""); }
