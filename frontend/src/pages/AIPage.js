import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
export const AIPage = () => {
    const [messages, setMessages] = useState([
        {
            id: "init",
            role: "assistant",
            content: "Hi, I'm Cortex AI. Ask me anything — tasks, ideas, questions."
        }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);
    const send = async (e) => {
        e?.preventDefault();
        const msg = input.trim();
        if (!msg || loading)
            return;
        const userMsg = { id: `u-${Date.now()}`, role: "user", content: msg };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setLoading(true);
        try {
            const res = await api.post("/ai/chat", { message: msg });
            const reply = res.data?.data?.reply ?? res.data?.reply ?? "…";
            setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: reply }]);
        }
        catch {
            setMessages((prev) => [
                ...prev,
                { id: `err-${Date.now()}`, role: "assistant", content: "Sorry, I couldn't reach the server." }
            ]);
        }
        finally {
            setLoading(false);
        }
    };
    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
        }
    };
    return (_jsxs("div", { className: "page ai-page", children: [_jsxs("header", { className: "page-header", children: [_jsx("h1", { className: "page-title", children: "AI" }), _jsx("button", { className: "header-action-btn", onClick: () => setMessages([{ id: "init", role: "assistant", content: "Hi, I'm Cortex AI. Ask me anything." }]), children: "Clear" })] }), _jsxs("div", { className: "ai-messages", children: [messages.map((m) => (_jsx("div", { className: `ai-bubble ai-bubble--${m.role}`, children: _jsx("p", { className: "ai-bubble-text", children: m.content }) }, m.id))), loading && (_jsx("div", { className: "ai-bubble ai-bubble--assistant", children: _jsxs("p", { className: "ai-bubble-text ai-typing", children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] }) })), _jsx("div", { ref: bottomRef })] }), _jsxs("form", { className: "ai-input-bar", onSubmit: send, children: [_jsx("textarea", { ref: inputRef, className: "ai-input", value: input, onChange: (e) => setInput(e.target.value), onKeyDown: handleKeyDown, placeholder: "Message Cortex AI\u2026", rows: 1, disabled: loading }), _jsx("button", { type: "submit", className: "ai-send-btn", disabled: loading || !input.trim(), children: "\u2191" })] })] }));
};
