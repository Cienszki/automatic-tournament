import { describe, it, expect } from 'vitest';
import { applyMarkdown, markdownToPlainText, parseInline, parseRuleMarkdown, sanitizeHref } from '@/lib/rules-markdown';
import { resolveAnswer } from '@/lib/rules-assistant';
import type { NumberedRule } from '@/lib/rules-numbering';

describe('parseInline', () => {
  it('parses bold, italic, strike and nesting', () => {
    expect(parseInline('a **b *c* d** ~~e~~ *f*')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'bold', children: [
        { type: 'text', text: 'b ' },
        { type: 'italic', children: [{ type: 'text', text: 'c' }] },
        { type: 'text', text: ' d' },
      ] },
      { type: 'text', text: ' ' },
      { type: 'strike', children: [{ type: 'text', text: 'e' }] },
      { type: 'text', text: ' ' },
      { type: 'italic', children: [{ type: 'text', text: 'f' }] },
    ]);
  });

  it('parses links and auto-links bare URLs without trailing punctuation', () => {
    expect(parseInline('[Discord](https://discord.gg/x) albo https://twitch.tv/pd2ih.')).toEqual([
      { type: 'link', href: 'https://discord.gg/x', children: [{ type: 'text', text: 'Discord' }] },
      { type: 'text', text: ' albo ' },
      { type: 'link', href: 'https://twitch.tv/pd2ih', children: [{ type: 'text', text: 'https://twitch.tv/pd2ih' }] },
      { type: 'text', text: '.' },
    ]);
  });

  it('drops unsafe link targets but keeps the label', () => {
    expect(parseInline('[kliknij](javascript:alert`1`)')).toEqual([{ type: 'text', text: 'kliknij' }]);
    expect(parseInline('[kliknij](data:text/html,x)')).toEqual([{ type: 'text', text: 'kliknij' }]);
  });

  it('only allows https images', () => {
    expect(parseInline('![logo](https://x.pl/a.png)')).toEqual([{ type: 'image', src: 'https://x.pl/a.png', alt: 'logo' }]);
    expect(parseInline('![logo](http://x.pl/a.png)')).toEqual([{ type: 'text', text: '![logo](http://x.pl/a.png)' }]);
  });

  it('leaves ordinary rule text alone', () => {
    expect(parseInline('Wygrana 2-0 → 2 pkt, kara 30s 70s lub 110s (patrz pkt. 6.8.)')).toEqual([
      { type: 'text', text: 'Wygrana 2-0 → 2 pkt, kara 30s 70s lub 110s (patrz pkt. 6.8.)' },
    ]);
  });
});

describe('sanitizeHref', () => {
  it('allows http(s), mailto, relative and bare domains', () => {
    expect(sanitizeHref('https://a.pl')).toBe('https://a.pl');
    expect(sanitizeHref('mailto:a@b.pl')).toBe('mailto:a@b.pl');
    expect(sanitizeHref('/pdl-s2/rules')).toBe('/pdl-s2/rules');
    expect(sanitizeHref('dota2inhouse.pl/pdl-s2')).toBe('https://dota2inhouse.pl/pdl-s2');
    expect(sanitizeHref('javascript:alert(1)')).toBeNull();
    expect(sanitizeHref('//evil.com')).toBeNull();
  });
});

describe('parseRuleMarkdown', () => {
  it('keeps single newlines as line breaks within a paragraph', () => {
    expect(parseRuleMarkdown('Punktacja:\nWygrana 2-0 → 2 pkt')).toEqual([
      { type: 'paragraph', lines: [[{ type: 'text', text: 'Punktacja:' }], [{ type: 'text', text: 'Wygrana 2-0 → 2 pkt' }]] },
    ]);
  });

  it('builds bullet and numbered lists, headings and paragraphs', () => {
    const blocks = parseRuleMarkdown('# Tytuł\nWstęp\n- jeden\n• dwa\n\n3. trzy\n4. cztery');
    expect(blocks.map(b => b.type)).toEqual(['heading', 'paragraph', 'list', 'list']);
    expect(blocks[2]).toMatchObject({ ordered: false, items: [[{ text: 'jeden' }], [{ text: 'dwa' }]] });
    expect(blocks[3]).toMatchObject({ ordered: true, start: 3 });
  });

  it('does not treat rule numbers or "*emphasis*" at line start as lists', () => {
    expect(parseRuleMarkdown('13.1 tekst').map(b => b.type)).toEqual(['paragraph']);
    expect(parseRuleMarkdown('*Uwaga* tekst').map(b => b.type)).toEqual(['paragraph']);
  });
});

describe('markdownToPlainText', () => {
  it('strips syntax and keeps link targets', () => {
    expect(markdownToPlainText('**Ważne:** dołącz na [Discord](https://discord.gg/x)\n- a\n- b'))
      .toBe('Ważne: dołącz na Discord (https://discord.gg/x)\n- a\n- b');
  });

  it('lets the assistant verify quotes taken from formatted rules', () => {
    const rule: NumberedRule = {
      ref: '1.1', paragraphId: 'p', sectionId: 's', sectionTitle: 'S', isSubParagraph: false,
      content: 'Spóźnienie **powyżej 15 minut** = przegrana gra.',
    };
    const answer = resolveAnswer({ answer: 'x', covered: true, citations: [{ ref: '1.1', quote: 'powyżej 15 minut = przegrana gra' }] }, [rule]);
    expect(answer?.citations[0].quote).toBe('powyżej 15 minut = przegrana gra');
  });
});

describe('applyMarkdown', () => {
  it('wraps the selection and keeps it selected', () => {
    const edit = applyMarkdown('ala ma kota', 4, 6, 'bold');
    expect(edit.value).toBe('ala **ma** kota');
    expect(edit.value.slice(edit.selectionStart, edit.selectionEnd)).toBe('ma');
  });

  it('inserts a selected placeholder when nothing is selected', () => {
    const edit = applyMarkdown('x ', 2, 2, 'italic');
    expect(edit.value).toBe('x *kursywa*');
    expect(edit.value.slice(edit.selectionStart, edit.selectionEnd)).toBe('kursywa');
  });

  it('turns selected text into a link and selects the URL to type over', () => {
    const edit = applyMarkdown('napisz na Discordzie', 10, 20, 'link');
    expect(edit.value).toBe('napisz na [Discordzie](https://)');
    expect(edit.value.slice(edit.selectionStart, edit.selectionEnd)).toBe('https://');
  });

  it('wraps a selected URL and selects the label', () => {
    const edit = applyMarkdown('https://a.pl', 0, 12, 'link');
    expect(edit.value).toBe('[tekst linku](https://a.pl)');
    expect(edit.value.slice(edit.selectionStart, edit.selectionEnd)).toBe('tekst linku');
  });

  it('prefixes whole lines for lists and toggles them off again', () => {
    const on = applyMarkdown('a\nb\nc', 1, 3, 'orderedList'); // selection spans lines "a" and "b"
    expect(on.value).toBe('1. a\n2. b\nc');
    const off = applyMarkdown(on.value, on.selectionStart, on.selectionEnd, 'orderedList');
    expect(off.value).toBe('a\nb\nc');
  });

  it('switches list type instead of stacking prefixes', () => {
    expect(applyMarkdown('- a', 0, 3, 'orderedList').value).toBe('1. a');
    expect(applyMarkdown('tekst', 2, 2, 'h1').value).toBe('# tekst');
  });
});
