/**
 * The "Wyłącz takie powiadomienia" button of a Discord DM (signed link, see src/server/notify/mute.ts).
 *   GET  ?s=&t=&sig=          → turns that type off for that person, page with "Cofnij"
 *   POST s, t, sig, on=1|0    → the page's button: back on, or off again
 *   HEAD                      → nothing (link previews must not switch anything off)
 */

import { NextRequest, NextResponse } from 'next/server';
import { NOTIFY_TYPES, type NotifyType } from '@/lib/notify-types';
import { setMuted, verifyMute, type MuteSubject } from '@/server/notify/mute';
import { SITE } from '@/server/notify/notify';

export const dynamic = 'force-dynamic';

const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

function page(status: number, title: string, text: string, form?: { s: string; t: string; sig: string; on: boolean; label: string }) {
  const button = form
    ? `<form method="post"><input type="hidden" name="s" value="${esc(form.s)}"><input type="hidden" name="t" value="${esc(form.t)}"><input type="hidden" name="sig" value="${esc(form.sig)}"><input type="hidden" name="on" value="${form.on ? '1' : '0'}"><button type="submit">${esc(form.label)}</button></form>`
    : '';
  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} · dota2inhouse.pl</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: radial-gradient(ellipse at top, #1c2430, #0b0f14 70%); color: #d7dde5; font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 460px; padding: 32px 20px; }
  h1 { margin: 0 0 8px; font-size: 26px; color: #fff; }
  p { margin: 0 0 20px; color: #a9b3bf; }
  b { color: #fff; }
  button { font: inherit; font-weight: 700; padding: 10px 22px; border-radius: 6px; border: 1px solid #3a4655; background: transparent; color: #fff; cursor: pointer; }
  button:hover { background: #1f2935; }
  a { display: inline-block; margin-top: 24px; color: #8ab4f8; font-size: 14px; }
</style></head><body><main><h1>${esc(title)}</h1><p>${text}</p>${button}<a href="${SITE}/">dota2inhouse.pl</a></main></body></html>`;
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

const invalid = () => page(400, 'Link nie działa', 'Ten link jest nieprawidłowy. Powiadomienia wyłączysz też w dzwonku na stronie.');

async function apply(s: string, t: string, sig: string, on: boolean) {
  if (!verifyMute(s, t, sig)) return invalid();
  const type = t as NotifyType;
  const label = esc(NOTIFY_TYPES[type].label);
  try {
    await setMuted(s as MuteSubject, type, !on);
  } catch (e) {
    console.error('[notify/off] failed:', e);
    return page(500, 'Nie udało się', 'Spróbuj ponownie za chwilę.');
  }
  const account = s.startsWith('u:');
  return on
    ? page(200, 'Włączone', `Powiadomienia <b>${label}</b> znów będą przychodzić.`, { s, t, sig, on: false, label: 'Wyłącz' })
    : page(200, 'Wyłączone', `Nie dostaniesz już powiadomień <b>${label}</b>.${account ? ' Włączysz je z powrotem w dzwonku na stronie.' : ''}`, { s, t, sig, on: true, label: 'Cofnij' });
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  return apply(q.get('s') ?? '', q.get('t') ?? '', q.get('sig') ?? '', false);
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(req: NextRequest) {
  const f = await req.formData().catch(() => null);
  if (!f) return invalid();
  return apply(String(f.get('s') ?? ''), String(f.get('t') ?? ''), String(f.get('sig') ?? ''), f.get('on') === '1');
}
