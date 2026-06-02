import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error boundary caught an error', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4 safe-area-inset-top safe-area-inset-bottom">
        <div className="w-full max-w-sm rounded-xl border border-red-500/40 bg-gray-900 p-5 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-red-300" />
          </div>
          <h1 className="text-xl font-bold">Appen behöver laddas om</h1>
          <p className="text-gray-400 text-sm mt-2">
            Något oväntat hände, ofta efter tappad anslutning eller gammal data i vyn.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-bold flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Ladda om sidan
          </button>
        </div>
      </div>
    );
  }
}
