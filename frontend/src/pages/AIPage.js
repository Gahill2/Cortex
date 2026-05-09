import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
export const AIPage = () => {
    const [messages, setMessages] = useState([
        { id: "init", role: "assistant", content: "Hi, I'm Cortex AI. Ask me anything — tasks, ideas, or questions." }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
    const send = async (e) => {
        e?.preventDefault();
        const msg = input.trim();
        if (!msg || loading)
            return;
        setMessages((p) => [...p, { id: `u-${Date.now()}`, role: "user", content: msg }]);
        setInput("");
        setLoading(true);
        try {
            const res = await api.post("/ai/chat", { message: msg });
            const reply = res.data?.data?.reply ?? res.data?.reply ?? "…";
            setMessages((p) => [...p, { id: `a-${Date.now()}`, role: "assistant", content: reply }]);
        }
        catch {
            setMessages((p) => [...p, { id: `e-${Date.now()}`, role: "assistant", content: "Could not reach the server." }]);
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { className: "page ai-page", children: [_jsxs("div", { className: "page-titlebar", children: [_jsx("h1", { className: "page-title", children: "AI Assistant" }), _jsx("button", { className: "btn-ghost", onClick: () => setMessages([{ id: "init", role: "assistant", content: "New conversation started." }]), children: "Clear chat" })] }), _jsxs("div", { className: "ai-layout", children: [_jsxs("div", { className: "ai-messages", children: [messages.map((m) => (_jsxs("div", { className: `ai-msg ai-msg--${m.role}`, children: [_jsx("div", { className: "ai-msg-label", children: m.role === "user" ? "You" : "Cortex AI" }), _jsx("div", { className: "ai-msg-body", children: m.content })] }, m.id))), loading && (_jsxs("div", { className: "ai-msg ai-msg--assistant", children: [_jsx("div", { className: "ai-msg-label", children: "Cortex AI" }), _jsxs("div", { className: "ai-msg-body ai-typing", children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] })] })), _jsx("div", { ref: bottomRef })] }), _jsxs("form", { className: "ai-composer", onSubmit: send, children: [_jsx("textarea", { ref: inputRef, className: "ai-composer-input", value: input, onChange: (e) => setInput(e.target.value), onKeyDown: (e) => { if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    void send();
                                } }, placeholder: "Message Cortex AI\u2026 (Enter to send, Shift+Enter for new line)", rows: 3, disabled: loading }), _jsx("button", { type: "submit", className: "btn-primary ai-send-btn", disabled: loading || !input.trim(), children: loading ? "Thinking…" : "Send ↑" })] })] })] }));
};
