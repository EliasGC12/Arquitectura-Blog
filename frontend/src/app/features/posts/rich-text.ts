export const TEXT_FONTS = [
  { label: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { label: 'Times New Roman', css: "'Times New Roman', Times, serif" },
  { label: 'Courier New', css: "'Courier New', Courier, monospace" },
  { label: 'Georgia', css: 'Georgia, serif' },
  { label: 'Verdana', css: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS', css: "'Trebuchet MS', 'Segoe UI', sans-serif" },
  { label: 'Comic Sans MS', css: "'Comic Sans MS', 'Comic Sans', cursive" },
  { label: 'Impact', css: "Impact, Haettenschweiler, 'Arial Narrow', sans-serif" },
  { label: 'Roboto', css: 'Roboto, sans-serif' },
  { label: 'Open Sans', css: "'Open Sans', sans-serif" },
] as const;

export function fontCss(label: string): string {
  return TEXT_FONTS.find((item) => item.label === label)?.css ?? '';
}

export interface RichLook {
  html: string;
  fontFamily: string | null;
  color: string | null;
  fontWeight: string | null;
  fontStyle: string | null;
}

export type TextAction =
  | { type: 'mark'; tag: 'strong' | 'em' }
  | { type: 'style'; font: string; color: string };

export function formatRichText(value: string): string {
  const source = value ?? '';
  if (/<\/?[a-z][\s\S]*>/i.test(source)) {
    return source;
  }

  const escaped = escapeHtml(source);

  return escaped
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replaceAll('\n', '<br>');
}

export function repairQuotedFonts(source: string): string {
  return source.replace(/style="font-family:\s*"([^"]+)"/gi, `style="font-family: '$1'`);
}

export function sanitizeRichHtml(source: string): string {
  const html = formatRichText(repairQuotedFonts(source));
  if (typeof DOMParser === 'undefined') {
    return escapeHtml(source);
  }

  const document = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = document.body.firstElementChild;
  return root ? cleanNode(root).replace(/(?:<br>)+$/i, '') : '';
}

export function styleAttribute(font: string, color: string): string {
  return `font-family: ${safeFont(font)}; color: ${safeColor(color)}`.replaceAll('"', "'");
}

export function presentRichHtml(source: string): RichLook {
  const html = sanitizeRichHtml(source);
  const look: RichLook = {
    html,
    fontFamily: null,
    color: null,
    fontWeight: null,
    fontStyle: null,
  };
  if (!html || typeof DOMParser === 'undefined') {
    return look;
  }

  const document = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const styled = document.querySelector('span[style], font');
  const style = styled?.getAttribute('style') ?? '';
  const font = style.match(/font-family\s*:\s*([^;]+)/i)?.[1]?.trim();
  const color = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1]?.trim();
  const weight = style.match(/font-weight\s*:\s*(bold|700)/i)?.[1];
  const slant = style.match(/font-style\s*:\s*italic/i)?.[1];
  look.fontFamily = font ? font.replaceAll('"', "'") : null;
  look.color = color ? colorToHex(color) : null;
  look.fontWeight = weight ? '700' : null;
  look.fontStyle = slant ? 'italic' : null;
  return look;
}

function safeFont(font: string): string {
  return allowedFont(font) ?? TEXT_FONTS[0].css;
}

function safeColor(color: string): string {
  return colorToHex(color) ?? '#1c1e21';
}

function allowedFont(raw: string): string | null {
  const normalized = raw.trim().replaceAll('"', '').replaceAll("'", '').toLowerCase();
  const match = TEXT_FONTS.find((item) => {
    const css = item.css.replaceAll('"', '').replaceAll("'", '').toLowerCase();
    const first = css.split(',')[0].trim();
    return normalized === css || normalized === first || normalized.startsWith(`${first},`) || normalized.startsWith(first);
  });
  return match?.css ?? null;
}

function cleanNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent ?? '');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  const inner = [...element.childNodes].map((child) => cleanNode(child)).join('');
  if (tag === 'strong' || tag === 'b') {
    return `<strong>${inner}</strong>`;
  }
  if (tag === 'em' || tag === 'i') {
    return `<em>${inner}</em>`;
  }
  if (tag === 'br') {
    return '<br>';
  }
  if (tag === 'p' || tag === 'div') {
    return inner ? `${inner}<br>` : '';
  }
  if (tag === 'h2' || tag === 'h3' || tag === 'code') {
    return `<${tag}>${inner}</${tag}>`;
  }
  if (tag === 'span' || tag === 'font') {
    const style = safeStyle(element);
    return style ? `<span style="${style}">${inner}</span>` : inner;
  }
  return inner;
}

function safeStyle(element: Element): string {
  const style = element.getAttribute('style') ?? '';
  const parts: string[] = [];
  const fontSource = style.match(/font-family\s*:\s*([^;]+)/i)?.[1] ?? element.getAttribute('face') ?? '';
  const allowed = fontSource ? allowedFont(fontSource) : null;
  if (allowed) {
    parts.push(`font-family: ${allowed}`);
  }

  const colorSource =
    style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1] ?? element.getAttribute('color') ?? '';
  const color = colorSource ? colorToHex(colorSource) : null;
  if (color) {
    parts.push(`color: ${color}`);
  }

  const weight = style.match(/font-weight\s*:\s*(bold|normal|[1-9]00)/i)?.[1]?.toLowerCase();
  if (weight === 'bold' || weight === '700') {
    parts.push('font-weight: 700');
  }

  const slant = style.match(/font-style\s*:\s*(italic|normal)/i)?.[1]?.toLowerCase();
  if (slant === 'italic') {
    parts.push('font-style: italic');
  }
  return parts.join('; ');
}

function colorToHex(raw: string): string | null {
  const value = raw.trim();
  const hex = value.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hex) {
    const body = hex[1];
    const full = body.length === 3 ? [...body].map((char) => char + char).join('') : body;
    return `#${full.toLowerCase()}`;
  }

  const rgb = value.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (!rgb) {
    return null;
  }
  return (
    '#' +
    [rgb[1], rgb[2], rgb[3]]
      .map((channel) => Math.min(255, Number(channel)).toString(16).padStart(2, '0'))
      .join('')
  );
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
