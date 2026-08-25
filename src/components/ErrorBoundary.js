import React from 'react';

// Without this, any uncaught render error anywhere in the tree unmounts the
// whole app and leaves a silent blank/white page — no error text, nothing
// in the DOM, nothing actionable for the person looking at it. This catches
// that and shows the actual error instead, so a screenshot of it is enough
// to diagnose the problem remotely.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info);
    this.setState({ info });
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 24,
        fontFamily: 'system-ui, -apple-system, sans-serif', background: '#fff', color: '#111',
        textAlign: 'center',
      }}>
        <img src="/logo.png" alt="PAV" style={{ width: 56, height: 56, marginBottom: 16 }} />
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          Un problème est survenu
        </h1>
        <p style={{ fontSize: 14, color: '#555', marginBottom: 16, maxWidth: 480 }}>
          L'application a rencontré une erreur inattendue. Prends une capture d'écran de ce message
          et envoie-la, ça aidera à corriger le problème.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px', borderRadius: 8, border: 'none',
            background: '#1F3A5F', color: '#fff', fontWeight: 600, marginBottom: 20, cursor: 'pointer',
          }}
        >
          Recharger la page
        </button>
        <pre style={{
          fontSize: 11, textAlign: 'left', maxWidth: 640, overflow: 'auto',
          background: '#f5f5f5', padding: 12, borderRadius: 8, color: '#b91c1c',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {String(error && (error.stack || error.message || error))}
          {info && info.componentStack ? '\n\n' + info.componentStack : ''}
        </pre>
      </div>
    );
  }
}
