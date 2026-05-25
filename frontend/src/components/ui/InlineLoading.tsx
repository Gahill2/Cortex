interface InlineLoadingProps {
  text?: string;
  size?: "sm" | "md";
}

export function InlineLoading({ text = "Loading…", size = "sm" }: InlineLoadingProps) {
  const spinnerClass = size === "md" ? "inline-loading-spinner" : "inline-loading-spinner inline-loading-spinner--sm";
  return (
    <span className="inline-loading" role="status" aria-label={text}>
      <span className={spinnerClass} aria-hidden="true" />
      <span className="inline-loading-text">{text}</span>
    </span>
  );
}
