import type { SpotifyNowPlaying } from "../lib/spotify";
type NowPlaying = SpotifyNowPlaying;
interface Props {
    connected: boolean;
    nowPlaying: NowPlaying | null;
    onRefresh: () => void;
}
export declare const SpotifyWidget: ({ connected, nowPlaying, onRefresh }: Props) => import("react/jsx-runtime").JSX.Element;
export {};
