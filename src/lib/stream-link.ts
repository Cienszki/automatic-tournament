// A caster's stream: any https link (Twitch, YouTube, Kick, TikTok, Facebook…). A bare channel
// name means Twitch, the usual case. Stored as the full URL; shown short ("twitch.tv/vanrood").

const PLATFORMS: Array<[RegExp, string]> = [
  [/(^|\.)twitch\.tv$/, 'Twitch'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)kick\.com$/, 'Kick'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)(facebook\.com|fb\.gg)$/, 'Facebook'],
];

/** What the caster typed → the URL to keep, '' to clear, or why it isn't a stream link */
export function parseStream(input: string): { url: string } | { error: string } {
  const v = input.trim();
  if (!v) return { url: '' };
  if (/^[A-Za-z0-9_]{3,25}$/.test(v)) return { url: `https://twitch.tv/${v.toLowerCase()}` };
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`); } catch { return { error: 'To nie jest link do transmisji.' }; }
  if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.') || v.length > 200) return { error: 'To nie jest link do transmisji.' };
  u.protocol = 'https:';
  u.hash = '';
  return { url: u.toString().replace(/\/$/, '') };
}

export function streamPlatform(url: string): string | null {
  try { const h = new URL(url).hostname.replace(/^www\.|^m\./, ''); return PLATFORMS.find(([re]) => re.test(h))?.[1] ?? null; } catch { return null; }
}

/** "twitch.tv/vanrood", "youtube.com/@kanal" */
export function streamLabel(url: string): string {
  try { const u = new URL(url); return `${u.hostname.replace(/^www\.|^m\./, '')}${u.pathname === '/' ? '' : u.pathname}`; } catch { return url; }
}
