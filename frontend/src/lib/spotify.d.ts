/** Normalized now-playing shape for UI (API uses `playing`; legacy UI used `isPlaying`). */
export type SpotifyNowPlaying = {
    isPlaying: boolean;
    track?: {
        name: string;
        artists: string;
        albumArt?: string;
    };
    device?: {
        name: string;
        volumePercent: number;
    };
};
type RawNowPlaying = {
    playing?: boolean;
    isPlaying?: boolean;
    track?: {
        name?: string;
        artists?: string | string[] | Array<{
            name?: string;
        }>;
        albumArt?: string | null;
    };
    device?: {
        name?: string;
        volumePercent?: number;
    };
};
export declare function normalizeSpotifyNowPlaying(raw: RawNowPlaying | null | undefined): SpotifyNowPlaying | null;
export {};
