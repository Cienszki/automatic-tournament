"use strict";
// bot-worker/src/logger.ts
// Simple structured logger for bot worker
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
const currentLevel = process.env.LOG_LEVEL || 'info';
function shouldLog(level) {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}
function timestamp() {
    return new Date().toISOString();
}
exports.logger = {
    debug(msg, data) {
        if (shouldLog('debug')) {
            const extra = data instanceof Error ? data.message : data ? JSON.stringify(data) : '';
            console.log(`[${timestamp()}] [DEBUG] ${msg}`, extra);
        }
    },
    info(msg, data) {
        if (shouldLog('info')) {
            const extra = data instanceof Error ? data.message : data ? JSON.stringify(data) : '';
            console.log(`[${timestamp()}] [INFO] ${msg}`, extra);
        }
    },
    warn(msg, data) {
        if (shouldLog('warn')) {
            const extra = data instanceof Error ? data.message : data ? JSON.stringify(data) : '';
            console.warn(`[${timestamp()}] [WARN] ${msg}`, extra);
        }
    },
    error(msg, error) {
        if (shouldLog('error')) {
            const errMsg = error instanceof Error ? error.message : String(error ?? '');
            console.error(`[${timestamp()}] [ERROR] ${msg}`, errMsg);
        }
    },
};
