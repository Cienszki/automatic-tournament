// Discord DMs from the website, through Discord's REST API with the tournament bot's token
// (DISCORD_BOT_TOKEN) — no gateway connection needed. Discord only lets a bot write to someone who
// shares a server with it and allows DMs from server members; otherwise it answers 50007.

const API = 'https://discord.com/api/v10';

export type DmResult = 'sent' | 'blocked' | 'failed' | 'off';
export interface DmMessage { title: string; body: string; url?: string | null; footer?: string | null; color?: number | null }

async function discord(path: string, body: object, retry = true): Promise<Response> {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (r.status === 429 && retry) {
    const wait = Number((await r.clone().json().catch(() => ({})))?.retry_after ?? 1);
    await new Promise(res => setTimeout(res, Math.min(5, wait) * 1000));
    return discord(path, body, false);
  }
  return r;
}

export async function sendDm(discordId: string, m: DmMessage): Promise<DmResult> {
  if (!process.env.DISCORD_BOT_TOKEN || !/^\d{15,22}$/.test(discordId)) return 'off';
  try {
    const ch = await discord('/users/@me/channels', { recipient_id: discordId });
    if (!ch.ok) return 'failed';
    const { id } = await ch.json() as { id: string };
    const r = await discord(`/channels/${id}/messages`, {
      embeds: [{
        title: m.title.slice(0, 256),
        description: m.body.slice(0, 4000),
        ...(m.url ? { url: m.url } : {}),
        ...(m.color != null ? { color: m.color } : {}),
        ...(m.footer ? { footer: { text: m.footer.slice(0, 200) } } : {}),
      }],
      ...(m.url ? { components: [{ type: 1, components: [{ type: 2, style: 5, label: 'Otwórz na stronie', url: m.url }] }] } : {}),
      allowed_mentions: { parse: [] },
    });
    if (r.ok) return 'sent';
    const err = await r.json().catch(() => ({})) as { code?: number };
    if (err.code === 50007) return 'blocked';
    console.warn(`[dm] Discord ${r.status} ${err.code ?? ''} for ${discordId}`);
    return 'failed';
  } catch (e) {
    console.warn('[dm] send failed:', (e as Error).message);
    return 'failed';
  }
}
