import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Props {
  service: "spotify" | "gmail" | "mail";
  label?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export const ConnectOAuthButton = ({ service, label, className, onClick }: Props) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const path =
          service === "spotify"
            ? "/spotify/oauth/url"
            : service === "mail"
              ? "/mail/oauth/url"
              : "/gmail/oauth/url";
        const r = await api.get<{ data?: { url?: string } }>(path);
        setUrl(r.data?.data?.url ?? null);
      } catch {
        setUrl(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [service]);

  if (loading) {
    return <span className={className ?? "btn-ghost btn-sm settings-muted"}>Loading…</span>;
  }

  if (!url) {
    return <span className={className ?? "btn-ghost btn-sm settings-muted"}>Connect unavailable</span>;
  }

  return (
    <a
      className={className ?? "btn-primary btn-sm"}
      href={url}
      onClick={onClick}
    >
      {label ?? "Connect account"}
    </a>
  );
};
