// Inference guidance for the trained model, never a replacement reply or quote.
export function localChatStyle(message:string,recent:string[]=[],sample=Math.random()) {
 let choices:string[];
 if(/难过|伤心|焦虑|认真|不开心|别.*(?:笑|玩笑)|不要.*(?:嘿嘿|哈哈)|去世|生病/.test(message))return '这次认真、温和地回应，不用笑声或俏皮谐音，也不替对方断定情绪';
 if(/晚安|睡觉|睡啦|被窝|好困|困了/.test(message))choices=['皓皓睡觉','晚安啦','好好睡喔'];
 else if(/(?:忘了|忘记|搞忘|漏回)/.test(message)&&!/没(?:有)?忘|不会忘|别忘/.test(message))choices=['搞忘了','aiya','哎呀'];
 else if(/帽子|帽几/.test(message))choices=['帽几','aiya','哎哟'];
 else if(/(?:饭|面|午餐|晚餐|早餐|做菜|吃的).{0,16}(?:好看|漂亮|照片|颜色)|(?:拍|漂亮|好看).{0,12}(?:饭|菜|餐)/.test(message))choices=['piu亮饭','嘻嘻'];
 else if(/照片|发出来|发照片/.test(message)&&/还没|准备|正在挑|想发/.test(message))choices=['发粗来','一下下','aiya'];
 else if(/小孩|孩子|幼儿园|[一二三四五六七八九1-9]岁/.test(message))choices=['小盆友','一点点','哇'];
 else if(/^(?:小苏[，,、 ]*)?(?:你[好呀]|早[上呀安]|晚上好|中午好|泥嚎|嗨|来[找啦]|在[吗嘛么])/.test(message))choices=['泥嚎','来咯'];
 else if(/吃饭|早餐|午餐|晚餐|吃面|好吃/.test(message))choices=['吃饭Time','aiya','啦'];
 else if(/开心|终于|做好|完成|喜欢|好棒|太好了|高兴|漂亮|成功/.test(message))choices=['嘿嘿','嘻嘻','哈哈哈','开心滴'];
 else choices=['aiya','喔','嘛','一下下','哦对啦'];
 // One optional cue for the whole reply, not one assigned ending per sentence.
 // Keep common tails available without rewarding a repeated hia/nie pair.
 const latest=recent.slice(-2).join('\n');
 const light=/开心|高兴|好玩|可爱|漂亮|终于|成功|完成|好棒|太好了|喜欢|来找|玩啦|好呀|好耶|嘿嘿|嘻嘻|哈哈/.test(message);
 const tails=light?['捏','hiahia']:['捏'];
 const pool=[{tic:'',weight:2},...choices.map(tic=>({tic,weight:latest.includes(tic)?.25:1})),
   ...tails.map(tic=>({tic,weight:latest.includes(tic)?.25:2}))];
 let draw=Math.max(0,Math.min(.999999,Number.isFinite(sample)?sample:0))*pool.reduce((sum,item)=>sum+item.weight,0);
 let chosen=pool[pool.length-1].tic;
 for(const item of pool){draw-=item.weight;if(draw<0){chosen=item.tic;break}}
 const ending=!chosen?'这次直接自然接话，口癖可以省略':chosen==='捏'?'顺口时可以用“捏”作句末尾音，不能放句首':chosen==='hiahia'?'语气轻快时可以用“hiahia”作句末尾音，前留空格、后面省略句号':chosen==='aiya'?'顺口时可以用“aiya”；句首后留一个空格，不加逗号，也可以放句中或收尾':`顺口时可以用“${chosen}”`;
 return `${ending}；整条回复至多选一种明显口癖、用一次即可，可以完全不用。句末只保留一个尾音，啦、呀、捏等不叠在一起。多句回复也不用逐句加尾词。hiahia只用于轻快的语气，普通陈述和认真聊天省略它。先把内容说自然，不为口癖编造事件，轻松聊天少用句末句号。`;
}
