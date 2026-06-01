import {
  Bot,
  Calendar,
  CheckSquare,
  FileText,
  Home,
  Mail,
  Music,
  Server,
  Settings,
  Target,
  Cloud,
  type LucideIcon,
} from "lucide-react";
import type { NavIconName } from "../navigation";

const ICON_MAP: Record<NavIconName, LucideIcon> = {
  home: Home,
  "check-square": CheckSquare,
  target: Target,
  calendar: Calendar,
  bot: Bot,
  "file-text": FileText,
  mail: Mail,
  music: Music,
  server: Server,
  cloud: Cloud,
  settings: Settings,
};

interface Props {
  name: NavIconName;
  size?: number;
  className?: string;
}

/** Shared 20px monochrome nav icons (sidebar, drawer, tab bar). */
export function NavIcon({ name, size = 20, className }: Props) {
  const Icon = ICON_MAP[name];
  return (
    <Icon
      size={size}
      strokeWidth={1.75}
      className={className}
      aria-hidden
    />
  );
}
