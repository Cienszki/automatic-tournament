// src/lib/slug-namespace.ts
//
// Slug namespaces for recurring tournaments.
//
// Organisers run the same tournament repeatedly — "PDL", then "PDL Season 2".
// The natural slugs are `pdl` and `pdl-s2`, and the organiser of `pdl` should be
// the only person who can take `pdl-s2`. Otherwise a stranger could claim the
// obvious next name for someone else's established tournament.
//
// The rule, in both directions:
//   - claiming `pdl-s2` requires owning `pdl`
//   - claiming `pdl` requires owning every existing `pdl-*`
//
// Ownership is `tournament.organizerId`. Super admins bypass everything.
//
// Deliberate limitation: this is enforced in app code, not firestore.rules.
// Rules cannot run queries, so they cannot discover which sibling slugs exist.
// Since tournament creation is already restricted to an allowlist of trusted
// organisers, this stops accidents and land-grabs between colleagues rather than
// a determined attacker with the client SDK.

export interface SlugOwner {
  slug: string;
  organizerId?: string | null;
}

/**
 * Candidate parent namespaces for a slug, longest-last.
 *
 *   'pdl'            -> []
 *   'pdl-s2'         -> ['pdl']
 *   'pdl-s2-finals'  -> ['pdl', 'pdl-s2']
 */
export function parentNamespaces(slug: string): string[] {
  const parts = slug.split('-').filter(Boolean);
  const out: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    out.push(parts.slice(0, i).join('-'));
  }
  return out;
}

/** True when `slug` sits inside the namespace owned by `base` (`pdl-s2` in `pdl`). */
export function isInNamespaceOf(slug: string, base: string): boolean {
  return slug !== base && slug.startsWith(`${base}-`);
}

export type NamespaceVerdict =
  | { ok: true }
  | { ok: false; reason: 'parent-owned'; conflictingSlug: string }
  | { ok: false; reason: 'children-owned'; conflictingSlug: string };

/**
 * Decide whether `requesterId` may claim `slug`, given every existing tournament.
 *
 * `existing` should exclude the tournament being edited, if any.
 */
export function checkNamespaceClaim(
  slug: string,
  requesterId: string,
  existing: SlugOwner[],
  opts: { isSuperAdmin?: boolean } = {}
): NamespaceVerdict {
  if (opts.isSuperAdmin) return { ok: true };

  const ownedBySomeoneElse = (t: SlugOwner) =>
    !t.organizerId || t.organizerId !== requesterId;

  // Claiming a child: every parent namespace must be ours (or not exist).
  for (const parent of parentNamespaces(slug)) {
    const match = existing.find(t => t.slug === parent);
    if (match && ownedBySomeoneElse(match)) {
      return { ok: false, reason: 'parent-owned', conflictingSlug: parent };
    }
  }

  // Claiming a root: we must not be stepping over someone else's children.
  // Without this, an organiser who has `pdl-s2` could have `pdl` taken from
  // under them by a stranger, who would then own the namespace going forward.
  for (const t of existing) {
    if (isInNamespaceOf(t.slug, slug) && ownedBySomeoneElse(t)) {
      return { ok: false, reason: 'children-owned', conflictingSlug: t.slug };
    }
  }

  return { ok: true };
}

export function describeNamespaceVerdict(v: NamespaceVerdict): string | null {
  if (v.ok) return null;
  if (v.reason === 'parent-owned') {
    return `Adres należy do serii turniejów "${v.conflictingSlug}", którą prowadzi inny ` +
           `organizator. Wybierz adres spoza tej serii.`;
  }
  return `Istnieje już turniej "${v.conflictingSlug}" innego organizatora w tej serii, ` +
         `więc nie możesz zająć adresu nadrzędnego.`;
}

/**
 * Next free slug in a series, for suggesting the follow-up season.
 * `pdl` with `pdl-s2` taken suggests `pdl-s3`.
 */
export function suggestNextInSeries(base: string, existingSlugs: string[]): string {
  const taken = new Set(existingSlugs);
  for (let n = 2; n < 100; n++) {
    const candidate = `${base}-s${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-next`;
}

/**
 * Guard against redirect chains and loops.
 *
 * Redirects are a single hop by design: `/pdl -> /pdl-s2` is followed, but if
 * `pdl-s2` also redirects we do not chase it. That keeps the rule easy to reason
 * about and makes a cycle impossible to construct by accident.
 */
export function isRedirectTargetValid(
  fromSlug: string,
  toSlug: string,
  existing: SlugOwner[]
): { ok: true } | { ok: false; message: string } {
  if (!toSlug) return { ok: true };
  if (toSlug === fromSlug) {
    return { ok: false, message: 'Turniej nie może przekierowywać sam na siebie.' };
  }
  if (!existing.some(t => t.slug === toSlug)) {
    return { ok: false, message: `Nie ma turnieju o adresie "${toSlug}".` };
  }
  return { ok: true };
}
