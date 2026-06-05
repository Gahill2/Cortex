import { cortexLogoLockupSrc } from "./assets";

type Size = "login" | "gate" | "epic";

interface Props {
  size?: Size;
  className?: string;
}

/** Full icon + wordmark lockup for auth screens and epic login hero. */
export function CortexLogo({ size = "login", className = "" }: Props) {
  return (
    <img
      src={cortexLogoLockupSrc}
      alt="Cortex"
      className={["cortex-logo-lockup", `cortex-logo-lockup--${size}`, className].filter(Boolean).join(" ")}
      decoding="async"
    />
  );
}
