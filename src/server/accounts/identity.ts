// Identity providers for accounts: Discord (login + linking) and Steam (optional linking, on Steam's
// own steamcommunity.com page). Routes live under /api/login and /api/connect — never /api/auth or
// /auth, which the community site in front of us owns.
//
// No cookies: Firebase Hosting forwards only `__session` to us, so the OAuth `state` carries
// everything it needs (mode, origin, return path, the signed-in uid when linking, a browser nonce)
// and is signed with an HMAC, valid for 10 minutes.

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export const DISCORD_SCOPES = 'identify connections';

/** Origins we may send people back to (the redirect URI must be registered in the Discord app) */
const ORIGINS = ['https://dota2inhouse.pl', 'https://www.dota2inhouse.pl', 'https://tournament-tracker-f35tb.web.app', 'http://localhost:3000'];
export const allowedOrigin = (o: unknown): o is string => typeof o === 'string' && ORIGINS.includes(o);
/** A path on our site (never another host) */
export const safeNext = (n: unknown) => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/');

export const discordConfigured = () => !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
const stateKey = () => createHmac('sha256', 'karty-state').update(process.env.DISCORD_CLIENT_SECRET || process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').digest();

export interface OAuthState { p: 'discord' | 'steam'; mode: 'login' | 'link'; origin: string; next: string; uid?: string; nonce?: string; exp: number }

export function signState(s: Omit<OAuthState, 'exp'>): string {
  const body = Buffer.from(JSON.stringify({ ...s, exp: Date.now() + 600_000, r: randomBytes(6).toString('hex') })).toString('base64url');
  return `${body}.${createHmac('sha256', stateKey()).update(body).digest('base64url')}`;
}
export function readState(token: string | null): OAuthState | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const want = createHmac('sha256', stateKey()).update(body).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OAuthState;
    return s.exp > Date.now() && allowedOrigin(s.origin) ? s : null;
  } catch { return null; }
}

// ── Discord ─────────────────────────────────────────────────────────────────

export const discordRedirect = (origin: string) => `${origin}/api/login/discord/callback`;

export function discordAuthorizeUrl(state: string, origin: string): string {
  const q = new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID!, redirect_uri: discordRedirect(origin), response_type: 'code', scope: DISCORD_SCOPES, state, prompt: 'none' });
  return `https://discord.com/oauth2/authorize?${q}`;
}

export interface DiscordIdentity { id: string; username: string; name: string; avatar: string | null; steamIds: string[] }

/** Code → the Discord user, plus Steam accounts they connected (and verified) in Discord */
export async function discordIdentity(code: string, origin: string): Promise<DiscordIdentity> {
  const tok = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID!, client_secret: process.env.DISCORD_CLIENT_SECRET!, grant_type: 'authorization_code', code, redirect_uri: discordRedirect(origin) }),
  });
  if (!tok.ok) throw new Error(`discord token ${tok.status}`);
  const { access_token } = await tok.json() as { access_token: string };
  const auth = { Authorization: `Bearer ${access_token}` };
  const [me, conns] = await Promise.all([
    fetch('https://discord.com/api/users/@me', { headers: auth }).then(r => { if (!r.ok) throw new Error(`discord me ${r.status}`); return r.json(); }),
    fetch('https://discord.com/api/users/@me/connections', { headers: auth }).then(r => (r.ok ? r.json() : [])).catch(() => []),
  ]);
  const steamIds = (conns as Array<{ type: string; id: string; verified?: boolean }>).filter(c => c.type === 'steam' && c.verified !== false && /^\d{17}$/.test(c.id)).map(c => c.id);
  return {
    id: me.id, username: me.username, name: me.global_name || me.username,
    avatar: me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=256` : null, steamIds,
  };
}

/** Is this Discord user on that server? Needs our bot there (DISCORD_BOT_TOKEN); null = cannot tell */
export async function discordMember(guildId: string, discordId: string): Promise<boolean | null> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token || !/^\d{15,22}$/.test(guildId)) return null;
  const r = await fetch(`https://discord.com/api/guilds/${guildId}/members/${discordId}`, { headers: { Authorization: `Bot ${token}` } });
  if (r.ok) return true;
  if (r.status === 404) {
    const body = await r.json().catch(() => ({}));
    // 10007 = unknown member (not on the server); 10004 = unknown guild (our bot is not there)
    return body?.code === 10007 ? false : null;
  }
  return null;
}

// ── Steam (OpenID 2.0 on steamcommunity.com) ─────────────────────────────────

export const steamReturn = (origin: string, state: string) => `${origin}/api/connect/steam/callback?state=${encodeURIComponent(state)}`;

export function steamLoginUrl(origin: string, state: string): string {
  const q = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0', 'openid.mode': 'checkid_setup',
    'openid.return_to': steamReturn(origin, state), 'openid.realm': origin,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select', 'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });
  return `https://steamcommunity.com/openid/login?${q}`;
}

/** Asks Steam whether this answer is genuine; returns the steamId64 or null */
export async function steamVerify(params: URLSearchParams, expectedReturn: string): Promise<string | null> {
  if (params.get('openid.mode') !== 'id_res' || params.get('openid.return_to') !== expectedReturn) return null;
  const check = new URLSearchParams(params); check.set('openid.mode', 'check_authentication');
  const r = await fetch('https://steamcommunity.com/openid/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: check });
  if (!r.ok || !/is_valid\s*:\s*true/.test(await r.text())) return null;
  const m = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/.exec(params.get('openid.claimed_id') ?? '');
  return m ? m[1] : null;
}

/** Steam profile picture (Steam Web API) */
export async function steamAvatar(steamId64: string): Promise<string | null> {
  const key = process.env.STEAM_API_KEY; if (!key) return null;
  try {
    const r = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamId64}`);
    const p = (await r.json())?.response?.players?.[0];
    return p?.avatarfull ?? null;
  } catch { return null; }
}

export const steam32to64 = (id32: string) => (BigInt(id32) + BigInt('76561197960265728')).toString();
