import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const SolucastRedirect = () => {
  const { code } = useParams();
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (!code) return;

    // Try to open the desktop app
    window.location.href = `solucast://import/${code}`;

    // After a short delay, show the fallback if we're still here
    const timer = setTimeout(() => setShowFallback(true), 1500);
    return () => clearTimeout(timer);
  }, [code]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #0d0d14 100%)',
      color: 'white',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      padding: '24px',
      textAlign: 'center'
    }}>
      {!showFallback ? (
        <>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: '#06b6d4',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            marginBottom: '24px'
          }} />
          <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Opening SoluCast...</h2>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
            Launching the desktop app with code <strong style={{ color: '#06b6d4' }}>{code}</strong>
          </p>
        </>
      ) : (
        <>
          <h2 style={{ margin: '0 0 16px', fontSize: '22px' }}>Open in SoluCast Desktop</h2>
          <p style={{ margin: '0 0 24px', color: 'rgba(255,255,255,0.6)', fontSize: '14px', maxWidth: '400px' }}>
            The desktop app didn't open automatically. You can try again or copy the code to import manually.
          </p>
          <button
            onClick={() => { window.location.href = `solucast://import/${code}`; }}
            style={{
              background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
              border: 'none',
              borderRadius: '10px',
              padding: '14px 32px',
              color: 'white',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: '16px'
            }}
          >
            Open SoluCast
          </button>
          <div style={{
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '10px',
            padding: '16px 24px',
            marginTop: '8px'
          }}>
            <p style={{ margin: '0 0 8px', color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
              Or enter this code manually in SoluCast:
            </p>
            <span style={{
              fontSize: '24px',
              fontWeight: 700,
              letterSpacing: '3px',
              color: '#06b6d4',
              fontFamily: 'monospace'
            }}>{code}</span>
          </div>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default SolucastRedirect;
