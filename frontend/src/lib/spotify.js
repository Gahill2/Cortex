export function normalizeSpotifyNowPlaying(raw) {
    if (!raw)
        return null;
    const isPlaying = Boolean(raw.isPlaying ?? raw.playing);
    const t = raw.track;
    let artists = "";
    if (Array.isArray(t?.artists)) {
        artists = t.artists
            .map((a) => (typeof a === "string" ? a : a?.name ?? ""))
            .filter(Boolean)
            .join(", ");
    }
    else if (typeof t?.artists === "string") {
        artists = t.artists;
    }
    const track = t?.name != null
        ? {
            name: t.name,
            artists,
            albumArt: t.albumArt ?? undefined
        }
        : undefined;
    if (!isPlaying && !track) {
        return { isPlaying: false };
    }
    return {
        isPlaying,
        track,
        device: raw.device?.name
            ? {
                name: raw.device.name,
                volumePercent: raw.device.volumePercent ?? 0
            }
            : undefined
    };
}
