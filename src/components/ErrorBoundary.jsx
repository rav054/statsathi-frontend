import { Component } from 'react';

/** Catches a rendering crash so the user sees what happened and a way back, instead of a blank page. */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('StatSathi crashed while rendering', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl">
          <h1 className="font-display text-lg font-bold text-slate-800">Something went wrong on this screen</h1>
          <p className="mt-2 font-sans text-sm text-slate-500">
            StatSathi hit an unexpected problem while drawing the page. Your saved projects, datasets and results
            are stored on the server and are not affected.
          </p>
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500 break-words">
            {String(error?.message || error)}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button type="button" onClick={() => this.setState({ error: null })}
              className="rounded-xl border border-slate-200 px-4 py-2 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
              Try again
            </button>
            <button type="button" onClick={() => window.location.assign('/')}
              className="rounded-xl bg-brand-indigo px-4 py-2 font-sans text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer">
              Reload StatSathi
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
