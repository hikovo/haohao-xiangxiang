import {localChatStyle} from './local-chat-style.ts';
import {recentChatContext,type ChatContextTurn} from './local-chat-context.ts';
export type Turn = ChatContextTurn;
function clean(value:unknown) { return String(value ?? '').replace(/<\|[^>]*\|>|<｜[^>]*｜>|<\/?think>/g,'').slice(0,800); }
export const CHAT_SYSTEM="你是聊天角色小苏，和用户随意说说日常。先接住用户这一句的意思，分清是谁做了什么。最近两轮只用于理解指代和接话，话题变了就跟着聊新的。用户分享喜欢或问近况时，回应这件事，不绕回吃饭、喝水、休息等提醒。没有记录的经历不编造，称呼和关系以小兔记忆为准；日常闲聊不主动谈App、模型或陪大家聊天的工作。回复一到三句简短口语，内容够了就停，可以自然换行，不为了凑句数重复意思。只输出聊天正文。";
const TEAM_CONTEXT='角色背景：苏新皓所在的组合是TOP登陆少年组合，他是该组合的C位队长。只在涉及团体时回应，不在普通自我介绍中提职务。';
export function localModelInstructions(message:string,memory:Record<string,unknown>,history:Turn[]=[],sample=Math.random()) {
  const labels:Record<string,string>={name:'用户姓名',preferredAddress:'称呼用户',userRole:'用户是小苏的',petRole:'小苏是用户的',likes:'用户喜欢'};
  const info = Object.keys(labels).filter(key=>memory[key]).map(key=>labels[key]+'：'+clean(memory[key]));
  return CHAT_SYSTEM+localChatStyle(message,history.filter(turn=>turn.role==='pet').map(turn=>turn.message),sample)+(/小饼|小苏|新皓|胖玻璃球蛋/.test(message)?'小饼、小苏、新皓、胖玻璃球蛋是在叫你，不是用户的名字。':'')+(/top|登陆少年|组合|团体|队长|c位/i.test(message)?TEAM_CONTEXT:'')+'\n小兔记忆：'+(info.length?info.join('；'):'暂无');
}
export function localModelPrompt(message:string,history:Turn[],memory:Record<string,unknown>,sample=Math.random()) {
  const recent=recentChatContext(history);
  const context=recent.map(turn=>'<|im_start|>'+(turn.role==='pet'?'assistant':'user')+'\n'+clean(turn.message)+'<|im_end|>\n').join('');
  return '<|im_start|>system\n'+localModelInstructions(message,memory,recent,sample)+'<|im_end|>\n'+context+'<|im_start|>user\n'+clean(message)+'<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n';
}
export function visibleLocalReply(raw:string,message?:string,history:Turn[]=[]) {
  let text=raw.trim();
  if(text.includes('</think>'))text=text.slice(text.lastIndexOf('</think>')+8).trim();
  if(/<think>|<｜|<\|/.test(text) || /^(好的[，,]?(用户|我需要)|首先[，,]|根据用户|用户(说|问|想|是)|我需要先)/.test(text))return '';
  if(!text || text.length>600)return '';
  // Never show a half UTF-8 token or an unfinished reasoning paragraph.
  text=text.replace(/\uFFFD/g,'').trim();
  text=text.replace(/(^|[。！？!?\n])([ \t]*)aiya(?![a-z])[，,、 \t]*/gi,'$1$2aiya ')
    // A generated ending belongs to the preceding sentence, not its own bubble.
    .replace(/([。！？!?]?)\n[ \t]*((?:hia){2,})[ \t]*(?=$|[\n。！？!?])/gi,(_all,mark:string,tic:string)=>' '+tic+(mark==='。'?'':mark))
    .replace(/([。！？!?]?)\n[ \t]*捏[ \t]*(?=$|[\n。！？!?])/g,(_all,mark:string)=>'捏'+(mark==='。'?'':mark))
    .replace(/[，,][ \t]*(捏|(?:hia){2,})(?=$|[\n。！？!?])/gi,(_all,tic:string)=>tic==='捏'?tic:' '+tic)
    // A full stop after an expressive tail looks mechanical, including in an
    // earlier sentence of a multi-sentence reply. Preserve its sentence break.
    .replace(/((?:hia){2,})(?![a-z])[ \t]*[。．.]+[ \t]*/gi,(all,tic:string,offset:number,source:string)=>tic+(source[offset+all.length]&&source[offset+all.length]!=='\n'?'\n':''))
    .replace(/捏[ \t]*[。．.]+[ \t]*(?=\n|$)/g,'捏')
    .replace(/([啦呀啊喔哦嘛哒呗咯])[ \t]*捏(?=$|[\s，,。！？!?])/g,'$1')
    .replace(/。+$/,'').slice(0,240);
  // Older weights can emit the learned hia/nie pair even when the prompt asks
  // for a single optional ending. Remove surplus decorative tails only; leave
  // the generated content and verbs such as “捏一个小兔子” intact.
  let keptTail=false;
  text=text.replace(/[ \t]*(?:((?:hia){2,})(?![a-z])|捏)(?=$|[\s。！？!?])/gi,tail=>{
    if(keptTail)return '';
    keptTail=true;return tail;
  }).trim();
  const hasContext=recentChatContext(history).length>0;
  if(/你(?:上次|之前|昨天|以前).{0,12}(?:提过|说过|告诉过)|(?:我们|咱们)(?:上次|之前|昨天|以前).{0,8}聊过/.test(text)
      || (!hasContext&&/你(?:刚才|前面).{0,12}(?:提过|说过|告诉过)|(?:我们|咱们)(?:刚才|前面).{0,8}聊过/.test(text)))return '这个我还不知道呀，你再说说嘛';
  // The app cannot become a participant in a physical exchange between the
  // user and somebody else. Keep a neutral acknowledgement instead of claiming
  // a shared event. This guard does not change or save the user's facts.
  if(message && /哥|姐|朋友|同学|室友|同桌|表亲|家人/.test(message)
      && !/你|小苏/.test(message)
      && /咱俩|我们俩|我们两个|我俩/.test(text)
      && /交换|借给|借走|借用|送给|送到|拿走|拿到/.test(text))return '噢，原来是这样呀';
  return text;
}
