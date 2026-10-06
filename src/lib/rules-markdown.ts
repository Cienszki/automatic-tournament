// src/lib/rules-markdown.ts
// The small Markdown subset used in rulebook paragraphs (what the RulesTab toolbar writes):
//   **bold**  *italic*  ~~strike~~  [text](url)  ![alt](https://img)  bare https:// links
//   # / ## / ### headings   "- " / "* " / "• " bullet lists   "1. " numbered lists
// Parsed to a tiny AST that RuleText renders as React elements — never as HTML — so
// admin-entered content can't inject markup. Single newlines are kept as line breaks,
// matching how rules were displayed before (whitespace-pre-wrap).

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'bold' | 'italic' | 'strike'; children: Inline[] }
  | { type: 'link'; href: string; children: Inline[] }
  | { type: 'image'; src: string; alt: string };

/** Lines of inline content; consecutive lines inside one block are separated by a line break. */
export type Lines = Inline[][];

export type Block =
  | { type: 'paragraph'; lines: Lines }
  | { type: 'heading'; level: 1 | 2 | 3; inlines: Inline[] }
  | { type: 'list'; ordered: boolean; start: number; items: Lines };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const ORDERED = /^\s*(\d+)[.)]\s+(.*)$/;
const HEADING = /^(#{1,3})\s+(.*)$/;

// Alternatives in priority order: image, link, bold, strike, italic, bare URL
const INLINE =
  /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|~~(.+?)~~|\*(\S(?:.*?\S)?)\*|(https?:\/\/[^\s<>]*[^\s<>.,;:!?)\]'"”])/g;

/** Only http(s)/mailto/site-relative links; bare domains like "dota2inhouse.pl/pdl-s2" get https://. */
export function sanitizeHref(raw: string): string | null {
  const href = raw.trim();
  if (/^(https?:\/\/|mailto:)/i.test(href) || /^\/(?!\/)/.test(href) || href.startsWith('#')) return href;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(href)) return `https://${href}`;
  return null;
}

function sanitizeImageSrc(raw: string): string | null {
  const src = raw.trim();
  return /^https:\/\//i.test(src) || /^\/(?!\/)/.test(src) ? src : null;
}

export function parseInline(text: string, allowLinks = true): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  const pushText = (t: string) => {
    if (!t) return;
    const prev = out[out.length - 1];
    if (prev?.type === 'text') prev.text += t;
    else out.push({ type: 'text', text: t });
  };

  for (const m of text.matchAll(INLINE)) {
    const [whole, imgAlt, imgSrc, linkText, linkHref, bold, strike, italic, url] = m;
    const index = m.index ?? 0;
    pushText(text.slice(last, index));
    last = index + whole.length;

    if (imgSrc !== undefined) {
      const src = sanitizeImageSrc(imgSrc);
      if (src) out.push({ type: 'image', src, alt: imgAlt ?? '' });
      else pushText(whole);
    } else if (linkHref !== undefined) {
      const href = allowLinks ? sanitizeHref(linkHref) : null;
      if (href) out.push({ type: 'link', href, children: parseInline(linkText, false) });
      else out.push(...parseInline(linkText, allowLinks)); // keep the label, drop an unsafe target
    } else if (bold !== undefined) {
      out.push({ type: 'bold', children: parseInline(bold, allowLinks) });
    } else if (strike !== undefined) {
      out.push({ type: 'strike', children: parseInline(strike, allowLinks) });
    } else if (italic !== undefined) {
      out.push({ type: 'italic', children: parseInline(italic, allowLinks) });
    } else if (url !== undefined) {
      if (allowLinks) out.push({ type: 'link', href: url, children: [{ type: 'text', text: url }] });
      else pushText(url);
    }
  }
  pushText(text.slice(last));
  return out;
}

export function parseRuleMarkdown(content: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: Lines | null = null;
  let list: Extract<Block, { type: 'list' }> | null = null;

  const flush = () => {
    if (paragraph) blocks.push({ type: 'paragraph', lines: paragraph });
    if (list) blocks.push(list);
    paragraph = null;
    list = null;
  };

  for (const line of content.replace(/\r\n?/g, '\n').split('\n')) {
    const heading = HEADING.exec(line);
    const bullet = BULLET.exec(line);
    const ordered = ORDERED.exec(line);

    if (!line.trim()) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3, inlines: parseInline(heading[2]) });
    } else if (bullet || ordered) {
      const isOrdered = !bullet;
      const itemText = bullet ? bullet[1] : ordered![2];
      if (!list || list.ordered !== isOrdered) {
        flush();
        list = { type: 'list', ordered: isOrdered, start: ordered ? Number(ordered[1]) : 1, items: [] };
      }
      list.items.push(parseInline(itemText));
    } else if (list && /^\s+\S/.test(line)) {
      // Indented continuation of the previous list item
      list.items[list.items.length - 1].push({ type: 'text', text: ` ${line.trim()}` });
    } else {
      if (list) flush();
      (paragraph ??= []).push(parseInline(line));
    }
  }
  flush();
  return blocks;
}

