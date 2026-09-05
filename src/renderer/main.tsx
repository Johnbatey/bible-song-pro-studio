import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useAppStore } from './stores/appStore';
// Ahead of global.css so the .bsp-dock theme block can override dockview's own
// variable defaults rather than fighting import order.
import 'dockview/dist/styles/dockview.css';
import './styles/global.css';

/**
 * Test seam for the scripts/verify-*.cjs harnesses, which drive the real built
 * app in Electron and otherwise have no way to seed operator state. Read/write
 * access to the store only — no behaviour of its own.
 */
declare global {
  interface Window { __BSP_TEST__?: { store: typeof useAppStore } }
}
window.__BSP_TEST__ = { store: useAppStore };

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[AppErrorBoundary] Unhandled React error caught at top level:', error, errorInfo);
    // Ensure the splash screen element is removed so operator can see this recovery screen
    const splashEl = document.getElementById('splash-screen');
    if (splashEl) {
      splashEl.style.display = 'none';
      splashEl.remove();
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetAndRestore = async () => {
    try {
      if (window.BSP?.store?.clear) {
        await window.BSP.store.clear().catch(() => {});
      }
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0C0B0B',
          color: '#FFFFFF',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          padding: 24,
          boxSizing: 'border-box',
          textAlign: 'center',
          userSelect: 'none',
        }}>
          <div style={{
            maxWidth: 520,
            width: '100%',
            background: '#15181E',
            border: '1px solid rgba(255, 85, 0, 0.35)',
            borderRadius: 8,
            padding: 32,
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 85, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(255, 85, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FF5500',
              fontSize: 24,
              fontWeight: 800,
            }}>
              !
            </div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
              Bible Song Pro Studio
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: '#A8A2A0', lineHeight: 1.5 }}>
              The application encountered an unexpected startup state. You can reload the app or reset cached state to recover immediately without losing your installed Bibles.
            </p>
            {this.state.error && (
              <pre style={{
                width: '100%',
                maxHeight: 120,
                overflowY: 'auto',
                background: '#0C0B0B',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 4,
                padding: 10,
                fontSize: 11,
                fontFamily: "'Geist Mono', ui-monospace, monospace",
                color: '#FF8866',
                textAlign: 'left',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                boxSizing: 'border-box',
              }}>
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 8 }}>
              <button
                onClick={this.handleReload}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                Reload App
              </button>
              <button
                onClick={this.handleResetAndRestore}
                style={{
                  flex: 1.3,
                  padding: '10px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#FF5500',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(255, 85, 0, 0.4)',
                }}
              >
                Reset Cache & Recover
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function SplashOverlay() {
  useEffect(() => {
    const splashEl = document.getElementById('splash-screen');
    if (!splashEl) return;

    // Smoothly fade out inline loading screen once React has mounted App
    const timer = setTimeout(() => {
      splashEl.style.opacity = '0';
      splashEl.style.pointerEvents = 'none';
      setTimeout(() => {
        splashEl.remove();
      }, 400);
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  return null;
}

function Root() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);

    /* Block Cmd/Ctrl + / - / 0 from zooming the entire HTML application page */
    function blockAppZoom(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+' || e.key === '-' || e.key === '_' || e.key === '0')) {
        e.preventDefault();
      }
    }

    window.addEventListener('keydown', blockAppZoom, { capture: true });
    return () => window.removeEventListener('keydown', blockAppZoom, { capture: true });
  }, []);

  return (
    <React.StrictMode>
      <AppErrorBoundary>
        <SplashOverlay />
        {ready && <App />}
      </AppErrorBoundary>
    </React.StrictMode>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Root />);
