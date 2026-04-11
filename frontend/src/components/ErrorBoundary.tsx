"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props { children: ReactNode; fallbackTitle?: string; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white mb-1">{this.props.fallbackTitle ?? "Something went wrong"}</h2>
            <p className="text-sm text-zinc-400 max-w-md">
              {this.state.error?.message || "An unexpected error occurred. Please try refreshing."}
            </p>
          </div>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="inline-flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-white/[0.06] transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
