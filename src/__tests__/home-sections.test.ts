import { describe, it, expect } from 'vitest';
import { getHomeSections, getHomeSectionIndex } from '@/context/HomeNavigationContext';

describe('getHomeSections', () => {
  it('includes optional sections only when they apply', () => {
    expect(getHomeSections({ pickemEnabled: true, hasTeam: true })).toEqual(
      ['start', 'groups', 'schedule', 'teams', 'stats', 'pickem', 'my-team'],
    );
    expect(getHomeSections({ pickemEnabled: false, hasTeam: false })).toEqual(
      ['start', 'groups', 'schedule', 'teams', 'stats'],
    );
  });
});

describe('getHomeSectionIndex', () => {
  it('keeps the fixed sections in place', () => {
    for (const pickemEnabled of [true, false]) {
      expect(getHomeSectionIndex('groups', { pickemEnabled })).toBe(1);
      expect(getHomeSectionIndex('playoffs', { pickemEnabled })).toBe(1);
      expect(getHomeSectionIndex('teams', { pickemEnabled })).toBe(3);
      expect(getHomeSectionIndex('stats', { pickemEnabled })).toBe(4);
      // Rankings is a view of the stats section now
      expect(getHomeSectionIndex('rankings', { pickemEnabled })).toBe(4);
    }
  });

  it('moves "my team" up when Pick\'em is disabled', () => {
    expect(getHomeSectionIndex('my-team', { pickemEnabled: true })).toBe(6);
    expect(getHomeSectionIndex('my-team', { pickemEnabled: false })).toBe(5);
  });

  it('has no index for a disabled Pick\'em, unknown views or my-team without a team', () => {
    expect(getHomeSectionIndex('pickem', { pickemEnabled: false })).toBeUndefined();
    expect(getHomeSectionIndex('nonsense', { pickemEnabled: true })).toBeUndefined();
    expect(getHomeSectionIndex('my-team', { pickemEnabled: true, hasTeam: false })).toBeUndefined();
  });
});
