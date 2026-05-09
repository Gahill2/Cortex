import { Component, ErrorInfo, ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("UI error boundary caught", error, errorInfo);
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
            <button onClick={this.onReload}>Reload</button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
