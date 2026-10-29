export const faceScenes = {
  "happy": [
    "(^▽^)",
    "(^ω^)",
    "(＾▽＾)",
    "(＾ω＾)",
    "(o^▽^o)",
    "(o´▽｀o)",
    "(*^▽^*)",
    "(｡´ω｀｡)",
    "(｡´▽｀｡)",
    "(｡^▽^｡)",
    "(^o^)",
    "(^-^)",
    "(｡•ᴗ•｡)",
    "(˶ˊᵕˋ˵)",
    "(✿´ ꒳ `)",
    "(๑˃ᴗ˂)ﻭ",
    "٩(๑• ₃ -๑)۶",
    "(*´∀`)♪",
    "(๑'ᵕ'๑)⸝*",
    "•̀ ᴗ -",
    "ᴖ ᴈ ᴖ",
    "＞ᨓ＜",
    "(˶˃ ᵕ ˂˶)",
    "૮₍ ˃ ⤙ ˂ ₎ა",
    "⌯'ᵕ'⌯",
    "⑉･ᴗ･⑉",
    "ʚ˶˃ ᵕ ˂˶ɞ",
    "⌯^𖥦^⌯ಣ",
    "·◑ᴗ◐.",
    "·•̀ᴗ•́."
  ],
  "calm": [
    "(｡•ᴗ•｡)",
    "ˈ ᵕ ˈ ♡",
    "՞•ᴥ•՞",
    "˶• ༝ •˶",
    "૮ ․ ․ ྀིა",
    "⦁֊⦁",
    "⌯'ㅅ'⌯",
    "° ꒳ °"
  ],
  "focus": [
    "(ง •̀_•́)ง",
    "(๑•̀ㅂ•́)و",
    "(ง ˙ω˙)ว",
    "( •̀ᴗ•́ )و",
    "( •̀ᄇ• ́)ﻭ✧",
    "૮(≖⩊≖)ა",
    "ദ്ദി •⩊• )",
    "(- ₃ -)",
    "╹⁠꒫╹⁠",
    "·•̀_•́."
  ],
  "rest": [
    "(˘ω˘)",
    "(´ω｀)",
    "(｡´ω｀｡)",
    "( ˶˘ ³˘)♡",
    "( ˶˘ ³˘)♥︎",
    "꒰੭⸝⸝´˘ '⸝⸝꒱੭♡",
    "՞-ㅅ-՞",
    "• ˔ ก",
    "⁽¯꒳¯⁾",
    "˶⁃ ω ⁃˶"
  ]
};
export type FaceScene = keyof typeof faceScenes;
const bags = new Map<FaceScene, string[]>();
const last = new Map<FaceScene, string>();
export function nextFace(scene: FaceScene = 'calm'): string {
  let bag = bags.get(scene);
  if (!bag?.length) {
    bag = [...faceScenes[scene]];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    if (bag[bag.length - 1] === last.get(scene)) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    bags.set(scene, bag);
  }
  const face = bag.pop()!;
  last.set(scene, face);
  return face;
}
const endings: Record<string, [string, FaceScene]> = {
  'mobile-menu': ['今天也慢慢来，兔兔陪着你', 'calm'],
  'notification-panel': ['该记得的小事，我们一起记着', 'calm'],
  'timer-panel': ['认真一小会儿，再一起休息吧', 'focus'],
  'daily-panel': ['约好时间，兔兔就来敲敲门', 'calm'],
  'reminder-settings-panel': ['该记得的小事，兔兔陪你记着', 'calm'],
  'reminder-style-panel': ['选好啦，到时间轻轻提醒你', 'calm'],
  'daily-answer-panel': ['不着急，按自己的步子来就好', 'calm'],
  'memo-create-panel': ['生活里的小事，都可以记在这里', 'happy'],
  'memo-companion-books': ['生活里的小事，兔兔陪你记着', 'calm'],
  'live-style-choices': ['挑一件喜欢的，兔兔穿给你看', 'happy'],
  'memo-editor-panel': ['写下来，就不用一直惦记啦', 'calm'],
  'memo-item-actions-panel': ['慢慢整理，想留下的就留着', 'calm'],
  'countdown-editor-panel': ['把特别的日子，轻轻圈起来', 'happy'],
  'memo-reminder-panel': ['轮到这件小事啦，兔兔陪你一起', 'calm'],
  'records-panel': ['清理前，先收好喜欢的', 'calm'],
  'chat-record-panel': ['喜欢的这句话，替你好好收着', 'happy'],
  'chat-actions-panel': ['整理之前，再看看想留下什么', 'calm'],
  'chat-mode-panel': ['翻翻回忆，或是慢慢说说，都陪着你', 'calm'],
  'chat-favorites-panel': ['喜欢的小片段，都在这里等你', 'happy'],
  'archive-range-panel': ['这一段日子，我们慢慢翻', 'calm'],
  'chat-appearance-panel': ['换个喜欢的样子，心情也亮一点', 'happy'],
  'developer-contact-panel': ['有问题或小想法，都可以来找苹果呀', 'happy'],
  'rabbit-memory-panel': ['你告诉兔兔的小事，会在这里好好留着', 'calm'],
};
export function refreshSheetEnding(panel: HTMLElement) {
  let ending = panel.querySelector<HTMLElement>('.sheet-ending');
  if (!ending) {
    ending = document.createElement('p');
    ending.className = 'sheet-ending';
    panel.append(ending);
  }
  const [copy, scene] = panel.id === 'user-guide-panel'
    ? [panel.dataset.guideKind === 'blindbox' ? '想翻的时候，兔兔陪你再翻翻' : '用到的时候，再来翻翻就好', 'calm'] as const
    : endings[panel.id] || ['慢慢来，兔兔就在这里陪你', 'calm'];
  ending.hidden = false;
  ending.textContent = `${copy} ${nextFace(scene)}`;
}
