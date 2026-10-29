export function setupChatTypography() {
  const key = 'sanhao.chat-font.v1';
  const levelKey = 'sanhao.chat-font-level.v2';
  const page = document.querySelector<HTMLElement>('#mobile-app')!;
  const input = document.querySelector<HTMLInputElement>('#chat-font-size')!;
  function apply(value: number, persist=false) {
    const level=Number.isFinite(value)?Math.max(10,Math.min(30,Math.round(value))):17;
    // Integer controls provide twenty fine intervals within a readable range.
    const size=Math.round((14+(level-10)*.3)*10)/10;
    const ratio = size / 16;
    page.style.setProperty('--chat-font-size', `${size}px`);
    page.style.setProperty('--chat-gap', `${9 * ratio}px`);
    page.style.setProperty('--chat-avatar-size', `${40 * Math.min(1.15, ratio)}px`);
    page.style.setProperty('--chat-padding-y', `${9 * ratio}px`);
    page.style.setProperty('--chat-padding-x', `${12 * ratio}px`);
    input.value = String(level);
    input.style.setProperty('--font-progress',`${(level-10)/20*100}%`);
    input.setAttribute('aria-valuetext',`字号 ${level}`);
    document.querySelector('#chat-font-summary')!.textContent = String(level);
    if(persist){localStorage.setItem(key,String(size));localStorage.setItem(levelKey,String(level));}
  }
  const previous = Number(localStorage.getItem(key) || 16);
  apply(localStorage.getItem(levelKey)!==null?Number(localStorage.getItem(levelKey)):10+(previous-14)/.3);
  let frame=0;
  input.addEventListener('input', () => {
    if(frame)return;
    frame=requestAnimationFrame(()=>{frame=0;apply(Number(input.value));});
  });
  input.addEventListener('change',()=>{
    if(frame)cancelAnimationFrame(frame);frame=0;
    apply(Number(input.value),true);
  });
}
