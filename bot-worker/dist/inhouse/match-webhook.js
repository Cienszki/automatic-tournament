"use strict";
// src/inhouse/match-webhook.ts
//
// Ported near-verbatim from dota2-lobby-bot/src/inhouse/match-webhook.ts.
// Only the import path changed (@dota2inhouse/core → ../logger).
//
// Tells the website a match finished, so it can ingest the result. Result
// ingestion is entirely the website's job — this webhook is only a fast path,
// never a dependency. The contract that actually matters is that
// `dotaMatchId` lands on the game document (runner.ts writes it before
// calling this): a cron sweep on the website picks up anything in
// `in_progress`/`finished` that has a match ID but no match record, so a
// webhook that never arrives costs latency and nothing else.
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyMatchFinished = notifyMatchFinished;
const logger_1 = require("../logger");
/** Attempts after the first, for 5xx and transport failures only. */
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 2_000;
const REQUEST_TIMEOUT_MS = 10_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/**
 * POST the finished match to the website.
 *
 * Idempotent on the far side, so at-least-once delivery is fine and preferred.
 * A 202 (`not_ready`) is **not** a failure and must not be retried in a tight
 * loop — the website's sweep runs periodically and will finish the job.
 */
async function notifyMatchFinished(config, input) {
    if (!config.secret) {
        // Fail loudly rather than silently: without this the result still lands via
        // the website's sweep, but delayed instead of within seconds.
        logger_1.logger.warn(`[InhouseRunner] INHOUSE_BOT_WEBHOOK_SECRET is not set — cannot notify the website that ` +
            `game ${input.gameId} finished. The match ID is on the game document, so the ` +
            `website's cron sweep will still ingest it, just not promptly.`);
        return { ok: false, reason: 'not_configured' };
    }
    const url = `${config.siteUrl.replace(/\/+$/, '')}/api/inhouse/matches/finished`;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0)
            await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
        let response;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${config.secret}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ gameId: input.gameId, dotaMatchId: input.dotaMatchId }),
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
        }
        catch (error) {
            logger_1.logger.warn(`[InhouseRunner] Match webhook attempt ${attempt + 1} for game ${input.gameId} could ` +
                `not reach ${url}: ${String(error)}`);
            continue;
        }
        // 401 and 422 are configuration and payload faults. Retrying either just
        // repeats the same mistake more expensively.
        if (response.status === 401) {
            logger_1.logger.error(`[InhouseRunner] Match webhook rejected for game ${input.gameId}: the website did not ` +
                `accept INHOUSE_BOT_WEBHOOK_SECRET. Check both halves hold the same value.`);
            return { ok: false, reason: 'unauthorized' };
        }
        if (response.status === 422) {
            logger_1.logger.error(`[InhouseRunner] Match webhook rejected for game ${input.gameId}: the website could ` +
                `not resolve the game or match ID (422).`);
            return { ok: false, reason: 'rejected' };
        }
        if (response.status === 202) {
            logger_1.logger.info(`[InhouseRunner] Match ${input.dotaMatchId} for game ${input.gameId} is not on ` +
                `OpenDota yet (202) — the website's sweep will finish it.`);
            return { ok: true, status: 'not_ready' };
        }
        if (response.ok) {
            const status = await readStatus(response);
            logger_1.logger.info(`[InhouseRunner] Website ingested match ${input.dotaMatchId} for game ${input.gameId} (${status}).`);
            return { ok: true, status };
        }
        // Anything else (5xx, proxy errors) is worth a few retries.
        logger_1.logger.warn(`[InhouseRunner] Match webhook attempt ${attempt + 1} for game ${input.gameId} returned ` +
            `HTTP ${response.status}.`);
    }
    logger_1.logger.error(`[InhouseRunner] Match webhook for game ${input.gameId} failed after ${MAX_RETRIES + 1} ` +
        `attempts. dotaMatchId is on the game document, so the website's sweep remains the backstop.`);
    return { ok: false, reason: 'unreachable' };
}
/** The 200 body carries `status`, but a proxy may hand back something else. */
async function readStatus(response) {
    try {
        const body = (await response.json());
        return body.status === 'already_done' ? 'already_done' : 'ingested';
    }
    catch {
        return 'ingested';
    }
}
