/**
 * Formatting commands and paste/normalisation handling for the manuscript
 * editor.
 *
 * Two rules govern everything here:
 *
 * 1. The editor stores HTML, and that HTML is what the PDF/EPUB exporters
 *    read back (`backend/internal/application/manuscripts/htmldoc.go`).
 *    So whatever the browser's `execCommand` happens to emit gets
 *    normalised into one small, stable subset before it is ever saved —
 *    otherwise "the same" bold word is a `<b>` in one browser, a
 *    `<span style="font-weight:700">` in another, and the exporters have
 *    to guess.
 * 2. Anything arriving from outside the editor (a paste from Word, Google
 *    Docs or a web page) is cleaned down to that same subset. Pasting a
 *    chapter out of Word otherwise drags in `mso-*` styles, fixed pixel
 *    fonts, colours and empty wrapper divs that make the exported book
 *    look nothing like the rest of it.
 */

/** Colours offered by the text-colour picker. */
export const TEXT_COLORS: { value: string; label: string }[] = [
  { value: '#1c1917', label: 'Negro' },
  { value: '#44403c', label: 'Gris' },
  { value: '#1e3a8a', label: 'Azul' },
  { value: '#0f766e', label: 'Verde' },
  { value: '#9a3412', label: 'Terracota' },
  { value: '#b91c1c', label: 'Rojo' },
  { value: '#7e22ce', label: 'Violeta' },
];

/** Relative sizes offered by the size selector, as CSS font-size values. */
export const FONT_SIZES: { value: string; label: string }[] = [
  { value: '0.8em', label: 'Pequeño' },
  { value: '1em', label: 'Normal' },
  { value: '1.35em', label: 'Grande' },
  { value: '1.8em', label: 'Muy grande' },
];

const ALLOWED_TAGS = new Set([
  'P', 'DIV', 'BR', 'HR',
  'H1', 'H2', 'H3',
  'BLOCKQUOTE',
  'UL', 'OL', 'LI',
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'SPAN',
  'FIGURE', 'IMG',
]);

/** Tags whose children are kept while the tag itself is discarded. */
const UNWRAPPED_TAGS = new Set([
  'A', 'FONT', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'CENTER',
  'SMALL', 'BIG', 'TABLE', 'TBODY', 'TR', 'TD', 'TH', 'H4', 'H5', 'H6', 'PRE', 'CODE',
]);

const DROPPED_TAGS = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'FORM',
  'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'LINK', 'META', 'NOSCRIPT',
  'AUDIO', 'VIDEO', 'CANVAS',
]);

const ALLOWED_STYLE_PROPERTIES = new Set([
  'text-align', 'color', 'font-size', 'font-weight', 'font-style', 'text-decoration',
]);

/**
 * Runs a document.execCommand, keeping `styleWithCSS` off so bold/italic/
 * underline come out as semantic `<b>`/`<i>`/`<u>` — which is what an
 * EPUB reader wants — rather than as inline-styled spans.
 */
export function runCommand(command: string, value?: string): void {
  try {
    document.execCommand('styleWithCSS', false, 'false');
  } catch {
    // Not supported everywhere; the command below still works.
  }
  document.execCommand(command, false, value);
}

/**
 * Applies a text colour. `foreColor` is used with CSS styling explicitly
 * enabled so the result is a `<span style="color:…">` rather than the
 * obsolete `<font color>` element, which is not valid in the XHTML an
 * EPUB is made of.
 */
export function applyTextColor(color: string): void {
  try {
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('foreColor', false, color);
  } finally {
    try {
      document.execCommand('styleWithCSS', false, 'false');
    } catch {
      // Best effort — the colour has already been applied.
    }
  }
}

/**
 * Applies a relative font size. `fontSize` only accepts the legacy 1-7
 * scale, so the resulting `<font size>` elements are swapped for spans
 * carrying a real CSS size — relative (`em`) so it keeps meaning the same
 * thing at any page size.
 */
export function applyFontSize(root: HTMLElement, size: string): void {
  document.execCommand('fontSize', false, '7');
  root.querySelectorAll('font[size="7"]').forEach((node) => {
    const span = document.createElement('span');
    span.style.fontSize = size;
    while (node.firstChild) span.appendChild(node.firstChild);
    node.replaceWith(span);
  });
}

/** Alignment values, mapped to the execCommand that produces them. */
export const ALIGN_COMMANDS = {
  left: 'justifyLeft',
  center: 'justifyCenter',
  right: 'justifyRight',
  justify: 'justifyFull',
} as const;

export type AlignValue = keyof typeof ALIGN_COMMANDS;

export const ALIGN_OPTIONS: { value: AlignValue; label: string }[] = [
  { value: 'left', label: 'Alinear a la izquierda' },
  { value: 'center', label: 'Centrar' },
  { value: 'right', label: 'Alinear a la derecha' },
  { value: 'justify', label: 'Justificar' },
];

/**
 * Reads which formatting is active at the caret, so the toolbar can show
 * it. Wrapped because `queryCommandState` throws in some browsers when
 * there is no selection inside an editable region.
 */
