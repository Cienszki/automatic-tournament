// Client-side function to check if Twitch channel is live
// Uses our secure API route instead of calling Twitch directly

export async function isTwitchLive(): Promise<boolean> {
  try {
    const response = await fetch('/api/twitch/live');
    if (!response.ok) return false;
    
    const data = await response.json();
    return data.isLive === true;
  } catch (error) {
    console.error('Failed to check Twitch live status:', error);
    return false;
  }
}
