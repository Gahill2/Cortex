import { Component, ErrorInfo, ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  message?: string;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error?.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("UI error boundary caught", error, errorInfo);
    this.setState({ message: error.message });
  }

  onReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="shell-root">
          <div className="card">
            <h1>CORTEX</h1>
            <p className="error">Something went wrong in the client UI.</p>
            {import.meta.env.DEV && this.state.message ? (
              <pre
                className="error-boundary-detail"
                style={{
                  marginTop: 12,
                  padding: 12,
                  fontSize: 12,
                  lineHeight: 1.4,
                  textAlign: "left",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  opacity: 0.85,
                  maxWidth: "min(480px, 90vw)",
                }}
              >
                {this.state.message}
              </pre>
            ) : null}
            <button type="button" onClick={this.onReload} style={{ marginTop: 16 }}>
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
