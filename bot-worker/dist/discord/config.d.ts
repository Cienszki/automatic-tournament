export interface GatewayConfig {
    token: string;
    guildId: string;
    /** The one channel the bot owns: poster message and live lobby cards. */
    channelId: string;
    /** Base URL of the website, without a trailing slash. */
    siteUrl: string;
    /** Shared secret for /api/inhouse/bot/* — the same one the match webhook uses. */
    siteSecret: string;
}
export declare function loadGatewayConfig(): GatewayConfig | null;
