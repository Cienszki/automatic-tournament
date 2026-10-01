import type { HeroVideoStatus } from '@/lib/bunny-renditions';

/**
 * Browser side of super-admin hero video uploads. The file goes straight from
 * the browser to Bunny over TUS (resumable, chunked — raw exports can be
 * hundreds of MB); our API only signs the upload and reports encoding status,
 * so the API key never leaves the server and the file never passes through it.
 */

type GetToken = () => Promise<string>;

async function api<T>(getToken: GetToken, init: RequestInit & { query?: string } = {}): Promise<T> {
  const res = await fetch(`/api/admin/hero-video${init.query ?? ''}`, {
    ...init,
    headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json', ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Błąd serwera (${res.status})`);
  return body as T;
}

interface UploadTicket {
  videoId: string;
  libraryId: string;
  tusEndpoint: string;
  signature: string;
  expire: number;
}

/** Uploads the file and resolves with the Bunny video id once the bytes are in. */
export async function uploadHeroVideoToBunny(
  file: File,
  title: string,
  getToken: GetToken,
  onProgress: (fraction: number) => void,
): Promise<string> {
  const ticket = await api<UploadTicket>(getToken, { method: 'POST', body: JSON.stringify({ title }) });
  const { Upload } = await import('tus-js-client');

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: ticket.tusEndpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
      chunkSize: 50 * 1024 * 1024,
      headers: {
        AuthorizationSignature: ticket.signature,
        AuthorizationExpire: String(ticket.expire),
        VideoId: ticket.videoId,
        LibraryId: ticket.libraryId,
      },
      metadata: { filetype: file.type || 'video/mp4', title },
      onProgress: (sent, total) => onProgress(total ? sent / total : 0),
      onSuccess: () => resolve(),
      onError: (err) => reject(err),
    });
    upload.start();
  });

  return ticket.videoId;
}

export function fetchHeroVideoStatus(videoId: string, getToken: GetToken): Promise<HeroVideoStatus> {
  return api<HeroVideoStatus>(getToken, { query: `?videoId=${encodeURIComponent(videoId)}` });
}

export async function deleteHeroVideoFromBunny(videoId: string, getToken: GetToken): Promise<void> {
  await api(getToken, { method: 'DELETE', query: `?videoId=${encodeURIComponent(videoId)}` });
}
