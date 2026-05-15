import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from "react";
export class ErrorBoundary extends Component {
    state = { hasError: false };
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error, errorInfo) {
        console.error("UI error boundary caught", error, errorInfo);
    }
    onReload = () => {
        window.location.reload();
    };
    render() {
        if (this.state.hasError) {
            return (_jsx("div", { className: "shell-root", children: _jsxs("div", { className: "card", children: [_jsx("h1", { children: "CORTEX" }), _jsx("p", { className: "error", children: "Something went wrong in the client UI." }), _jsx("button", { onClick: this.onReload, children: "Reload" })] }) }));
        }
        return this.props.children;
    }
}
