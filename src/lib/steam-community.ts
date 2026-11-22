// Steam profile lookups that keep working when the Steam Web API key doesn't: the public profile
// page as XML (steamcommunity.com/id/<name>/?xml=1, /profiles/<steam64>/?xml=1) needs no key.
// The API stays the first choice; this is the fallback, so a revoked key (Steam revokes it when
// Steam Guard is reset) no longer turns into empty Steam ids saved for standins or a broken whitelist.

export interface CommunityProfile {
  steamId64: string;
  name: string;
  avatar: string;
  avatarMedium: string;
  avatarFull: string;
}

/** What admins see when Steam refuses the key: the fix, not a raw 403 */
export const STEAM_KEY_MESSAGE =
  'Steam odrzuca klucz Steam API (403). Wygeneruj nowy na steamcommunity.com/dev/apikey i ustaw go jako STEAM_API_KEY.';

/** Steam answers 401/403 for a key it doesn't accept */
export const steamKeyRejected = (status: number) => status === 401 || status === 403;

const cdata = (xml: string, tag: string) =>
  new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))\\s*</${tag}>`).exec(xml)?.slice(1).find(v => v != null)?.trim() ?? '';

/** Reads a profile from its XML page; exported for tests */
export function parseCommunityXml(xml: string): CommunityProfile | null {
  const steamId64 = /<steamID64>(\d{17})<\/steamID64>/.exec(xml)?.[1];
  if (!steamId64) return null;
  return {
    steamId64,
    name: cdata(xml, 'steamID'),
    avatar: cdata(xml, 'avatarIcon'),
    avatarMedium: cdata(xml, 'avatarMedium'),
    avatarFull: cdata(xml, 'avatarFull'),
  };
}

/** The public profile, by custom URL name or Steam64 id; null when Steam has no such profile */
export async function communityProfile(who: { vanity: string } | { steamId64: string }): Promise<CommunityProfile | null> {
  const path = 'vanity' in who ? `id/${encodeURIComponent(who.vanity)}` : `profiles/${who.steamId64}`;
  try {
    const r = await fetch(`https://steamcommunity.com/${path}/?xml=1`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return parseCommunityXml(await r.text());
  } catch (e) {
    console.warn(`[steam-community] ${path} failed:`, (e as Error).message);
    return null;
  }
}
