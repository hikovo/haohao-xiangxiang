export function guideTextParts(text: string): Array<{ text: string; strong: boolean }> {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map(part => ({
    text: part.startsWith('**') && part.endsWith('**') ? part.slice(2, -2) : part,
    strong: part.startsWith('**') && part.endsWith('**'),
  }));
}

export function appendGuideText(element: HTMLElement, text: string) {
  for (const part of guideTextParts(text)) {
    if (part.strong) {
      const strong = document.createElement('strong');
      strong.textContent = part.text;
      element.append(strong);
    } else {
      element.append(document.createTextNode(part.text));
    }
  }
}
