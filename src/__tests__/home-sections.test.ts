import { describe, it, expect } from 'vitest';
import { getHomeSections, getHomeSectionIndex } from '@/context/HomeNavigationContext';

describe('getHomeSections', () => {
  it('includes optional sections only when they apply', () => {
    expect(getHomeSections({ pickemEnabled: true, signedIn: true })).toEqual(
      ['start', 'groups', 'schedule', 'teams', 'stats', 'cards', 'pickem', 'my-team'],
    );
    expect(getHomeSections({ pickemEnabled: false, signedIn: false })).toEqual(
      ['start', 'groups', 'schedule', 'teams', 'stats', 'cards'],
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
      expect(getHomeSectionIndex('cards', { pickemEnabled })).toBe(5);
    }
  });

  it('moves the account section up when Pick\'em is disabled', () => {
    expect(getHomeSectionIndex('my-team', { pickemEnabled: true })).toBe(7);
    expect(getHomeSectionIndex('my-team', { pickemEnabled: false })).toBe(6);
  });

  it('has no index for a disabled Pick\'em, unknown views or the account section when signed out', () => {
    expect(getHomeSectionIndex('pickem', { pickemEnabled: false })).toBeUndefined();
    expect(getHomeSectionIndex('nonsense', { pickemEnabled: true })).toBeUndefined();
    expect(getHomeSectionIndex('my-team', { pickemEnabled: true, signedIn: false })).toBeUndefined();
  });
});
