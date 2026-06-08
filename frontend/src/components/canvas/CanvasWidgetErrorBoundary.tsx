import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  widgetKey: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

/** Keeps one broken widget from taking down the whole canvas. */
export class CanvasWidgetErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[canvas widget:${this.props.widgetKey}]`, error, info);
  }

  componentDidUpdate(prev: Props) {
    if (prev.widgetKey !== this.props.widgetKey && this.state.hasError) {
      this.setState({ hasError: false, message: undefined });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="widget canvas-widget-error" role="alert">
          <p className="canvas-widget-error__title">Widget unavailable</p>
          <p className="canvas-widget-error__hint">
            {this.props.widgetKey} could not render.
            {import.meta.env.DEV && this.state.message ? ` (${this.state.message})` : null}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
