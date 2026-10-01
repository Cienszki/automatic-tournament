/**
 * Bunny Stream library that hosts hero videos for the platform's own
 * tournaments (super-admin uploads only — other organizers link to videos they
 * host themselves). Neither value is secret; the API key lives in the
 * BUNNY_STREAM_API_KEY env var and is only ever read on the server.
 *
 * The library must keep "MP4 Fallback" enabled: the hero plays the MP4
 * renditions in a plain <video> tag, and videos uploaded while it was off never
 * get them.
 */
export const bunnyStreamConfig = {
  libraryId: '767003',
  cdnHostname: 'vz-5fa7cfa5-146.b-cdn.net',
  tusEndpoint: 'https://video.bunnycdn.com/tusupload',
} as const;
