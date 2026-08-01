import React from 'react';
import { type, fontWeight } from '../styles/type';

interface ErrorBoundaryProps {
  /** Shown in the fallback so the operator knows which region failed. */
  label: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string;
}

/**
 * Contains a render/commit fault to one region of the console.
 *
 * This app runs live during services. Without a boundary, any throw inside a
 * panel unmounts the entire React tree and the operator is left staring at a
 * black window mid-service. With one, the rest of the console keeps working and
 * the failure is named on screen.
 *
 * The captured component stack is the diagnostic that matters: a minified
 * production stack points into the shared vendor chunk and tells you nothing
 * about which component actually threw. `componentDidCatch` gives the real one.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, componentStack: '' };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ componentStack: info.componentStack || '' });
    // Kept as console.error so it lands in the same place operators already
    // copy crash reports from.
    console.error(`[${this.props.label}] render fault:`, error, info.componentStack);
  }

  private reset = () => this.setState({ error: null, componentStack: '' });

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={styles.shell} role="alert">
        <div style={styles.title}>{this.props.label} stopped responding</div>
        <div style={styles.message}>{error.message || String(error)}</div>
        {componentStack && (
          <details style={styles.details}>
            <summary style={styles.summary}>Show details</summary>
            <pre style={styles.stack}>{componentStack.trim()}</pre>
          </details>
        )}
        <button className="btn btn-sm btn-secondary" style={styles.retry} onClick={this.reset}>
          Retry this panel
        </button>
        <div style={styles.hint}>The rest of the console is still live.</div>
      </div>
    );
  }
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    height: '100%',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 20,
    textAlign: 'center',
    background: 'var(--bg-secondary)',
    overflow: 'auto',
  },
  title: { ...type.title, color: 'var(--red)' },
  message: { ...type.secondary, color: 'var(--text-secondary)', maxWidth: 520 },
  details: { ...type.caption, color: 'var(--text-dim)', maxWidth: '100%', textAlign: 'left' },
  summary: { cursor: 'pointer', fontWeight: fontWeight.semibold },
  stack: {
    ...type.caption,
    fontFamily: 'var(--font-mono)',
    margin: '6px 0 0',
    padding: 8,
    maxHeight: 160,
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-secondary)',
  },
  retry: { marginTop: 4 },
  hint: { ...type.caption, color: 'var(--text-dim)' },
};
