import { cortexIconSrc } from "./assets";

type Variant = "sidebar" | "appbar" | "hero" | "auth";

interface Props {
  variant?: Variant;
  showWordmark?: boolean;
}

/** Shared Cortex mark + wordmark for shell chrome (iOS-safe tap targets on app bar). */
export function CortexBrand({ variant = "sidebar", showWordmark = true }: Props) {
  const imgClass =
    variant === "appbar"
      ? "cortex-brand__img cortex-brand__img--appbar"
      : variant === "hero"
        ? "cortex-brand__img cortex-brand__img--hero"
        : variant === "auth"
          ? "cortex-brand__img cortex-brand__img--auth"
          : "cortex-brand__img cortex-brand__img--sidebar";

  return (
    <div className={`cortex-brand cortex-brand--${variant}`}>
      <img src={cortexIconSrc} alt="" className={imgClass} aria-hidden decoding="async" />
      {showWordmark && <span className="cortex-brand__wordmark">Cortex</span>}
    </div>
  );
}
