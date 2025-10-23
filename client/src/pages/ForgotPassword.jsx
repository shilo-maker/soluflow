import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../services/api';
import './ForgotPassword.css';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle, sending, success, error
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      setStatus('error');
      setMessage('Please enter your email address');
      return;
    }

    setStatus('sending');

    try {
      const response = await api.post('/auth/forgot-password', { email });
      setStatus('success');
      setMessage(response.data.message || 'Password reset link sent! Please check your email.');
    } catch (error) {
      setStatus('error');
      setMessage(
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to send password reset email'
      );
    }
  };

  return (
    <div className="forgot-password-page">
      <div className="forgot-password-container">
        <div className="forgot-password-card">
          {status !== 'success' ? (
            <>
              <h2>Forgot Password?</h2>
              <p className="subtitle">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    disabled={status === 'sending'}
                    required
                  />
                </div>

                {status === 'error' && (
                  <div className="error-message">
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={status === 'sending'}
                >
                  {status === 'sending' ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <div className="footer-links">
                <button
                  className="link-button"
                  onClick={() => navigate('/login')}
                >
                  Back to Login
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="success-icon">✓</div>
              <h2>Check Your Email</h2>
              <p className="success-message">{message}</p>
              <p className="info-message">
                If an account exists with the email you provided, you will receive a password reset link shortly.
              </p>
              <p className="info-message">
                The link will expire in 1 hour.
              </p>
              <button
                className="btn-primary"
                onClick={() => navigate('/login')}
              >
                Return to Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
