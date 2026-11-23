import { describe, expect, it } from 'vitest';
import { sitemapEntries, type ListedTournament } from './sitemap';

const NOW = new Date('2026-11-20T12:00:00.000Z');
const UPDATED = new Date('2026-11-01T10:00:00.000Z');
const t = (o: Partial<ListedTournament>): ListedTournament => ({ slug: 'liga', formatPreset: 'swiss', status: 'active', updatedAt: UPDATED, ...o });

describe('sitemapEntries', () => {
  it('lists the home page alone when there are no tournaments', () => {
    expect(sitemapEntries('https://example.org', [], NOW)).toEqual([
      { url: 'https://example.org', lastModified: NOW.toISOString(), changeFrequency: 'monthly', priority: 0.8 },
    ]);
  });

  it("lists a tournament's common pages, dated by its last change", () => {
    const entries = sitemapEntries('https://example.org', [t({})], NOW);
    expect(entries.map((e) => e.url)).toEqual([
      'https://example.org', 'https://example.org/liga', 'https://example.org/liga/teams', 'https://example.org/liga/schedule',
      'https://example.org/liga/playoffs', 'https://example.org/liga/stats', 'https://example.org/liga/rules',
      'https://example.org/liga/faq', 'https://example.org/liga/news', 'https://example.org/liga/about',
    ]);
    expect(entries[1]).toEqual({ url: 'https://example.org/liga', lastModified: UPDATED.toISOString(), changeFrequency: 'weekly', priority: 1 });
  });

  it('adds divisions for a league and groups for a group tournament', () => {
    const urls = sitemapEntries('https://x.org', [t({ slug: 'l', formatPreset: 'league' }), t({ slug: 'g', formatPreset: 'mmr-limited' })], NOW).map((e) => e.url);
    expect(urls).toContain('https://x.org/l/divisions');
    expect(urls).toContain('https://x.org/g/groups');
    expect(urls).not.toContain('https://x.org/l/groups');
  });

  it('weights finished tournaments lower and leaves drafts out', () => {
    const entries = sitemapEntries('https://x.org', [t({ slug: 'done', status: 'completed' }), t({ slug: 'old', status: 'archived' }), t({ slug: 'wip', status: 'draft' })], NOW);
    expect(entries.find((e) => e.url === 'https://x.org/done')?.priority).toBe(0.6);
    expect(entries.find((e) => e.url === 'https://x.org/old/teams')?.priority).toBe(0.4);
    expect(entries.some((e) => e.url.includes('/wip'))).toBe(false);
  });
});
