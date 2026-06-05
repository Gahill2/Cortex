import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { resolveCanvasImageSrc } from "../../lib/canvasState";

interface Props {
  imageUrl: string;
  className?: string;
}

function canvasAssetId(imageUrl: string): string | null {
  const match = /\/canvas\/images\/([a-f0-9-]{36})/i.exec(imageUrl);
  return match?.[1] ?? null;
}

/** Loads protected canvas assets with the API bearer token; passes through http(s) and data URLs. */
export function CanvasImage({ imageUrl, className }: Props) {
  const [src, setSrc] = useState(() => resolveCanvasImageSrc(imageUrl) ?? imageUrl);

  useEffect(() => {
    const resolved = resolveCanvasImageSrc(imageUrl) ?? imageUrl;
    const assetId = canvasAssetId(resolved) ?? canvasAssetId(imageUrl);
    if (!assetId) {
      setSrc(resolved);
      return;
    }

    let objectUrl: string | undefined;
    let cancelled = false;

    api
      .get(`/canvas/images/${assetId}`, { responseType: "blob" })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(resolved);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageUrl]);

  return <img src={src} alt="" className={className} draggable={false} />;
}
