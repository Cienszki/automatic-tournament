import { describe, expect, it } from 'vitest';
import { TAG_KINDS, tags, tournamentTags } from '.';

describe('cache tags', () => {
  it('spells every kind of tournament data under the tournament prefix', () => {
    for (const kind of TAG_KINDS) {
      expect(tags[kind]('abc123')).toBe(`t:abc123:${kind}`);
    }
    expect(tags.tournament('abc123')).toBe('t:abc123');
  });

  it('gives different tournaments different tags', () => {
    expect(tags.teams('a')).not.toBe(tags.teams('b'));
    expect(tags.tournament('a')).not.toBe(tags.tournament('ab'));
  });

  it('lets one tournament-wide tag cover every query of that tournament', () => {
    expect(tournamentTags('pdl-s2', 'teams', 'core')).toEqual(['t:pdl-s2', 't:pdl-s2:teams', 't:pdl-s2:core']);
    expect(tournamentTags('pdl-s2')).toEqual(['t:pdl-s2']);
  });

  it('keeps slugs apart from tournament ids', () => {
    expect(tags.slug('pdl-s2')).toBe('slug:pdl-s2');
  });

  it('refuses ids that would make an ambiguous or oversized tag', () => {
    expect(() => tags.teams('')).toThrow(/not a valid id/);
    expect(() => tags.teams('a:b')).toThrow(/not a valid id/);
    expect(() => tags.slug('a b')).toThrow(/not a valid id/);
    expect(() => tags.tournament('x'.repeat(129))).toThrow(/not a valid id/);
  });

  it('accepts imported Firestore ids and slugs', () => {
    expect(tags.core('HVwwRd87bSFsCzkph25p')).toBe('t:HVwwRd87bSFsCzkph25p:core');
    expect(tags.slug('seed-liga')).toBe('slug:seed-liga');
  });
});
