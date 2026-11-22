const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape plain text for safe interpolation into HTML text and quoted attributes. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]!);
}

/** Resolve required page controls with a useful failure if the markup drifts. */
export function requiredElement<K extends keyof HTMLElementTagNameMap>(id: string, tag: K): HTMLElementTagNameMap[K] {
  const element = document.getElementById(id);
  if (!element || element.localName !== tag) throw new Error(`Expected <${tag}> with id="${id}".`);
  return element as HTMLElementTagNameMap[K];
}
