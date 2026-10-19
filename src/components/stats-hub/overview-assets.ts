// Pictures the overview draws — loaded right after the site loads, before anyone opens stats.
import type { Model } from '@/lib/stats-lab/derive';
import { avatar, logo, portrait, render, type Asset } from './assets';
import { GALLERY_RENDER_SIZES, buildOverview } from './overview-data';

export function overviewAssets(model: Model): Asset[] {
  if (!model.games.length) return [];
  const d = buildOverview(model);
  return [
    // First panel of the gallery — what is visible the moment it opens
    ...render(d.records[0]?.perf.heroId, GALLERY_RENDER_SIZES),
    ...d.records.flatMap(r => [...avatar(r.perf.player), ...logo(r.perf.team)]),
    // The rest of the gallery
    ...d.rankings.roles.flatMap(r => [...avatar(r.player), ...portrait(r.player.heroes[0]?.heroId)]),
    ...logo(d.rankings.team?.team),
    ...d.records.slice(1).flatMap(r => render(r.perf.heroId, GALLERY_RENDER_SIZES)),
    ...d.leaders.flatMap(l => [...avatar(l.player), ...portrait(l.player.heroes[0]?.heroId)]),
    ...render(d.heroes[0]?.heroId, GALLERY_RENDER_SIZES),
    ...d.heroes.flatMap(h => portrait(h.heroId)),
    ...d.stories.flatMap(f => [...render(f.heroId, GALLERY_RENDER_SIZES), ...avatar(f.player), ...logo(f.team)]),
    ...d.elo.flatMap(e => [...logo(e.team), ...portrait(e.team.heroPicks[0]?.heroId)]),
    ...d.achievements.featured.flatMap(a => avatar(a.unlocks[0]?.player)),
    // Thumbnails of the other overview designs
    ...portrait(d.achievements.featured[0]?.unlocks[0]?.perf?.heroId),
    ...portrait(d.stories[0]?.heroId),
  ];
}
