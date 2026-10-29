import {resolveArchiveChat} from './local-model-client';
import type {Turn} from './local-model-prompt';
import {RABBIT_MEMORY_KEY,MANUAL_MEMORY_KEY,readRabbitMemory,saveRabbitMemory} from './rabbit-memory';
// iOS uses the same bundled archive search as the main chat. No remote model
// or Android Kotlin service is needed for the 2.0.1 archive product.
const key = RABBIT_MEMORY_KEY;
export async function iosArchiveInvoke<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  let result: unknown;
  if (command.endsWith('unified_chat')) {
    const history = JSON.parse(localStorage.getItem('sanhao-tu.chat.v1') || '[]') as Turn[];
    const drawn = await resolveArchiveChat(String(args.message), history.flatMap(record => record.archive ? [(record.archive as {id:string}).id] : []).slice(-30),String(args.messageId),history);
    result = {reply: drawn.reply, archive: drawn.item || undefined, assistantMessageId: `${args.messageId}-assistant`, act: 'archive',
      trace: {runtime: 'ios-bundled-archive', entryPoint: args.entryPoint}};
  } else if (command.endsWith('unified_import_legacy')) {
    if (!localStorage.getItem(key)) {
      const old = JSON.parse(String(args.memoryJson || '{}'));
      const memory=localStorage.getItem(MANUAL_MEMORY_KEY)!==null?{...old,...readRabbitMemory(localStorage)}:old;
      localStorage.setItem(key, JSON.stringify({...memory, likes: Array.isArray(memory.likes) ? memory.likes.join('、') : memory.likes || ''}));
    }
    result = {status: 'imported'};
  } else if (command.endsWith('unified_set_manual_memory')) {
    saveRabbitMemory(localStorage,JSON.parse(String(args.memoryJson))); result = {status: 'saved'};
  } else if (command.endsWith('unified_memory_state')) {
    const data = readRabbitMemory(localStorage);
    const names = [['name','name'],['preferredAddress','preferred_address'],['userRole','user_role'],['petRole','pet_role']] as const;
    const entries = names.filter(([name]) => data[name]).map(([name, memoryKey]) => ({key: memoryKey, value: data[name], createdAt: 0}));
    result = {longTerm: [...entries, ...(data.likes || '').split(/[、，,]/).filter(Boolean).map(value => ({key: 'like', value, createdAt: 0}))],
      relationship: [], corrections: [], currentTopic: ''};
  } else throw new Error('Unsupported archive operation');
  return result as T;
}
