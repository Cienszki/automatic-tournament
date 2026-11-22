import { describe, it, expect } from 'vitest';
import { parseCommunityXml, steamKeyRejected } from '@/lib/steam-community';

// Trimmed from steamcommunity.com/id/brzexit/?xml=1 (2026-11-19)
const PROFILE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><profile>
	<steamID64>76561198129804673</steamID64>
	<steamID><![CDATA[pma]]></steamID>
	<avatarIcon><![CDATA[https://avatars.fastly.steamstatic.com/e643.jpg]]></avatarIcon>
	<avatarMedium><![CDATA[https://avatars.fastly.steamstatic.com/e643_medium.jpg]]></avatarMedium>
	<avatarFull><![CDATA[https://avatars.fastly.steamstatic.com/e643_full.jpg]]></avatarFull>
	<customURL><![CDATA[brzexit]]></customURL>
</profile>`;

describe('parseCommunityXml', () => {
  it('reads the Steam id, name and avatars of a public profile page', () => {
    expect(parseCommunityXml(PROFILE)).toEqual({
      steamId64: '76561198129804673',
      name: 'pma',
      avatar: 'https://avatars.fastly.steamstatic.com/e643.jpg',
      avatarMedium: 'https://avatars.fastly.steamstatic.com/e643_medium.jpg',
      avatarFull: 'https://avatars.fastly.steamstatic.com/e643_full.jpg',
    });
  });

  it('returns null for a profile that does not exist', () => {
    const missing = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><response><error><![CDATA[The specified profile could not be found.]]></error></response>';
    expect(parseCommunityXml(missing)).toBeNull();
  });
});

describe('steamKeyRejected', () => {
  it('treats 401 and 403 as a key Steam does not accept', () => {
    expect([401, 403, 429, 500].map(steamKeyRejected)).toEqual([true, true, false, false]);
  });
});
