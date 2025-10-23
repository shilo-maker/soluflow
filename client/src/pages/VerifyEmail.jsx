import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../services/api';
import './VerifyEmail.css';

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [email, setEmail] = useState('');
  const hasVerified = useRef(false);

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setStatus('error');
        setMessage('No verification token found in the URL.');
        return;
      }

      // Prevent duplicate verification attempts
      if (hasVerified.current) {
        return;
      }
      hasVerified.current = true;

      try {
        const response = await api.get(`/auth/verify-email?token=${token}`);
        setStatus('success');
        setMessage(response.data.message || 'Email verified successfully!');
      } catch (error) {
        setStatus('error');
        setMessage(
          error.response?.data?.error ||
          error.response?.data?.message ||
          'Failed to verify email. The link may have expired.'
        );
      }
    };

    verifyToken();
  }, [searchParams]);

  const handleResendVerification = async () => {
    if (!email) {
      alert('Please enter your email address');
      return;
    }

    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email });
      alert('Verification email sent! Please check your inbox.');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to resend verification email');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="verify-email-page">
      <div className="verify-email-container">
        <div className="verify-email-card">
          {status === 'verifying' && (
            <>
              <div className="spinner"></div>
              <h2>Verifying your email...</h2>
              <p>Please wait while we verify your email address.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="success-icon">✓</div>
              <h2>Email Verified!</h2>
              <p>{message}</p>
              <button className="btn-primary" onClick={() => navigate('/login')}>
                Go to Login
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="error-icon">✗</div>
              <h2>Verification Failed</h2>
              <p>{message}</p>

              <div className="resend-section">
                <h3>Need a new verification link?</h3>
                <p>Enter your email address and we'll send you a new one.</p>
                <div className="resend-form">
                  <input
                    type="email"
                    className="resend-input"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <button
                    className="btn-resend"
                    onClick={handleResendVerification}
                    disabled={resending}
                  >
                    {resending ? 'Sending...' : 'Resend Verification Email'}
                  </button>
                </div>
              </div>

              <button className="btn-secondary" onClick={() => navigate('/login')}>
                Go to Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
