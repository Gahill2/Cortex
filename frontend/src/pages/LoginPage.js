import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { api } from "../api/client";
function authErrorMessage(err, fallback) {
    const ax = err;
    const apiMsg = ax.response?.data?.error?.message;
    if (apiMsg)
        return apiMsg;
    if (ax.response?.status === 429) {
        return "Too many code requests. Wait about a minute, then try again.";
    }
    if (!ax.response) {
        return "Cannot reach the Cortex API. Make sure the backend is running on port 4000, then refresh.";
    }
    return fallback;
}
import cortexLogo from "../assets/cortex-logo.png";
import { LoginEpicScene } from "../components/LoginEpicScene";
export const LoginPage = ({ onLogin }) => {
    const reduceMotion = useReducedMotion();
    const [step, setStep] = useState("email");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [devNotice, setDevNotice] = useState(null);
    const applySendOtpPayload = (data) => {
        if (data.devOtpCode) {
            setCode(data.devOtpCode);
            setDevNotice(data.devHint ?? "Development: email not sent — use the code below.");
        }
        else {
            setDevNotice(null);
        }
    };
    const sendOtp = async () => {
        if (!email.trim())
            return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.post("/auth/send-otp", {
                email: email.trim().toLowerCase(),
            });
            const data = res.data;
            applySendOtpPayload(data);
            if (data.devOtpCode) {
                setStep("otp");
                return;
            }
            if (data.message?.toLowerCase().includes("could not be emailed")) {
                setError("Email is not configured on the server. Check backend SMTP settings or server logs for the code.");
                return;
            }
            setStep("otp");
        }
        catch (err) {
            setError(authErrorMessage(err, "Failed to send code. Check your email and try again."));
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
        catch (err) {
            setError(authErrorMessage(err, "Invalid or expired code. Try again."));
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { className: "login-screen login-scene", children: [_jsx(LoginEpicScene, {}), _jsx(motion.div, { className: "layer depth-4 login-stage", "data-depth": "4", initial: reduceMotion ? false : { opacity: 0, y: 28 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }, children: _jsxs(motion.div, { className: "login-content", layout: true, transition: { type: "spring", stiffness: 380, damping: 32 }, children: [_jsx("div", { className: "login-logo-wrap login-logo-wrap--card", children: _jsx("img", { src: cortexLogo, alt: "Cortex", className: "cortex-logo-img login-logo-img login-logo-img--blend" }) }), _jsxs(motion.p, { className: "login-tagline", initial: reduceMotion ? false : { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay: 0.35 }, children: ["Your ", _jsx("strong", { children: "neural command layer" }), " \u2014 one dashboard for everything you run."] }), step === "email" ? (_jsxs("div", { className: "login-form", children: [_jsx("label", { className: "login-label", children: "Email address" }), _jsx("input", { className: "login-input", type: "email", value: email, onChange: (e) => setEmail(e.target.value), onKeyDown: (e) => e.key === "Enter" && void sendOtp(), placeholder: "you@example.com", autoFocus: true, autoComplete: "email" }), error && _jsx("p", { className: "login-error", children: error }), _jsx("button", { className: "login-btn", onClick: () => void sendOtp(), disabled: loading || !email.trim(), children: loading ? "Sending…" : "Continue →" }), _jsx("p", { className: "login-hint", children: "We'll email you a sign-in code \u2014 no password needed" })] })) : (_jsxs("div", { className: "login-form", children: [_jsx("label", { className: "login-label", children: "6-digit code" }), _jsxs("p", { className: "login-subtext", children: ["Sent to ", _jsx("strong", { children: email }), " \u00B7", " ", _jsx("button", { className: "login-link", onClick: () => {
                                                setStep("email");
                                                setCode("");
                                                setError(null);
                                                setDevNotice(null);
                                            }, children: "Change" })] }), devNotice && (_jsxs(motion.div, { className: "login-dev-banner", role: "status", layout: true, children: [_jsx("p", { className: "login-dev-banner-title", children: "Local development" }), _jsx("p", { className: "login-dev-banner-text", children: devNotice })] })), _jsx("input", { className: "login-input login-otp-input", type: "text", inputMode: "numeric", pattern: "[0-9]{6}", maxLength: 6, value: code, onChange: (e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6)), onKeyDown: (e) => e.key === "Enter" && void verifyOtp(), placeholder: "000000", autoFocus: true, autoComplete: "one-time-code" }), error && _jsx("p", { className: "login-error", children: error }), _jsx("button", { className: "login-btn", onClick: () => void verifyOtp(), disabled: loading || code.length !== 6, children: loading ? "Verifying…" : "Sign in" }), _jsx("button", { className: "login-resend", onClick: () => void sendOtp(), disabled: loading, children: "Resend code" })] }))] }) })] }));
};
