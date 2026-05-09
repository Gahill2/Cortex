import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { api } from "../api/client";
export const LoginPage = ({ onLogin }) => {
    const [step, setStep] = useState("email");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const sendOtp = async () => {
        if (!email.trim())
            return;
        setLoading(true);
        setError(null);
        try {
            await api.post("/auth/send-otp", { email: email.trim().toLowerCase() });
            setStep("otp");
        }
        catch {
            setError("Failed to send code. Check your email and try again.");
        }
        finally {
            setLoading(false);
        }
    };
    const verifyOtp = async () => {
        if (code.length !== 6)
            return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.post("/auth/verify-otp", {
                email: email.trim().toLowerCase(),
                code: code.trim()
            });
            onLogin(res.data.token);
        }
        catch {
            setError("Invalid or expired code. Try again.");
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "login-screen", children: _jsxs("div", { className: "login-content", children: [_jsxs("div", { className: "login-logo-wrap", children: [_jsx("div", { className: "login-logo-glyph", children: "C" }), _jsx("span", { className: "login-logo-word", children: "CORTEX" })] }), _jsx("p", { className: "login-tagline", children: "Your personal command layer" }), step === "email" ? (_jsxs("div", { className: "login-form", children: [_jsx("label", { className: "login-label", children: "Email address" }), _jsx("input", { className: "login-input", type: "email", value: email, onChange: (e) => setEmail(e.target.value), onKeyDown: (e) => e.key === "Enter" && void sendOtp(), placeholder: "you@example.com", autoFocus: true, autoComplete: "email" }), error && _jsx("p", { className: "login-error", children: error }), _jsx("button", { className: "login-btn", onClick: () => void sendOtp(), disabled: loading || !email.trim(), children: loading ? "Sending…" : "Continue →" }), _jsx("p", { className: "login-hint", children: "We'll email you a sign-in code \u2014 no password needed" })] })) : (_jsxs("div", { className: "login-form", children: [_jsx("label", { className: "login-label", children: "6-digit code" }), _jsxs("p", { className: "login-subtext", children: ["Sent to ", _jsx("strong", { children: email }), " \u00B7", " ", _jsx("button", { className: "login-link", onClick: () => { setStep("email"); setCode(""); setError(null); }, children: "Change" })] }), _jsx("input", { className: "login-input login-otp-input", type: "text", inputMode: "numeric", pattern: "[0-9]{6}", maxLength: 6, value: code, onChange: (e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6)), onKeyDown: (e) => e.key === "Enter" && void verifyOtp(), placeholder: "000000", autoFocus: true, autoComplete: "one-time-code" }), error && _jsx("p", { className: "login-error", children: error }), _jsx("button", { className: "login-btn", onClick: () => void verifyOtp(), disabled: loading || code.length !== 6, children: loading ? "Verifying…" : "Sign in" }), _jsx("button", { className: "login-resend", onClick: () => void sendOtp(), disabled: loading, children: "Resend code" })] }))] }) }));
};
