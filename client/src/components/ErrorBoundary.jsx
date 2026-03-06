import React from 'react';
import './ErrorBoundary.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isOffline: !navigator.onLine
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, isOffline: !navigator.onLine };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  componentDidMount() {
    this._handleOnline = () => {
      if (this.state.hasError && this.state.isOffline) {
        // Auto-retry when coming back online after a chunk-load failure
        this.setState({ hasError: false, error: null, errorInfo: null, isOffline: false });
      }
    };
    window.addEventListener('online', this._handleOnline);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this._handleOnline);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.name === 'ChunkLoadError' ||
        this.state.error?.message?.includes('Loading chunk') ||
        this.state.error?.message?.includes('dynamically imported module');
      const isOffline = !navigator.onLine;

      if (isOffline && isChunkError) {
        return (
          <div className="error-boundary">
            <div className="error-boundary-container">
              <div className="error-icon">📡</div>
              <h1>You're offline</h1>
              <p className="error-message">
                This page hasn't been cached yet. It will load automatically when you're back online,
                or navigate to a page you've visited before.
              </p>
              <div className="error-actions">
                <button className="btn-primary" onClick={this.handleGoHome}>
                  Go to Home
                </button>
                <button className="btn-secondary" onClick={this.handleRetry}>
                  Try Again
                </button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary-container">
            <div className="error-icon">⚠️</div>
            <h1>Oops! Something went wrong</h1>
            <p className="error-message">
              We're sorry, but something unexpected happened.
              Don't worry, your data is safe.
            </p>

            <div className="error-actions">
              <button className="btn-primary" onClick={this.handleReload}>
                Reload Page
              </button>
              <button className="btn-secondary" onClick={this.handleGoHome}>
                Go to Home
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-details">
                <summary>Error Details (Development Only)</summary>
                <div className="error-stack">
                  <strong>Error:</strong> {this.state.error.toString()}
                  <br />
                  <br />
                  <strong>Stack Trace:</strong>
                  <pre>{this.state.errorInfo?.componentStack}</pre>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
