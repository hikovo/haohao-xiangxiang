export const thinkingPhrases = [
  '想一下……', '我翻翻……', '这个嘛……', '我找找……',
  '让我想想……', '等我翻翻……', '我看看喔……', '在哪儿呢……',
  '翻一翻……', '找找这一段……', '我找一下喔……',
] as const;
export const conversationThinkingPhrases = [
  '想一下……', '让我想想……', '嗯……', '这个嘛……', '我想想喔……',
  '等我一下……', '唔……', '怎么说呢……', 'aiya......',
] as const;

export function chooseThinkingText(previous = '', random = Math.random, mode: 'archive' | 'chat' = 'archive') {
  const pool:readonly string[]=mode==='chat'?conversationThinkingPhrases:thinkingPhrases;
  const choices = pool.filter(text => text !== previous);
  return choices[Math.min(choices.length - 1, Math.max(0, Math.floor(random() * choices.length)))];
}

export function thinkingDuration(random = Math.random) {
  return 400 + Math.min(399, Math.max(0, Math.floor(random() * 400)));
}
