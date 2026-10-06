// src/lib/rules-numbering.ts
// Shared shape + numbering of a tournament rulebook (tournaments/{id}/rules/{section}/paragraphs).
// Used by the rules page (displayed numbers, scroll anchors) and the rules assistant API
// (the numbers the model cites) — keeping both on one function means a citation like
// "3.2.1" always points at the paragraph the page shows as 3.2.1.

export interface RuleParagraph {
  id: string;
  content: string;
  commentary?: string;
  order: number;
  parentId?: string; // For nested sub-paragraphs (e.g., 5.11.1)
}

export interface RuleSection {
  id: string;
  title: string;
  order: number;
  paragraphs: RuleParagraph[];
}

export interface NumberedRule {
  /** Displayed number, e.g. "3.2" or "3.2.1" */
  ref: string;
  paragraphId: string;
  sectionId: string;
  sectionTitle: string;
  content: string;
  commentary?: string;
  isSubParagraph: boolean;
}

/** Sort sections and their paragraphs in place, the way the rules page displays them. */
export function sortRuleSections(sections: RuleSection[]): RuleSection[] {
  for (const section of sections) section.paragraphs.sort((a, b) => a.order - b.order);
  return sections.sort((a, b) => a.order - b.order);
}

/**
 * Number every displayed paragraph. Expects sorted input (see sortRuleSections).
 * Section number = section.order, paragraph = position among top-level paragraphs,
 * sub-paragraph = position among its parent's children. Sub-paragraphs whose parent
 * is missing are not rendered on the page, so they are skipped here too.
 */
export function numberRules(sections: RuleSection[]): NumberedRule[] {
  const numbered: NumberedRule[] = [];
  for (const section of sections) {
    const topLevel = section.paragraphs.filter(p => !p.parentId);
    topLevel.forEach((paragraph, paraIndex) => {
      const ref = `${section.order}.${paraIndex + 1}`;
      numbered.push(toNumbered(paragraph, section, ref, false));
      section.paragraphs
        .filter(p => p.parentId === paragraph.id)
        .forEach((sub, subIndex) => numbered.push(toNumbered(sub, section, `${ref}.${subIndex + 1}`, true)));
    });
  }
  return numbered;
}

function toNumbered(p: RuleParagraph, section: RuleSection, ref: string, isSubParagraph: boolean): NumberedRule {
  return {
    ref,
    paragraphId: p.id,
    sectionId: section.id,
    sectionTitle: section.title,
    content: p.content,
    commentary: p.commentary,
    isSubParagraph,
  };
}

/** DOM id of a paragraph row on the rules page — the scroll target for citations. */
export function ruleAnchorId(paragraphId: string): string {
  return `rule-${paragraphId}`;
}
