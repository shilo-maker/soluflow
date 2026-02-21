import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import authService from '../services/authService';

const SSOCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const exchangedRef = useRef(false);

  useEffect(() => {
    if (exchangedRef.current) return;
    const code = searchParams.get('code');
    if (!code) {
      setError('No SSO code provided');
      return;
    }
    exchangedRef.current = true;

    const exchange = async () => {
      try {
        await authService.exchangeSSOCode(code);
        // Force a full reload so AuthContext picks up the new token
        window.location.href = '/library';
      } catch (err) {
        console.error('SSO exchange failed:', err);
        setError('SSO login failed. The link may have expired.');
      }
    };

    exchange();
  }, [searchParams]);

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        color: '#666',
        gap: '16px'
      }}>
        <div style={{ fontSize: '1.1rem' }}>{error}</div>
        <button
          onClick={() => navigate('/login', { replace: true })}
          style={{
            padding: '8px 24px',
            borderRadius: '8px',
            background: '#4ecdc4',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontSize: '1.1rem',
      color: '#4ECDC4'
    }}>
      Signing in...
    </div>
  );
};

export default SSOCallback;
