import {invoke} from '@tauri-apps/api/core';
import {drawArchive} from './offline-blindbox';
import {getChatMode} from './chat-mode';

import {localModelPrompt,visibleLocalReply,type Turn} from './local-model-prompt';
import {recentChatContext} from './local-chat-context';
import {rememberRabbitMessage,rabbitMemoryReply} from './rabbit-memory';
let epoch = 0;
const enabled = import.meta.env.VITE_IOS_LOCAL_MODEL === '1' && '__TAURI_INTERNALS__' in window;
const previewEnabled = import.meta.env.DEV && import.meta.env.VITE_LOCAL_MODEL_PREVIEW === '1' && ['127.0.0.1','localhost'].includes(location.hostname);
let previewRequest: AbortController | undefined;
export function cancelLocalReply() {
  ++epoch;
  previewRequest?.abort();
  if(enabled) void invoke('plugin:mobile-pet|local_model',{payload:JSON.stringify({operation:'cancel'})}).catch(()=>{});
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelLocalReply()});
export async function resolveArchiveChat(message:string,recent:string[],messageId:string,history:Turn[]=[]) {
  if(getChatMode()==='archive')return drawArchive(message,recent);
  const result={reply:'我刚刚没接上，再说一次嘛',item:null,reason:'ordinary-no-match' as const};
  const context=recentChatContext(history,messageId);
  const memory=rememberRabbitMessage(localStorage,message);
  const remembered=rabbitMemoryReply(message,memory,context.filter(turn=>turn.role==='user').map(turn=>turn.message));
  if(remembered)return {...result,reply:remembered};
  if(!enabled && !previewEnabled)return result;
  const run=++epoch;
  const prompt=localModelPrompt(message,context,memory);
  let value: {status?:string;reply?:string};
  if (previewEnabled) {
    previewRequest?.abort();
    const controller=new AbortController(); previewRequest=controller;
    try {
      const response=await fetch('/__local-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,n_predict:112,temperature:.7,top_k:20,top_p:.8,repeat_penalty:1,stream:false,cache_prompt:true}),signal:controller.signal});
      if(!response.ok)throw new Error('Local response unavailable');
      const output=await response.json() as {content?:string};
      value={status:'ready',reply:output.content};
    } finally {if(previewRequest===controller)previewRequest=undefined;}
  } else {
    const response=await invoke<{snapshot?:string}>('plugin:mobile-pet|local_model',{payload:JSON.stringify({operation:'generate',prompt})});
    value=JSON.parse(response.snapshot||'{}');
  }
  if(run!==epoch)throw new DOMException('Cancelled','AbortError');
  const reply=value.status==='ready'?visibleLocalReply(value.reply||'',message,context):'';
  return {...result,reply:reply||'我刚刚没接上，再说一次嘛'};
}
