export interface MatchWebhookConfig {
    /** Public site URL, e.g. `https://pd2ih.pl`. Must match the website's `NEXT_PUBLIC_SITE_URL`. */
    siteUrl: string;
    /** Shared secret, sent as `Authorization: Bearer`. The website 401s without it. */
    secret: string | null;
}
export type MatchWebhookOutcome = {
    ok: true;
    status: 'ingested' | 'already_done';
}
/** OpenDota hasn't seen the match yet. Expected in the first minute or two. */
 | {
    ok: true;
    status: 'not_ready';
} | {
    ok: false;
    reason: 'not_configured' | 'unauthorized' | 'rejected' | 'unreachable';
};
/**
 * POST the finished match to the website.
 *
 * Idempotent on the far side, so at-least-once delivery is fine and preferred.
 * A 202 (`not_ready`) is **not** a failure and must not be retried in a tight
 * loop — the website's sweep runs periodically and will finish the job.
 */
export declare function notifyMatchFinished(config: MatchWebhookConfig, input: {
    gameId: string;
    dotaMatchId: number;
}): Promise<MatchWebhookOutcome>;
