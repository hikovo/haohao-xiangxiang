export type ChatMode = 'archive' | 'chat';
export const chatModeKey = 'sanhao.chat-mode.v1';
export function getChatMode(): ChatMode { return localStorage.getItem(chatModeKey)==='chat'?'chat':'archive'; }
export function saveChatMode(mode: ChatMode) { localStorage.setItem(chatModeKey,mode); }
