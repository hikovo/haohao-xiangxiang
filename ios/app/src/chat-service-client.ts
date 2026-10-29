// Only the local Vite proxy knows the development token. No token is bundled for browsers.
export const localChatEnabled = (import.meta as ImportMeta & { env: Record<string, string> }).env.VITE_CHAT_SERVICE === "1" && !("__TAURI_INTERNALS__" in window);
type State = { revision: number; currentTopic: string; messages: unknown[]; memories: Array<{ layer: string; key: string; value: string; createdAt: number }> };
let revision: number | undefined;
let queue: Promise<unknown> = Promise.resolve();
async function request(path: string, method = "GET", body?: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(`/__chat/v1/chat/${path}`, { method, cache: "no-store",
    headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 409) revision = undefined;
    throw new Error(result.error || `Chat service HTTP ${response.status}`);
  }
  if (typeof result.revision === "number") revision = Math.max(revision ?? 0, result.revision);
  return result;
}
export async function localChatInvoke<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  const operation = queue.catch(() => {}).then(async () => {
    // Existing app history is not silently imported into the new development session.
    if (command.endsWith("unified_import_legacy")) return {};
    if (revision === undefined) await request("state");
    if (command.endsWith("unified_chat")) {
      const result = await request("turn", "POST", { ...args, baseRevision: revision });
      return { ...result, trace: { runtime: result.runtime, entryPoint: args.entryPoint, plan: { act: result.act }, stateDelta: [] } };
    }
    if (command.endsWith("unified_memory_state")) {
      const state = await request("state") as unknown as State;
      return { longTerm: state.memories.filter(m => m.layer === "long_term"),
        relationship: state.memories.filter(m => m.layer === "relationship"),
        corrections: state.memories.filter(m => m.layer === "correction"),
        workingMemoryCount: Math.min(16, state.messages.length), episodic: [], currentTopic: state.currentTopic || "" };
    }
    if (command.endsWith("unified_set_manual_memory")) {
      const settings = JSON.parse(String(args.memoryJson)) as Record<string, string>;
      const values = Object.fromEntries(Object.entries(settings).map(([key, value]) =>
        [key, key === "likes" ? value.split(/[、，,]/).map(v => v.trim()).filter(Boolean) : value.trim() ? [value.trim()] : []]));
      return request("memory", "PATCH", { values, baseRevision: revision });
    }
    if (command.endsWith("unified_retract_messages")) return request("messages/retract", "POST", { messageIds: args.messageIds, baseRevision: revision });
    if (command.endsWith("unified_clear_conversation")) return request("conversation", "DELETE", { baseRevision: revision });
    throw new Error("Unsupported local chat command");
  });
  queue = operation;
  return await operation as T;
}
