import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[Nodex]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          gap: '16px',
          fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Mono', monospace",
        }}>
          {/* Icon */}
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
            stroke="#64FFDA" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2.5" />
          </svg>

          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '14px', fontWeight: 700,
              color: '#f5f3ee', marginBottom: '8px',
            }}>
              Something went wrong
            </div>
            <div style={{
              fontSize: '11px', color: '#666',
              lineHeight: 1.6, maxWidth: '220px',
            }}>
              The side panel hit an unexpected error.
              Close and reopen it to recover.
            </div>
          </div>

          {/* Error detail — collapsed, for debugging */}
          {this.state.error && (
            <div style={{
              marginTop: '8px',
              background: '#141414',
              border: '1px solid #262626',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '10px',
              color: '#666',
              maxWidth: '260px',
              wordBreak: 'break-word',
              lineHeight: 1.5,
            }}>
              {this.state.error.message}
            </div>
          )}

          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: '4px',
              fontFamily: 'inherit',
              fontSize: '12px', fontWeight: 700,
              background: '#64FFDA', color: '#0a0a0a',
              border: 'none', borderRadius: '8px',
              padding: '10px 20px', cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
