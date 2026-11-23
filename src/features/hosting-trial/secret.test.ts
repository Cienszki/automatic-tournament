import { describe, expect, it } from 'vitest';
import { checkTrialAccess } from './secret';

describe('checkTrialAccess', () => {
  it('does not exist without a secret', () => {
    expect(checkTrialAccess('Bearer x', undefined)).toBe('disabled');
    expect(checkTrialAccess('Bearer x', '')).toBe('disabled');
  });
  it('allows the right bearer token only', () => {
    expect(checkTrialAccess('Bearer s3cret', 's3cret')).toBe('allowed');
    expect(checkTrialAccess('Bearer s3cre', 's3cret')).toBe('denied');
    expect(checkTrialAccess(null, 's3cret')).toBe('denied');
  });
});
