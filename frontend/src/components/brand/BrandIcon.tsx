import type { CSSProperties } from "react";
import { siAnthropic, siGmail, siGooglecalendar, siNotion, siSpotify } from "simple-icons";

/** simple-icons dropped OpenAI; keep path from MIT Simple Icons archive. */
const openAiBrand = {
  title: "OpenAI",
  hex: "412991",
  path: "M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .742 7.097 5.98 5.98 0 0 0 .511 4.911 6.051 6.051 0 0 0 6.515 2.899A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM12 20.475a4.475 4.475 0 0 1-2.876-1.052l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.822 16.904a4.47 4.47 0 0 1-.535-3.014l2.853 1.646v3.384l-.141.082a4.451 4.451 0 0 1-2.177-1.098zm1.336-8.166a4.47 4.47 0 0 1 2.368-1.973V11.6l-2.853 1.647-2.02-1.168a.07.07 0 0 1-.028-.057zm14.547 3.368l-2.853-1.647 2.853-1.646 2.02 1.168a.07.07 0 0 1 .028.057 4.47 4.47 0 0 1 .535 3.013l-2.583 1.494v.028zm-2.02-6.737 2.02-1.168a.07.07 0 0 1 .057-.028 4.47 4.47 0 0 1 3.014.535l-2.853 1.646V5.37zm-8.748 11.12-2.853-1.647-2.853 1.647-2.02-1.168a.07.07 0 0 1-.038-.052 4.47 4.47 0 0 1-.535-3.013l2.583-1.494 2.853 1.647 2.853-1.647 2.583 1.494a4.451 4.451 0 0 1-.177 1.098 4.47 4.47 0 0 1-2.366 1.973z",
};

export type BrandId =
  | "gmail"
  | "outlook"
  | "spotify"
  | "google-calendar"
  | "notion"
  | "openai"
  | "anthropic"
  | "cortex";

const BRANDS: Record<BrandId, { title: string; hex: string; path: string } | null> = {
  gmail: siGmail,
  outlook: null,
  spotify: siSpotify,
  "google-calendar": siGooglecalendar,
  notion: siNotion,
  openai: openAiBrand,
  anthropic: siAnthropic,
  cortex: null,
};

type Props = {
  brand: BrandId;
  size?: number;
  className?: string;
  /** Use brand color fill; default true */
  colored?: boolean;
  title?: string;
};

/** Official brand marks via Simple Icons (MIT). */
export function BrandIcon({ brand, size = 20, className = "", colored = true, title }: Props) {
  const data = BRANDS[brand];
  if (!data) {
    const src =
      brand === "outlook"
        ? "/brands/outlook.svg"
        : brand === "cortex"
          ? "/cortex-icon-transparent.svg"
          : "/cortex-icon-transparent.svg";
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`brand-icon brand-icon--img ${className}`.trim()}
        aria-hidden={!title}
      />
    );
  }

  const style: CSSProperties = colored
    ? { width: size, height: size, color: `#${data.hex}` }
    : { width: size, height: size };

  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={`brand-icon ${className}`.trim()}
      style={style}
      aria-hidden={!title}
      aria-label={title ?? data.title}
    >
      {title ? <title>{title}</title> : null}
      <path d={data.path} fill="currentColor" />
    </svg>
  );
}
