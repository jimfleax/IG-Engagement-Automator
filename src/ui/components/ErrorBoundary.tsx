/**
 * @file ErrorBoundary.tsx
 * @description Catches uncaught React runtime exceptions within the extension UI tree and displays a graceful fallback screen.
 * @architecture Top-level wrapper in content.tsx around App, providing error containment and manual reload/recovery triggers.
 * @agent_note Calls optional onReset prop when the reload button is clicked to signal WorkflowEngine state reset.
 */
import React from "react";
import { Warning, ArrowsClockwise } from "@phosphor-icons/react";

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React error boundary class component that catches rendering errors and displays a recovery interface.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[IG Automator UI Error]", error, errorInfo);
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="suite-modal p-6 text-slate-900 font-sans max-w-[480px] mx-auto bg-white border border-rose-200 rounded-2xl shadow-xl">
          <div className="flex items-center gap-3 mb-3 text-rose-600">
            <Warning className="w-6 h-6 shrink-0" weight="fill" />
            <h3 className="text-sm font-bold">Suite UI Error Recovered</h3>
          </div>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            The interface encountered an unexpected error:{" "}
            <span className="font-mono text-[11px] text-rose-700 bg-rose-50 px-1 py-0.5 rounded border border-rose-200">
              {this.state.error?.message || "Unknown error"}
            </span>
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={this.handleReload}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm shadow-blue-500/20"
            >
              <ArrowsClockwise className="w-3.5 h-3.5" weight="bold" />
              <span>Reload Suite</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
