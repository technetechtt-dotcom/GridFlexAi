import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };
  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }
  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-red-500/10 p-4 rounded-full mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">
            Something went wrong
          </h2>
          <p className="text-slate-400 max-w-md mb-6">
            An unexpected error occurred while rendering this component. Our
            team has been notified.
          </p>
          <button
            onClick={() =>
            this.setState({
              hasError: false
            })
            }
            className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700">

            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
          {this.state.error &&
          <pre className="mt-8 p-4 bg-slate-900 rounded-lg text-xs text-red-400 text-left overflow-auto max-w-lg w-full border border-slate-800">
              {this.state.error.toString()}
            </pre>
          }
        </div>);

    }
    return this.props.children;
  }
}