export function queryState(command: string): boolean {
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

const BLOCK_FORMATS = new Set(['p', 'h1', 'h2', 'h3', 'blockquote']);

/**
 * The block format at the caret. Anything the selector cannot represent —
 * a bare `div`, an empty value, a list item — reports as "p", so the
 * dropdown never goes blank on a perfectly ordinary caret position.
 */
export function queryBlockFormat(): string {
  try {
    const value = (document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, '');
    return BLOCK_FORMATS.has(value) ? value : 'p';
  } catch {
    return 'p';
  }
}

/**
 * Normalises the editor's live HTML into the stored subset: legacy
 * `<font>` elements become spans, and empty inline wrappers left behind by
 * execCommand are removed. Called on the DOM before reading `innerHTML`
 * out for saving.
 */
export function normalizeEditorDom(root: HTMLElement): void {
  root.querySelectorAll('font').forEach((node) => {
    const span = document.createElement('span');
    const color = node.getAttribute('color');
    const size = node.getAttribute('size');
    if (color) span.style.color = color;
    if (size) {
      const scale = LEGACY_FONT_SIZES[size];
      if (scale) span.style.fontSize = scale;
    }
    while (node.firstChild) span.appendChild(node.firstChild);
    // A <font> that carried nothing we keep is unwrapped rather than
    // replaced by an equally pointless <span>.
    if (span.getAttribute('style')) {
      node.replaceWith(span);
    } else {
      node.replaceWith(...span.childNodes);
    }
  });

  // Spans that ended up carrying no styling at all are pure noise.
  root.querySelectorAll('span').forEach((node) => {
    if (node.attributes.length === 0) {
      node.replaceWith(...node.childNodes);
    }
  });
}

const LEGACY_FONT_SIZES: Record<string, string> = {
  '1': '0.63em',
  '2': '0.82em',
  '3': '1em',
  '4': '1.13em',
  '5': '1.5em',
  '6': '2em',
  '7': '3em',
};

/**
 * Converts pasted HTML into the allowed subset. Returns a plain-HTML
 * string safe to hand to `insertHTML`.
 *
 * The DOM used for parsing comes from `DOMParser`, which builds an inert
 * document — scripts in the pasted markup never run, and `<img>` sources
 * are never fetched, unlike assigning to a live element's `innerHTML`.
 */
export function sanitizePastedHTML(rawHTML: string): string {
  const parsed = new DOMParser().parseFromString(rawHTML, 'text/html');
  const out = document.createElement('div');
  Array.from(parsed.body.childNodes).forEach((node) => {
    const cleaned = sanitizeNode(node);
    cleaned.forEach((child) => out.appendChild(child));
  });
  return out.innerHTML;
}

function sanitizeNode(node: Node): Node[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return [document.createTextNode(node.textContent ?? '')];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  const element = node as Element;
  const tag = element.tagName.toUpperCase();
  if (DROPPED_TAGS.has(tag)) return [];

  const children: Node[] = [];
  Array.from(element.childNodes).forEach((child) => {
    children.push(...sanitizeNode(child));
  });

  if (!ALLOWED_TAGS.has(tag) || UNWRAPPED_TAGS.has(tag)) {
    // A block-level wrapper we're dropping still needs to keep its line
    // break, or paragraphs would run together.
    if (BLOCK_LIKE_TAGS.has(tag) && children.length > 0) {
      const paragraph = document.createElement('p');
      children.forEach((child) => paragraph.appendChild(child));
      return [paragraph];
    }
    return children;
  }

  const clean = document.createElement(tag.toLowerCase());
  copyAllowedAttributes(element, clean);
  children.forEach((child) => clean.appendChild(child));
  return [clean];
}

const BLOCK_LIKE_TAGS = new Set(['DIV', 'SECTION', 'ARTICLE', 'TR', 'PRE', 'H4', 'H5', 'H6']);

function copyAllowedAttributes(source: Element, target: HTMLElement): void {
  const style = sanitizeStyleAttribute(source.getAttribute('style'));
  if (style) target.setAttribute('style', style);

  if (target.tagName === 'IMG') {
    const src = source.getAttribute('src') ?? '';
    // Only inline image data survives a paste: a remote URL would make the
    // manuscript depend on someone else's server still being up.
    if (/^data:image\/(png|jpeg);base64,/.test(src)) {
      target.setAttribute('src', src);
      target.setAttribute('alt', source.getAttribute('alt') ?? '');
    }
  }
}

function sanitizeStyleAttribute(style: string | null): string {
  if (!style) return '';
  return style
    .split(';')
    .map((declaration) => {
      const [rawKey, ...rest] = declaration.split(':');
      const key = rawKey?.trim().toLowerCase() ?? '';
      const value = rest.join(':').trim();
      if (!ALLOWED_STYLE_PROPERTIES.has(key) || !value) return '';
      if (/url\(|expression\(|javascript:/i.test(value)) return '';
      // Word pastes absolute pixel sizes for ordinary body text, which
      // would freeze that paragraph at a size unrelated to the rest of the
      // book. Only keep sizes the editor itself can express.
      if (key === 'font-size' && !/^[\d.]+(em|rem|%)$/.test(value)) return '';
      return `${key}:${value}`;
    })
    .filter(Boolean)
    .join(';');
}

/** Counts words across every section, for the book-wide progress readout. */
export function wordCountOfHTML(html: string): number {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}
