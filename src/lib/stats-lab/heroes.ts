import { getHeroData, getHeroName } from '@/lib/hero-mapping';

const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes';

function shortName(heroId: number): string | null {
  const d = getHeroData(heroId);
  return d ? d.name.replace('npc_dota_hero_', '') : null;
}

/** Landscape portrait (256×144) */
export function heroImg(heroId: number): string | undefined {
  const s = shortName(heroId);
  return s ? `${CDN}/${s}.png` : undefined;
}

/** Full-body transparent render (large, ~0.5–1.5 MB — use for one hero at a time) */
export function heroRender(heroId: number): string | undefined {
  const s = shortName(heroId);
  return s ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders/${s}.png` : undefined;
}

/** Small square-ish minimap icon */
export function heroIcon(heroId: number): string | undefined {
  const s = shortName(heroId);
  return s ? `${CDN}/icons/${s}.png` : undefined;
}

export { getHeroName as heroName };

export type HeroAttr = 'str' | 'agi' | 'int' | 'all';
export function heroAttr(heroId: number): HeroAttr {
  return (getHeroData(heroId)?.primary_attr as HeroAttr) || 'all';
}

/** Attribute colours as in the Dota client (fixed meaning colours, not theme colours) */
export const ATTR_COLOR: Record<HeroAttr, string> = {
  str: '#e0533a',
  agi: '#36c46a',
  int: '#3fa7e8',
  all: '#d9b44a',
};
