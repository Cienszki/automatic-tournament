import { describe, it, expect } from 'vitest';
import type { RuleParagraph, RuleSection } from '@/lib/rules-numbering';
import { numberRules } from '@/lib/rules-numbering';
import {
  appendSubParagraph,
  moveParagraph,
  moveSubParagraph,
  normalizeParagraphs,
  reorderSections,
  renumberSections,
} from '@/lib/rules-editing';

const p = (id: string, order: number, parentId?: string): RuleParagraph => ({ id, content: id, order, parentId });

function makeSections(): RuleSection[] {
  return [
    { id: 's1', title: 'A', order: 1, paragraphs: normalizeParagraphs([p('a1', 1), p('a1x', 2, 'a1'), p('a1y', 3, 'a1'), p('a2', 4)]) },
    { id: 's2', title: 'B', order: 2, paragraphs: normalizeParagraphs([p('b1', 1), p('b2', 2), p('b2x', 3, 'b2')]) },
  ];
}

const refs = (sections: RuleSection[]) => Object.fromEntries(numberRules(sections).map(r => [r.paragraphId, r.ref]));

describe('normalizeParagraphs', () => {
  it('puts each parent before its subs and makes order sequential', () => {
    // Old editor data: subs numbered 1,2 among themselves, colliding with parents
    const out = normalizeParagraphs([p('x1', 1, 'a'), p('a', 1), p('x2', 2, 'a'), p('b', 2)]);
    expect(out.map(q => [q.id, q.order])).toEqual([['a', 1], ['x1', 2], ['x2', 3], ['b', 4]]);
  });

  it('keeps orphaned sub-paragraphs at the end instead of dropping them', () => {
    expect(normalizeParagraphs([p('a', 1), p('lost', 2, 'gone')]).map(q => q.id)).toEqual(['a', 'lost']);
  });
});

describe('sections', () => {
  it('reorders and renumbers chapters', () => {
    const out = reorderSections(makeSections(), 1, 0);
    expect(out.map(s => [s.id, s.order])).toEqual([['s2', 1], ['s1', 2]]);
    expect(refs(out).b1).toBe('1.1');
  });

  it('closes numbering gaps', () => {
    const [a, b] = makeSections();
    expect(renumberSections([a, { ...b, order: 5 }]).map(s => s.order)).toEqual([1, 2]);
  });
});

describe('moveParagraph', () => {
  it('moves a paragraph with its subs within a section', () => {
    const out = moveParagraph(makeSections(), 's1', 0, 's1', 1);
    expect(refs(out)).toMatchObject({ a2: '1.1', a1: '1.2', a1x: '1.2.1', a1y: '1.2.2' });
  });

  it('moves a paragraph with its subs to another section', () => {
    const out = moveParagraph(makeSections(), 's1', 0, 's2', 1);
    expect(out[0].paragraphs.map(q => q.id)).toEqual(['a2']);
    expect(refs(out)).toMatchObject({ a2: '1.1', b1: '2.1', a1: '2.2', a1x: '2.2.1', a1y: '2.2.2', b2: '2.3', b2x: '2.3.1' });
  });

  it('ignores unknown sections and indexes', () => {
    const sections = makeSections();
    expect(moveParagraph(sections, 'nope', 0, 's1', 0)).toBe(sections);
    expect(moveParagraph(sections, 's1', 9, 's1', 0)).toBe(sections);
  });
});

describe('moveSubParagraph', () => {
  it('reorders subs under the same parent', () => {
    const out = moveSubParagraph(makeSections(), 'a1', 1, 'a1', 0);
    expect(refs(out)).toMatchObject({ a1y: '1.1.1', a1x: '1.1.2' });
  });

  it('moves a sub under a parent in another section', () => {
    const out = moveSubParagraph(makeSections(), 'a1', 0, 'b2', 0);
    expect(out[1].paragraphs.find(q => q.id === 'a1x')?.parentId).toBe('b2');
    expect(refs(out)).toMatchObject({ a1y: '1.1.1', a1x: '2.2.1', b2x: '2.2.2' });
  });

  it('moves a sub under a parent that had none', () => {
    const out = moveSubParagraph(makeSections(), 'a1', 0, 'a2', 0);
    expect(refs(out)).toMatchObject({ a1y: '1.1.1', a2: '1.2', a1x: '1.2.1' });
  });
});

describe('appendSubParagraph', () => {
  it('adds the new sub after existing siblings', () => {
    const out = appendSubParagraph(makeSections()[0].paragraphs, 'a1', p('new', 99));
    expect(out.map(q => q.id)).toEqual(['a1', 'a1x', 'a1y', 'new', 'a2']);
    expect(out.find(q => q.id === 'new')).toMatchObject({ parentId: 'a1', order: 4 });
  });
});
