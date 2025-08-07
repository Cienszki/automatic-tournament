import { NextResponse } from 'next/server';

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_TOKEN = process.env.TWITCH_TOKEN;
const TWITCH_CHANNEL = 'polishdota2inhouse';

export async function GET() {
  if (!TWITCH_CLIENT_ID || !TWITCH_TOKEN) {
    return NextResponse.json({ isLive: false, error: 'Missing Twitch credentials' });
  }

  try {
    const response = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${TWITCH_CHANNEL}`,
      {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${TWITCH_TOKEN}`,
        },
        next: { revalidate: 60 }, // Cache for 1 minute
      }
    );

    if (!response.ok) {
      return NextResponse.json({ isLive: false, error: 'Twitch API error' });
    }

    const data = await response.json();
    const isLive = Array.isArray(data.data) && data.data.length > 0 && data.data[0].type === 'live';
    
    return NextResponse.json({ isLive });
  } catch (error) {
    console.error('Twitch API error:', error);
    return NextResponse.json({ isLive: false, error: 'Failed to check stream status' });
  }
}
