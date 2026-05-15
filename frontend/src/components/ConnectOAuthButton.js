import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api } from "../api/client";
export const ConnectOAuthButton = ({ service, label, className, onClick }) => {
    const [url, setUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        void (async () => {
            try {
                const path = service === "spotify"
                    ? "/spotify/oauth/url"
                    : service === "mail"
                        ? "/mail/oauth/url"
                        : "/gmail/oauth/url";
                const r = await api.get(path);
                setUrl(r.data?.data?.url ?? null);
            }
            catch {
                setUrl(null);
            }
            finally {
                setLoading(false);
            }
        })();
    }, [service]);
    if (loading) {
        return _jsx("span", { className: className ?? "btn-ghost btn-sm settings-muted", children: "Loading\u2026" });
    }
    if (!url) {
        return _jsx("span", { className: className ?? "btn-ghost btn-sm settings-muted", children: "Connect unavailable" });
    }
    return (_jsx("a", { className: className ?? "btn-primary btn-sm", href: url, onClick: onClick, children: label ?? "Connect account" }));
};
