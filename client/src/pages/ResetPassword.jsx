import React, { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../services/api';
import './ResetPassword.css';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('idle'); // idle, resetting, success, error
  const [message, setMessage] = useState('');
  const hasReset = useRef(false);

  const token = searchParams.get('token');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      setStatus('error');
      setMessage('Invalid reset link. Please request a new password reset.');
      return;
    }

    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setStatus('error');
      setMessage('Password must be at least 6 characters long');
      return;
    }

    // Prevent duplicate submissions
    if (hasReset.current) {
      return;
    }
    hasReset.current = true;

    setStatus('resetting');

    try {
      const response = await api.post('/auth/reset-password', {
        token,
        password
      });
      setStatus('success');
      setMessage(response.data.message || 'Password reset successful!');
    } catch (error) {
      hasReset.current = false; // Allow retry on error
      setStatus('error');
      setMessage(
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to reset password'
      );
    }
  };

  if (!token) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-container">
          <div className="reset-password-card">
            <div className="error-icon">✗</div>
            <h2>Invalid Reset Link</h2>
            <p>This password reset link is invalid or has expired.</p>
            <button
              className="btn-primary"
              onClick={() => navigate('/forgot-password')}
            >
              Request New Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-page">
      <div className="reset-password-container">
        <div className="reset-password-card">
          {status !== 'success' ? (
            <>
              <h2>Reset Your Password</h2>
              <p className="subtitle">
                Enter your new password below.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="password">New Password</label>
                  <input
                    type="password"
                    id="password"
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    disabled={status === 'resetting'}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    className="form-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    disabled={status === 'resetting'}
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
                  disabled={status === 'resetting'}
                >
                  {status === 'resetting' ? 'Resetting...' : 'Reset Password'}
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
              <h2>Password Reset Successful!</h2>
              <p className="success-message">{message}</p>
              <p className="info-message">
                You can now login with your new password.
              </p>
              <button
                className="btn-primary"
                onClick={() => navigate('/login')}
              >
                Go to Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
