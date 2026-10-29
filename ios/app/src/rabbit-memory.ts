// The editable Rabbit Memory is the only persistent personal context for chat.
export const RABBIT_MEMORY_KEY = 'hhxx.ios.archive-memory.v1';
export const MANUAL_MEMORY_KEY = 'sanhao-tu.manual-memory.v1';
type Store = Pick<Storage, 'getItem' | 'setItem'>;
export type RabbitMemory = {name:string;preferredAddress:string;userRole:string;petRole:string;likes:string};
const fields = ['name','preferredAddress','userRole','petRole','likes'] as const;
const relations = '妈妈|妈咪|爸爸|爸比|母亲|父亲|女儿|儿子|姐姐|妹妹|哥哥|弟弟|男朋友|女朋友|对象|爱人|朋友|闺蜜|家人';

function stored(store:Store):Record<string,unknown> {
  for (const key of [RABBIT_MEMORY_KEY,MANUAL_MEMORY_KEY]) {
    const value=store.getItem(key);
    if(value===null)continue;
    try {
      const data:unknown=JSON.parse(value);
      if(data && typeof data==='object' && !Array.isArray(data))return data as Record<string,unknown>;
    } catch { /* Leave the original value intact. */ }
  }
  return {};
}
export function readRabbitMemory(store:Store):RabbitMemory {
  const data=stored(store);
  return Object.fromEntries(fields.map(key=>[key,Array.isArray(data[key])?data[key].join('、'):String(data[key]??'')])) as RabbitMemory;
}
export function saveRabbitMemory(store:Store,memory:RabbitMemory) {
  // Keep old, unrelated fields in storage; only the five displayed fields reach the model.
  store.setItem(RABBIT_MEMORY_KEY,JSON.stringify({...stored(store),...Object.fromEntries(fields.map(key=>[key,memory[key]]))}));
}
function validName(value:string) {
  return /^[\u4e00-\u9fffA-Za-z0-9_-]{1,16}$/.test(value)
    && !/^(谁|你|我|他|她|它)$|什么|是谁|不是|不叫|而是|去|来|帮|出来|过来|一下|一声|吃饭|睡觉|[吗么呢]$/.test(value);
}
function nameValue(value:string) {return value.replace(/[吧呀啊哦喔啦了～~]+$/,'').trim()}
function likesList(value:string) {return value.split(/[、，,]/).map(x=>x.trim()).filter(Boolean)}