function inlineToPlain(inlines: Inline[]): string {
  return inlines.map(node => {
    switch (node.type) {
      case 'text': return node.text;
      case 'image': return node.alt ? `[obraz: ${node.alt}]` : '';
      case 'link': {
        const label = inlineToPlain(node.children);
        return label === node.href ? label : `${label} (${node.href})`;
      }
      default: return inlineToPlain(node.children);
    }
  }).join('');
}

/** Rule text without Markdown syntax — for the AI assistant's prompt and quote matching. */
export function markdownToPlainText(content: string): string {
  return parseRuleMarkdown(content).map(block => {
    if (block.type === 'heading') return inlineToPlain(block.inlines);
    if (block.type === 'paragraph') return block.lines.map(inlineToPlain).join('\n');
    return block.items.map((item, i) => `${block.ordered ? `${block.start + i}.` : '-'} ${inlineToPlain(item)}`).join('\n');
  }).join('\n');
}

// ─── Editor toolbar ──────────────────────────────────────────────────────────

export type MarkdownFormat = 'bold' | 'italic' | 'strike' | 'link' | 'image' | 'list' | 'orderedList' | 'h1' | 'h2';

export interface MarkdownEdit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

const WRAPS: Partial<Record<MarkdownFormat, [string, string, string]>> = {
  bold: ['**', '**', 'pogrubiony tekst'],
  italic: ['*', '*', 'kursywa'],
  strike: ['~~', '~~', 'przekreślony tekst'],
};

const LINE_PREFIX = /^(\s*([-*•]|\d+[.)])\s+|#{1,3}\s+)/;

/**
 * Apply a toolbar action to the textarea value. Wrapping formats wrap the selection (or a
 * placeholder, which ends up selected); line formats prefix every selected line and toggle
 * off when all lines already have that prefix.
 */
export function applyMarkdown(value: string, start: number, end: number, format: MarkdownFormat): MarkdownEdit {
  const selected = value.slice(start, end);
  const wrap = WRAPS[format];

  if (wrap) {
    const [open, close, placeholder] = wrap;
    const inner = selected || placeholder;
    const caret = start + open.length;
    return {
      value: value.slice(0, start) + open + inner + close + value.slice(end),
      selectionStart: caret,
      selectionEnd: caret + inner.length,
    };
  }

  if (format === 'link' || format === 'image') {
    const isUrl = /^https?:\/\/\S+$/.test(selected.trim());
    const placeholder = format === 'image' ? 'opis obrazka' : 'tekst linku';
    const label = selected && !isUrl ? selected : placeholder;
    const url = isUrl ? selected.trim() : 'https://';
    const snippet = `${format === 'image' ? '!' : ''}[${label}](${url})`;
    // Select the URL to type over it — or the label when a URL was selected
    const urlStart = start + snippet.length - url.length - 1;
    const labelStart = start + (format === 'image' ? 2 : 1);
    return {
      value: value.slice(0, start) + snippet + value.slice(end),
      selectionStart: isUrl ? labelStart : urlStart,
      selectionEnd: isUrl ? labelStart + label.length : urlStart + url.length,
    };
  }

  // Line formats operate on whole lines touched by the selection
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = value.indexOf('\n', end > start && value[end - 1] === '\n' ? end - 1 : end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const lines = value.slice(lineStart, lineEnd).split('\n');

  const prefixFor = (i: number) =>
    format === 'list' ? '- ' : format === 'orderedList' ? `${i + 1}. ` : format === 'h1' ? '# ' : '## ';
  const hasPrefix = (line: string) =>
    format === 'list' ? BULLET.test(line)
      : format === 'orderedList' ? ORDERED.test(line)
        : format === 'h1' ? /^#\s/.test(line) : /^##\s/.test(line);
  const contentLines = lines.filter(l => l.trim());
  const removing = contentLines.length > 0 && contentLines.every(hasPrefix);

  let n = 0;
  const replaced = lines.map(line => {
    if (!line.trim() && lines.length > 1) return line;
    const bare = line.replace(LINE_PREFIX, '');
    return removing ? bare : prefixFor(n++) + bare;
  }).join('\n');

  return {
    value: value.slice(0, lineStart) + replaced + value.slice(lineEnd),
    selectionStart: lineStart,
    selectionEnd: lineStart + replaced.length,
  };
}
