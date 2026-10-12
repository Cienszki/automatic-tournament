import { describe, it, expect } from 'vitest';
import { diplomaFileName } from '@/components/diploma/PrintableDiploma';

describe('diplomaFileName', () => {
  it('is diploma-[tournament]-[player]', () => {
    expect(diplomaFileName('Wiosenna Furia', 'Andrzej')).toBe('diploma-Wiosenna Furia-Andrzej');
  });

  it('keeps Polish letters but drops characters not allowed in file names', () => {
    expect(diplomaFileName('PDL: Sezon 2/2026', 'Żółw*?"<>|')).toBe('diploma-PDL Sezon 2 2026-Żółw');
  });

  it('skips an empty tournament name', () => {
    expect(diplomaFileName('  ', 'Andrzej')).toBe('diploma-Andrzej');
  });
});
