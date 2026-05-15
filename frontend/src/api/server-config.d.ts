/** Public `/api/health` flags — env keys on the API server (no OAuth). */
export type ServerIntegrationConfig = {
    spotify: boolean;
    gmail: boolean;
    notion: boolean;
    anthropic: boolean;
    firebase: boolean;
    n8n: boolean;
};
export declare function getServerIntegrationConfig(): Promise<ServerIntegrationConfig>;
export declare function clearServerIntegrationConfigCache(): void;
