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
          <div className="clay-surface p-8 max-w-lg w-full flex flex-col items-center gap-4 border border-[#E9D9D0] bg-[#F7F1EA] rounded-2xl shadow-[0_18px_40px_-10px_rgba(103,6,38,0.22),inset_0_2px_4px_rgba(255,255,255,0.9)]">
            <div className="w-14 h-14 rounded-full bg-rose-100 border border-rose-300 flex items-center justify-center">
              <AlertOctagon className="w-8 h-8 text-[#991B1B] animate-pulse" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-black text-[#670626] uppercase tracking-wider font-mono">
                Tactical Module Render Fault
              </h2>
              <p className="text-sm text-[#5C313E] font-mono">
                An unexpected exception interrupted component rendering in this tactical view.
              </p>
            </div>

            {this.state.error && (
              <div className="w-full p-3 rounded-xl bg-[#E9D9D0]/70 border border-[#D8C1B5] text-left font-mono text-xs text-[#991B1B] overflow-x-auto max-h-32">
                {this.state.error.message || 'Unknown runtime error'}
              </div>
            )}

            <div className="flex items-center gap-3 mt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={this.handleReset}
                className="text-sm font-mono font-bold flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                RELOAD MODULE
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => { window.location.href = '/dashboard'; }}
                className="text-sm font-mono font-bold flex items-center gap-2"
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
