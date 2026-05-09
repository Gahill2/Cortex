interface NowPlaying {
    isPlaying: boolean;
    track?: {
        name: string;
        artists: string;
        albumArt?: string;
        progressMs?: number;
        durationMs?: number;
    };
    device?: {
        name: string;
        volumePercent: number;
    };
}
interface Props {
    connected: boolean;
    nowPlaying: NowPlaying | null;
    onRefresh: () => void;
}
export declare const SpotifyWidget: ({ connected, nowPlaying, onRefresh }: Props) => import("react/jsx-runtime").JSX.Element;
export {};
