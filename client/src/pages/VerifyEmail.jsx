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
        setMessage(t('verifyEmail.noToken'));
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
        setMessage(response.data.message || t('verifyEmail.verifiedSuccess'));
      } catch (error) {
        setStatus('error');
        setMessage(
          error.response?.data?.error ||
          error.response?.data?.message ||
          t('verifyEmail.verificationFailed')
        );
      }
    };

    verifyToken();
  }, [searchParams, t]);

  const handleResendVerification = async () => {
    if (!email) {
      alert(t('verifyEmail.enterEmail'));
      return;
    }

    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email });
      alert(t('verifyEmail.resendSuccess'));
    } catch (error) {
      alert(error.response?.data?.error || t('verifyEmail.resendFailed'));
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
              <h2>{t('verifyEmail.verifying')}</h2>
              <p>{t('verifyEmail.verifyingMessage')}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="success-icon">✓</div>
              <h2>{t('verifyEmail.successTitle')}</h2>
              <p>{message}</p>
              <button className="btn-primary" onClick={() => navigate('/login')}>
                {t('verifyEmail.goToLogin')}
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="error-icon">✗</div>
              <h2>{t('verifyEmail.errorTitle')}</h2>
              <p>{message}</p>

              <div className="resend-section">
                <h3>{t('verifyEmail.resendTitle')}</h3>
                <p>{t('verifyEmail.resendMessage')}</p>
                <div className="resend-form">
                  <input
                    type="email"
                    className="resend-input"
                    placeholder={t('verifyEmail.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <button
                    className="btn-resend"
                    onClick={handleResendVerification}
                    disabled={resending}
                  >
                    {resending ? t('verifyEmail.sending') : t('verifyEmail.resendButton')}
                  </button>
                </div>
              </div>

              <button className="btn-secondary" onClick={() => navigate('/login')}>
                {t('verifyEmail.goToLogin')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
