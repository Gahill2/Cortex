/** Normalized now-playing shape for UI (API uses `playing`; legacy UI used `isPlaying`). */
export type SpotifyNowPlaying = {
  isPlaying: boolean;
  track?: { name: string; artists: string; albumArt?: string };
  device?: { name: string; volumePercent: number };
};

type RawNowPlaying = {
  playing?: boolean;
  isPlaying?: boolean;
  track?: {
    name?: string;
    artists?: string | string[] | Array<{ name?: string }>;
    albumArt?: string | null;
  };
  device?: { name?: string; volumePercent?: number };
};

export function normalizeSpotifyNowPlaying(raw: RawNowPlaying | null | undefined): SpotifyNowPlaying | null {
  if (!raw) return null;

  const isPlaying = Boolean(raw.isPlaying ?? raw.playing);
  const t = raw.track;

  let artists = "";
  if (Array.isArray(t?.artists)) {
    artists = t.artists
      .map((a) => (typeof a === "string" ? a : a?.name ?? ""))
      .filter(Boolean)
      .join(", ");
  } else if (typeof t?.artists === "string") {
    artists = t.artists;
  }

  const track =
    t?.name != null
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
