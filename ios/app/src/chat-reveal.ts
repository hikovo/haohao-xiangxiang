export async function revealConversation(lines: HTMLElement[], alive: () => boolean, reveal: (line: HTMLElement) => void, wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms)), followLatest?:()=>void) {
  for (const line of lines) {
    if (!alive()) return;
    const bubble = line.querySelector<HTMLElement>('p.chat-message');
    if (!bubble) { reveal(line); continue; }
    const text = bubble.textContent || '';
    const units = typeof Intl.Segmenter === 'function' ? Array.from(new Intl.Segmenter('zh', {granularity: 'grapheme'}).segment(text), part => part.segment) : Array.from(text);
    bubble.setAttribute('aria-label', text);
    bubble.classList.add('chat-writing');
    const visible = document.createElement('span'); visible.setAttribute('aria-hidden', 'true');
    const cursor = document.createElement('i'); cursor.className = 'chat-writing-cursor'; cursor.setAttribute('aria-hidden', 'true');
    bubble.replaceChildren(visible, cursor);
    reveal(line);
    for (let i = 0; i < units.length; i++) {
      if (!alive() || !line.isConnected) return;
      const scroll = line.parentElement!;
      const follow = scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop < 100;
      visible.textContent += units[i];
      if (followLatest) followLatest(); else if (follow) scroll.scrollTop = scroll.scrollHeight;
      // Punctuation gives a little breathing room; never a fixed interval between bubbles.
      await wait(/[，。！？…,.!?]/u.test(units[i]) ? 120 : 24 + (i % 4) * 7);
    }
    bubble.textContent = text; bubble.classList.remove('chat-writing');
  }
}
