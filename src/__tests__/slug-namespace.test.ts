import { describe, it, expect } from 'vitest';
import {
  parentNamespaces,
  isInNamespaceOf,
  checkNamespaceClaim,
  suggestNextInSeries,
  isRedirectTargetValid,
  type SlugOwner,
} from '@/lib/slug-namespace';

const WILQ = 'uid-wilq';
const OTHER = 'uid-other';

const world = (...t: [string, string | null][]): SlugOwner[] =>
  t.map(([slug, organizerId]) => ({ slug, organizerId }));

describe('parentNamespaces', () => {
  it('walks hyphen boundaries, shortest first', () => {
    expect(parentNamespaces('pdl')).toEqual([]);
    expect(parentNamespaces('pdl-s2')).toEqual(['pdl']);
    expect(parentNamespaces('pdl-s2-finals')).toEqual(['pdl', 'pdl-s2']);
  });

  it('is not confused by a slug that merely shares a prefix', () => {
    // 'pdlx' is NOT inside the 'pdl' namespace — only 'pdl-' counts.
    expect(isInNamespaceOf('pdlx', 'pdl')).toBe(false);
    expect(isInNamespaceOf('pdl-s2', 'pdl')).toBe(true);
    expect(isInNamespaceOf('pdl', 'pdl')).toBe(false);
  });
});

describe('checkNamespaceClaim — claiming a follow-up season', () => {
  it('lets the owner of pdl take pdl-s2', () => {
    const v = checkNamespaceClaim('pdl-s2', WILQ, world(['pdl', WILQ]));
    expect(v.ok).toBe(true);
  });

  it('stops a stranger taking pdl-s2 when someone else owns pdl', () => {
    const v = checkNamespaceClaim('pdl-s2', OTHER, world(['pdl', WILQ]));
    expect(v).toEqual({ ok: false, reason: 'parent-owned', conflictingSlug: 'pdl' });
  });

  it('checks every level of a deep namespace', () => {
    const v = checkNamespaceClaim(
      'pdl-s2-finals', OTHER, world(['pdl', OTHER], ['pdl-s2', WILQ])
    );
    expect(v).toEqual({ ok: false, reason: 'parent-owned', conflictingSlug: 'pdl-s2' });
  });

  it('allows any slug when no parent namespace exists', () => {
    expect(checkNamespaceClaim('pdl-s2', OTHER, world(['wiosenna', WILQ])).ok).toBe(true);
  });

  it('treats a tournament with no organizerId as not ours', () => {
    // Legacy tournaments carry organizerId 'pd2ih', which is not a real uid.
    // Nobody should inherit their namespace by accident.
    const v = checkNamespaceClaim('pdl-s2', WILQ, world(['pdl', null]));
    expect(v.ok).toBe(false);
  });
});

describe('checkNamespaceClaim — claiming the root of a series', () => {
  it("stops a stranger taking pdl when someone else already owns pdl-s2", () => {
    const v = checkNamespaceClaim('pdl', OTHER, world(['pdl-s2', WILQ]));
    expect(v).toEqual({ ok: false, reason: 'children-owned', conflictingSlug: 'pdl-s2' });
  });

  it('lets the owner of pdl-s2 also take pdl', () => {
    expect(checkNamespaceClaim('pdl', WILQ, world(['pdl-s2', WILQ])).ok).toBe(true);
  });
});

describe('checkNamespaceClaim — super admin', () => {
  it('bypasses both directions', () => {
    const existing = world(['pdl', WILQ], ['pdl-s2', WILQ]);
    expect(checkNamespaceClaim('pdl-s3', OTHER, existing, { isSuperAdmin: true }).ok).toBe(true);
    expect(checkNamespaceClaim('pdl', OTHER, existing, { isSuperAdmin: true }).ok).toBe(true);
  });
});

describe('suggestNextInSeries', () => {
  it('skips seasons already taken', () => {
    expect(suggestNextInSeries('pdl', ['pdl'])).toBe('pdl-s2');
    expect(suggestNextInSeries('pdl', ['pdl', 'pdl-s2'])).toBe('pdl-s3');
    expect(suggestNextInSeries('pdl', ['pdl', 'pdl-s2', 'pdl-s3'])).toBe('pdl-s4');
  });
});

describe('isRedirectTargetValid', () => {
  const existing = world(['pdl', WILQ], ['pdl-s2', WILQ]);

  it('accepts an empty target (redirect disabled)', () => {
    expect(isRedirectTargetValid('pdl', '', existing).ok).toBe(true);
  });

  it('accepts pointing an old season at a newer one', () => {
    expect(isRedirectTargetValid('pdl', 'pdl-s2', existing).ok).toBe(true);
  });

  it('rejects a self-redirect', () => {
    const v = isRedirectTargetValid('pdl', 'pdl', existing);
    expect(v.ok).toBe(false);
  });

  it('rejects a target that does not exist', () => {
    const v = isRedirectTargetValid('pdl', 'nope', existing);
    expect(v.ok).toBe(false);
  });
});
