import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertTriangle className="w-12 h-12 text-risk-amber mb-4" />
          <p className="text-lg font-semibold text-slate-300 mb-2">Something went wrong</p>
          <p className="text-sm text-muted max-w-md mb-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <pre className="text-[10px] text-slate-500 bg-slate-900/60 border border-white/10 rounded-xl p-4 max-w-lg overflow-auto max-h-40">
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-6 py-2.5 bg-accent-indigo/20 border border-accent-indigo/40 rounded-xl text-sm font-medium text-accent-indigo hover:bg-accent-indigo/30 transition-all"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
