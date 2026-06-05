import { Play } from "lucide-react";
import type { WidgetRenderProps } from "../types";
import { mockMusic } from "../mockData";

export function MusicWidget(_props: WidgetRenderProps) {
  return (
    <div className="pd-widget pd-widget--music">
      <div className="pd-music__art" aria-hidden />
      <div>
        <p className="pd-music__album">{mockMusic.title}</p>
        <p className="pd-music__artist">{mockMusic.artist}</p>
      </div>
      <button type="button" className="pd-music__play" aria-label="Play">
        <Play size={16} fill="currentColor" />
      </button>
    </div>
  );
}
