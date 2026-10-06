// src/lib/rules-editing.ts
// Pure structural edits for the admin rules editor (RulesTab): drag-and-drop moves,
// adding sub-paragraphs, and keeping `order` values consistent with what the rules
// page displays (see numberRules in rules-numbering.ts).

import type { RuleParagraph, RuleSection } from './rules-numbering';

interface ParagraphNode {
  paragraph: RuleParagraph;
  subs: RuleParagraph[];
}

interface ParagraphTree {
  nodes: ParagraphNode[];
  /** Sub-paragraphs whose parent is gone — not shown on the page, but kept rather than silently deleted */
  orphans: RuleParagraph[];
}

function toTree(paragraphs: RuleParagraph[]): ParagraphTree {
  const nodes = paragraphs.filter(p => !p.parentId).map(p => ({ paragraph: p, subs: [] as RuleParagraph[] }));
  const byId = new Map(nodes.map(n => [n.paragraph.id, n]));
  const orphans: RuleParagraph[] = [];
  for (const p of paragraphs) {
    if (p.parentId) (byId.get(p.parentId)?.subs ?? orphans).push(p);
  }
  return { nodes, orphans };
}

function fromTree({ nodes, orphans }: ParagraphTree): RuleParagraph[] {
  const flat: RuleParagraph[] = [];
  for (const node of nodes) {
    flat.push({ ...node.paragraph, parentId: undefined });
    for (const sub of node.subs) flat.push({ ...sub, parentId: node.paragraph.id });
  }
  flat.push(...orphans);
  return flat.map((p, i) => ({ ...p, order: i + 1 }));
}

/**
 * Paragraphs in display order (each parent followed by its sub-paragraphs) with
 * sequential `order` values, so sorting by `order` always reproduces that layout.
 * Expects input already sorted by `order`.
 */
export function normalizeParagraphs(paragraphs: RuleParagraph[]): RuleParagraph[] {
  return fromTree(toTree(paragraphs));
}

/** Section `order` is the displayed chapter number — keep it 1..n with no gaps. */
export function renumberSections(sections: RuleSection[]): RuleSection[] {
  return sections.map((s, i) => (s.order === i + 1 ? s : { ...s, order: i + 1 }));
}

export function reorderSections(sections: RuleSection[], fromIndex: number, toIndex: number): RuleSection[] {
  const next = [...sections];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return sections;
  next.splice(toIndex, 0, moved);
  return renumberSections(next);
}

/** Move a top-level paragraph (with its sub-paragraphs) within or between sections. Indexes count top-level paragraphs only. */
export function moveParagraph(
  sections: RuleSection[],
  fromSectionId: string,
  fromIndex: number,
  toSectionId: string,
  toIndex: number,
): RuleSection[] {
  const trees = new Map(sections.map(s => [s.id, toTree(s.paragraphs)]));
  const source = trees.get(fromSectionId);
  const target = trees.get(toSectionId);
  if (!source || !target) return sections;
  const [node] = source.nodes.splice(fromIndex, 1);
  if (!node) return sections;
  target.nodes.splice(toIndex, 0, node);
  return sections.map(s =>
    s.id === fromSectionId || s.id === toSectionId ? { ...s, paragraphs: fromTree(trees.get(s.id)!) } : s
  );
}

/** Move a sub-paragraph within its parent or under another parent paragraph (any section). Indexes count that parent's sub-paragraphs. */
export function moveSubParagraph(
  sections: RuleSection[],
  fromParentId: string,
  fromIndex: number,
  toParentId: string,
  toIndex: number,
): RuleSection[] {
  const entries = sections.map(section => ({ section, tree: toTree(section.paragraphs) }));
  const find = (parentId: string) => {
    for (const entry of entries) {
      const node = entry.tree.nodes.find(n => n.paragraph.id === parentId);
      if (node) return { entry, node };
    }
    return null;
  };
  const source = find(fromParentId);
  const target = find(toParentId);
  if (!source || !target) return sections;
  const [sub] = source.node.subs.splice(fromIndex, 1);
  if (!sub) return sections;
  target.node.subs.splice(toIndex, 0, sub);
  const touched = new Set([source.entry.section.id, target.entry.section.id]);
  return entries.map(({ section, tree }) => (touched.has(section.id) ? { ...section, paragraphs: fromTree(tree) } : section));
}

/** Append a sub-paragraph as the last child of `parentId`. */
export function appendSubParagraph(paragraphs: RuleParagraph[], parentId: string, sub: RuleParagraph): RuleParagraph[] {
  const tree = toTree(paragraphs);
  const parent = tree.nodes.find(n => n.paragraph.id === parentId);
  if (!parent) return paragraphs;
  parent.subs.push(sub);
  return fromTree(tree);
}
