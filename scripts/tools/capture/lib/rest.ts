// A read-only client for Firestore's public REST API.
//
// It sends no credentials: every request is what an anonymous browser could send, so the
// security rules decide what it may read. It only ever issues GET requests. Requests are
// spaced out (at most `maxPerSecond`), 5xx answers are retried with backoff, and the first
// 429 stops the whole run, as WP-12 requires.

import type { RestDocument } from './decode';

export const FIRESTORE_REST = 'https://firestore.googleapis.com/v1';

export class RateLimited extends Error {
  constructor(url: string) {
    super(`HTTP 429 from ${url}: stopping, as the capture must not push past a rate limit`);
  }
}

export type ListResult =
  | { status: 'ok'; documents: RestDocument[] }
  | { status: 'denied'; documents: [] };

export interface RestClientOptions {
  projectId: string;
  /** The public web API key the site ships to browsers. Optional: public reads work without it. */
  apiKey?: string;
  maxPerSecond?: number;
  pageSize?: number;
  fetchImpl?: typeof fetch;
  log?: (line: string) => void;
}

export class FirestoreRestClient {
  readonly base: string;
  requests = 0;
  private readonly minGapMs: number;
  private readonly pageSize: number;
  private readonly fetchImpl: typeof fetch;
  private readonly apiKey?: string;
  private readonly log: (line: string) => void;
  private lastAt = 0;

  constructor(opts: RestClientOptions) {
    this.base = `${FIRESTORE_REST}/projects/${opts.projectId}/databases/(default)/documents`;
    this.minGapMs = 1000 / (opts.maxPerSecond ?? 4);
    this.pageSize = opts.pageSize ?? 300;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.apiKey = opts.apiKey;
    this.log = opts.log ?? (() => {});
  }

  /** Every document of one collection, all pages. `parent` is '' for a root collection. */
  async list(parent: string, collectionId: string): Promise<ListResult> {
    const documents: RestDocument[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({ pageSize: String(this.pageSize) });
      if (pageToken) params.set('pageToken', pageToken);
      if (this.apiKey) params.set('key', this.apiKey);
      const path = parent ? `${parent}/${collectionId}` : collectionId;
      const res = await this.get(`${this.base}/${encodePath(path)}?${params}`);
      if (res.status === 403) {
        if (documents.length) throw new Error(`403 on a later page of ${path}`);
        return { status: 'denied', documents: [] };
      }
      const body = res.body as { documents?: RestDocument[]; nextPageToken?: string };
      documents.push(...(body.documents ?? []));
      pageToken = body.nextPageToken;
    } while (pageToken);
    return { status: 'ok', documents };
  }

  /** One document, or null when it does not exist; 'denied' when the rules refuse it. */
  async getDocument(path: string): Promise<RestDocument | null | 'denied'> {
    const params = new URLSearchParams();
    if (this.apiKey) params.set('key', this.apiKey);
    const q = params.toString();
    const res = await this.get(`${this.base}/${encodePath(path)}${q ? `?${q}` : ''}`);
    if (res.status === 403) return 'denied';
    if (res.status === 404) return null;
    return res.body as RestDocument;
  }

  private async get(url: string): Promise<{ status: number; body: unknown }> {
    for (let attempt = 0; ; attempt++) {
      await this.pace();
      this.requests++;
      const res = await this.fetchImpl(url, { method: 'GET', headers: { Accept: 'application/json' } });
      if (res.status === 429) throw new RateLimited(redact(url));
      if (res.status >= 500 && attempt < 3) {
        const wait = 2000 * 2 ** attempt;
        this.log(`HTTP ${res.status}, retrying in ${wait} ms: ${redact(url)}`);
        await sleep(wait);
        continue;
      }
      const text = await res.text();
      if (res.status === 200 || res.status === 403 || res.status === 404) {
        return { status: res.status, body: text ? JSON.parse(text) : {} };
      }
      throw new Error(`HTTP ${res.status} from ${redact(url)}: ${text.slice(0, 300)}`);
    }
  }

  private async pace(): Promise<void> {
    const wait = this.lastAt + this.minGapMs - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastAt = Date.now();
  }
}

/** Encode each segment of a document path, keeping the slashes. */
export function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function redact(url: string): string {
  return url.replace(/([?&]key=)[^&]+/, '$1…');
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
