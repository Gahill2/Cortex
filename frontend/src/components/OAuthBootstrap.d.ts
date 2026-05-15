/**
 * When API keys are in .env but the user has not completed OAuth yet,
 * send them through the provider consent screen once per service per session.
 */
export declare const OAuthBootstrap: ({ enabled }: {
    enabled: boolean;
}) => null;
