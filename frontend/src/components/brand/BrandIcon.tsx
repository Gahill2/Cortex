import type { CSSProperties } from "react";
import { siAnthropic, siGmail, siGooglecalendar, siNotion, siOpenai, siSpotify } from "simple-icons";

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
  openai: siOpenai,
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
