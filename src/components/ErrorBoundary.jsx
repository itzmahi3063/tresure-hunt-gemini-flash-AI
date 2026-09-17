import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0A0E] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-lg font-heading font-black text-amber-400 mb-2 uppercase">Game Rendering Notice</h2>
          <p className="text-xs text-gray-400 max-w-xs mb-5">Something unexpected occurred. Tap below to reload seamlessly.</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-gold-glow px-6 py-3 rounded-xl font-heading font-bold text-xs flex items-center space-x-2"
          >
            <RefreshCw size={14} />
            <span>Reload Treasure Hunt</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
