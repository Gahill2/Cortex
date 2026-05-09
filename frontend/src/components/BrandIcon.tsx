import type { SimpleIcon } from "simple-icons";

type Props = {
  icon: SimpleIcon;
  className?: string;
};

export function BrandIcon({ icon, className }: Props) {
  return (
    <svg
      className={className}
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={icon.title}
    >
      <title>{icon.title}</title>
      <path d={icon.path} fill={`#${icon.hex}`} />
    </svg>
  );
}
