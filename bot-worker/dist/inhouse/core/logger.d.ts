declare const LOG_LEVELS: {
    readonly debug: 0;
    readonly info: 1;
    readonly warn: 2;
    readonly error: 3;
};
export type LogLevel = keyof typeof LOG_LEVELS;
/** Receives every log line that passes the level filter. */
export type LogSink = (level: LogLevel, message: string, data?: unknown) => void;
/**
 * Replace the log destination. Pass nothing to restore the console default.
 *
 * Level filtering is applied before the sink is called, so a sink never sees
 * lines below `LOG_LEVEL`.
 */
export declare function setLogSink(next?: LogSink): void;
export declare const logger: {
    debug: (msg: string, data?: unknown) => void;
    info: (msg: string, data?: unknown) => void;
    warn: (msg: string, data?: unknown) => void;
    error: (msg: string, error?: unknown) => void;
};
export {};
