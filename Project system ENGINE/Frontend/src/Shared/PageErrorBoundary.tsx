// [Layer: Shared]
// PageErrorBoundary.tsx -- Fault-tolerant Tactical Error Boundary for route views.
// Prevents an unhandled render exception in a module from crashing the App Shell (Header/Sidebar).
// Renders a high-visibility tactical recovery panel with error diagnostics and reload button.

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw, Home } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[PageErrorBoundary] Tactical component caught runtime exception:', error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-fade-in">
          <div className="tactical-card p-8 max-w-lg w-full flex flex-col items-center gap-4 border-rose-500/60 bg-slate-900/90 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-500/50 flex items-center justify-center">
              <AlertOctagon className="w-8 h-8 text-rose-400 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-black text-white uppercase tracking-wider font-mono">
                Tactical Module Render Fault
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                An unexpected exception interrupted component rendering in this tactical view.
              </p>
            </div>

            {this.state.error && (
              <div className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-left font-mono text-[11px] text-rose-300 overflow-x-auto max-h-32">
                {this.state.error.message || 'Unknown runtime error'}
              </div>
            )}

            <div className="flex items-center gap-3 mt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={this.handleReset}
                className="text-xs font-mono font-bold flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                RELOAD MODULE
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => { window.location.href = '/dashboard'; }}
                className="text-xs font-mono font-bold flex items-center gap-2 border-slate-700 hover:border-slate-500 text-slate-300"
              >
                <Home className="w-3.5 h-3.5" />
                RETURN C2 DASHBOARD
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PageErrorBoundary;
