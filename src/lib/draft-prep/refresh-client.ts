'use client';

// Runs the stepwise STRATZ hero-data refresh from an admin's browser (the admin panel button,
// and once right after a tournament is created). Each step is a short request.

export async function refreshHeroDataSteps(
  token: string,
  tournamentId: string,
  opts: { force?: boolean; onProgress?: (done: number, total: number) => void } = {},
): Promise<{ fresh?: boolean }> {
  let steps = 1;
  for (let step = 0; step < steps; step++) {
    const res = await fetch('/api/manage/draft-prep-heroes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tournamentId, step, force: !!opts.force }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.success) throw new Error(j.error || `HTTP ${res.status}`);
    if (j.fresh) return { fresh: true };
    steps = j.steps ?? steps;
    opts.onProgress?.(step + 1, steps);
    if (j.done) break;
  }
  return {};
}
