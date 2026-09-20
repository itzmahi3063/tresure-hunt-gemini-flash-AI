import React from 'react';
import { RefreshCw, AlertTriangle, RotateCcw } from 'lucide-react';

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

  handleClearCacheAndReload = () => {
    try {
      localStorage.removeItem('treasure_ton_connected_wallet');
    } catch (e) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0A0E] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-lg font-heading font-black text-amber-400 mb-2 uppercase tracking-wide">
            Game Rendering Notice
          </h2>
          <p className="text-xs text-gray-400 max-w-xs mb-3">
            Something unexpected occurred. Tap below to reload seamlessly.
          </p>

          {this.state.error?.message && (
            <div className="mb-5 px-3 py-2 rounded-xl bg-[#1b1212] border border-rose-900/60 text-rose-300 text-[11px] font-mono max-w-xs break-all">
              {this.state.error.message}
            </div>
          )}

          <div className="flex flex-col space-y-2.5 w-full max-w-xs">
            <button
              onClick={() => window.location.reload()}
              className="btn-gold-glow w-full py-3 rounded-xl font-heading font-bold text-xs flex items-center justify-center space-x-2 shadow-md active:scale-95"
            >
              <RefreshCw size={14} />
              <span>Reload Treasure Hunt</span>
            </button>

            <button
              onClick={this.handleClearCacheAndReload}
              className="w-full py-2.5 rounded-xl bg-[#1c222e] text-cyan-300 border border-[#2b394d] text-xs font-bold flex items-center justify-center space-x-1.5 active:scale-95"
            >
              <RotateCcw size={13} />
              <span>Reset & Reload Clean</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