export function updateRabbitMemory(message:string,current:RabbitMemory) {
  const memory={...current};
  let likes=likesList(memory.likes);
  for(const raw of message.match(/[^，,。！？!?；;\n]+[，,。！？!?；;\n]?/g)||[]) {
    if(/[?？]/.test(raw))continue;
    const text=raw.trim().replace(/[，,。！!；;]+$/,'').trim();
    if(!text || /[“”「」『』"]/.test(text))continue;
    const clear=text.match(/^(?:请)?(?:别再|不要再|不要|别)叫我(.+?)(?:了)?$/);
    if(clear) {
      const value=nameValue(clear[1]);
      if(memory.preferredAddress===value)memory.preferredAddress='';
      if(memory.name===value)memory.name='';
      continue;
    }
    const introduction=text.replace(/(?:你呢|你叫什么(?:名字)?)(?:呀|啊|呢)?$/,'');
    const explicit=introduction.match(/^(?:记住)?(?:我叫|我的名字(?:叫|是)|名字改成)([^\s]{1,20})$/);
    const simple=text.match(/^我是([\u4e00-\u9fffA-Za-z0-9_-]{1,10})$/);
    const value=nameValue(explicit?.[1]||simple?.[1]||'');
    const ordinary=/学生|老师|医生|护士|上班|打工|朋友|家人|哥哥|弟弟|姐姐|妹妹|爸|妈|儿子|女儿|对象|爱人|开心|难过|生气|伤心|累|困|饿|病|来|去|在|的|一个|不是|中国人|普通人|认真的|真的/;
    if(validName(value) && (explicit || !ordinary.test(value))) {
      if(memory.preferredAddress===memory.name && memory.name!==value)memory.preferredAddress='';
      memory.name=value;
    }
    const alias=text.match(/^(?:请|以后|今后|现在|还是|就|可以)?(?:改叫|叫我)(.{1,20})$/);
    if(alias) {
      const preferred=nameValue(alias[1]);
      if(validName(preferred))memory.preferredAddress=preferred;
    }
    const userRole=text.match(new RegExp(`^(?:我(?:是|就是)你(?:的)?|我对你来说是)(${relations})$`))?.[1];
    const petRole=text.match(new RegExp(`^(?:你(?:是|就是)我(?:的)?|你对我来说是)(${relations})$`))?.[1];
    if(userRole)memory.userRole=userRole;
    if(petRole)memory.petRole=petRole;
    const dislike=text.match(/^我(?:现在|已经)?(?:不再喜欢|不喜欢)(.{1,40}?)(?:了)?$/)?.[1]?.trim();
    if(dislike)likes=likes.filter(x=>x!==dislike);
    const like=text.match(/^我(?:很|最|比较|一直|特别)?喜欢(.{1,40})$/)?.[1]?.trim();
    if(like && !/^(你|你们|他|她|今天|刚才|刚刚|这次|现在|的|什么|谁|哪)/.test(like) && !likes.includes(like))likes.push(like);
  }
  memory.likes=likes.join('、');
  return memory;
}

export function rememberRabbitMessage(store:Store,message:string) {
  const before=readRabbitMemory(store);
  const memory=updateRabbitMemory(message,before);
  if(fields.some(key=>memory[key]!==before[key]))saveRabbitMemory(store,memory);
  return memory;
}

export function rabbitMemoryReply(message:string,memory:RabbitMemory,recentUserMessages:string[]=[]):string|undefined {
  const text=message.replace(/[，,。！？!?\s]/g,'');
  // User-confirmed character facts are fixed data, not model guesses.
  const namedRole=/你|苏新皓|小苏|小饼|新皓|胖玻璃球蛋|登陆少年|top/i.test(text);
  if(namedRole && !(/你(?:觉得|认为|喜欢)/.test(text)&&!/TOP|登陆少年|苏新皓|小苏|新皓/i.test(text)) && /c位|队长|什么(?:组合|团体|位置)|哪个(?:组合|团体)|所在的?组合|组合.*(?:是|位置)|团体.*(?:是|位置)/i.test(text)
      && !/^我(?:是|当|没|不)/.test(text))return '小苏所在的组合是TOP登陆少年组合，是组合的C位队长呀';
  // Known app capabilities are factual answers, never guessed by the language model.
  if(/^你/.test(text) && /本人|真人|现实.*认识/.test(text))return '不是本人喔，我是App里的小苏';
  if(/^你/.test(text) && /听(?:见|到|得见).*(?:唱歌|声音|我说话)|能听我唱歌/.test(text))return '我听不到声音喔，只能看到你发来的文字';
  if(/^你/.test(text) && /摄像头|看(?:到|见|得见)我/.test(text))return '我不能打开摄像头，也看不到你喔';
  // These details are outside the five editable memory fields. Do not pretend
  // to retrieve a past conversation or invent a private name.
  if(/我/.test(text) && /公司|学校|猫|狗|宠物/.test(text)
      && /叫什么|名字|叫啥/.test(text)
      && /你知道|记得|昨天|之前|上次|上个月|刚才/.test(text)
      && !recentUserMessages.some(previous=>/我.{0,6}(?:公司|学校|猫|狗|宠物).{0,4}(?:叫|名字是)/.test(previous)))return '这个我还不知道呀，你再告诉我嘛';
  if(/^(那)?(你是谁|你叫什么|你叫什么名字|你叫啥|你叫啥名字|你的名字是什么)(呀|啊|呢|来着)?$/.test(text))return '我是小苏呀';
  if(/^(我是谁|我叫什么|我叫什么名字|我叫啥|我的名字是什么)(呀|啊|呢|来着)?$/.test(text)) {
    return memory.name?`你叫${memory.name}呀`:memory.preferredAddress?`你让我叫你${memory.preferredAddress}呀`:'你想让我怎么叫你呀';
  }
  if(/^(你还记得我的名字吗|你记得我的名字吗|你知道我的名字吗)$/.test(text))return memory.name?`记得呀，你叫${memory.name}`:'你想让我怎么叫你呀';
  if(/^(你应该怎么叫我|你平时怎么叫我|我让你叫我什么|叫我一声|那你叫我一下)(呀|啊|嘛)?$/.test(text)) {
    const name=memory.preferredAddress||memory.name;
    return name?`${name}，在呢`:'你想让我怎么叫你呀';
  }
  if(/^(我喜欢什么|我喜欢什么东西|我有什么喜好|我平时喜欢做什么)(呀|啊|呢|来着)?$/.test(text))return memory.likes?`你喜欢${memory.likes}呀`:'你还没告诉我呢';
  if(/^我们是什么关系(呀|啊|呢)?$/.test(text) && memory.userRole && memory.petRole)return `你是我的${memory.userRole}，我是你的${memory.petRole}呀`;
  if(/^(我对你来说是(什么|谁)|我是你的(什么|谁))$/.test(text) && memory.userRole)return `你是我的${memory.userRole}呀`;
  if(/^(你对我来说是(什么|谁)|你是我的(什么|谁))$/.test(text) && memory.petRole)return `我是你的${memory.petRole}呀`;
  return undefined;
}
