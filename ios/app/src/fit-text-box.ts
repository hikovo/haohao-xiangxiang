/** Fit a floating text box to its rendered lines, preserving balanced breaks. */
export function fitTextBox(box: HTMLElement, text: HTMLElement, limit: number) {
  const message = text.textContent || '';
  text.textContent = message;
  box.style.width = `${limit}px`;
  const node = text.firstChild;
  if (!node || !message) return;
  const range = document.createRange();
  const lines: { start: number; top: number; left: number; right: number }[] = [];
  let offset = 0;
  for (const glyph of message) {
    range.setStart(node, offset);
    range.setEnd(node, offset + glyph.length);
    const rect = range.getBoundingClientRect();
    const last = lines[lines.length - 1];
    if (!last || Math.abs(last.top - rect.top) > 2) {
      lines.push({ start: offset, top: rect.top, left: rect.left, right: rect.right });
    } else {
      last.left = Math.min(last.left, rect.left);
      last.right = Math.max(last.right, rect.right);
    }
    offset += glyph.length;
  }
  const style = getComputedStyle(box);
  const inset = ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth']
    .reduce((sum, key) => sum + (parseFloat(style[key as keyof CSSStyleDeclaration] as string) || 0), 0);
  // Explicit breaks prevent balancing from wrapping again when the box shrinks.
  const content = document.createDocumentFragment();
  lines.forEach((line, index) => {
    if (index) content.append(document.createElement('br'));
    content.append(document.createTextNode(message.slice(line.start, lines[index + 1]?.start)));
  });
  text.replaceChildren(content);
  const width = Math.max(...lines.map(line => line.right - line.left));
  box.style.width = `${Math.min(limit, Math.ceil(width + inset) + 1)}px`;
}
