import { NextResponse } from 'next/server';

// Same-origin copy of an allowlisted image, so the stats pages can draw it onto a <canvas> and
// export it (Steam's hero CDN and Firebase Storage don't send CORS headers for our domain).
// Not an open proxy: fixed hosts, images only, size-capped, cached.

const ALLOWED_HOSTS = new Set([
  'cdn.cloudflare.steamstatic.com',
  'avatars.steamstatic.com',
  'steamcdn-a.akamaihd.net',
  'firebasestorage.googleapis.com',
  'tournament-tracker-f35tb.firebasestorage.app',
]);
const MAX_BYTES = 3 * 1024 * 1024;

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('u');
  let target: URL;
  try { target = new URL(raw ?? ''); } catch { return NextResponse.json({ error: 'bad url' }, { status: 400 }); }
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: 'host not allowed' }, { status: 400 });
  }
  try {
    const res = await fetch(target, { next: { revalidate: 86400 } });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !type.startsWith('image/')) return NextResponse.json({ error: 'not an image' }, { status: 502 });
    const body = await res.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return NextResponse.json({ error: 'too large' }, { status: 413 });
    return new NextResponse(body, {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return NextResponse.json({ error: 'fetch failed' }, { status: 502 });
  }
}
