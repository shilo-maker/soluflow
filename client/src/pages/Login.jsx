import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated } = useAuth();
  const { t, setLanguage } = useLanguage();

  useEffect(() => {
    if (isAuthenticated) {
      const returnUrl = searchParams.get('returnUrl');
      navigate(returnUrl || '/library', { replace: true });
    }
  }, [isAuthenticated, navigate, searchParams]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLanguage('he');
    }
  }, [setLanguage, isAuthenticated]);

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!formData.email || !formData.password) {
        setError('Please enter both email and password');
        setLoading(false);
        return;
      }
      await login(formData.email, formData.password);
      setLoading(false);
    } catch (err) {
      let errorMessage = 'Login failed. Please check your credentials.';
      if (err?.error) errorMessage = String(err.error);
      else if (err?.response?.data?.error) errorMessage = String(err.response.data.error);
      else if (err?.message) errorMessage = String(err.message);
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <button className="btn-back-to-songs" onClick={() => navigate('/')}>
          ← {t('login.browseSongs')}
        </button>

        <div className="login-header">
          <img
            src="/neutral_logo.png"
            alt="SoluFlow"
            className="login-logo"
          />
          <h1 className="login-app-name">SoluFlow</h1>
          <p className="login-subtitle">כלים לצוותי הלל</p>
        </div>

        <div className="login-card">
          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">{t('login.emailLabel')}</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder={t('login.emailPlaceholder')}
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">{t('login.passwordLabel')}</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={t('login.passwordPlaceholder')}
                autoComplete="current-password"
                disabled={loading}
              />
              <div className="forgot-password-link">
                <Link to="/forgot-password">{t('login.forgotPassword')}</Link>
              </div>
            </div>

            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? t('login.loggingIn') : t('login.loginButton')}
            </button>
          </form>

          <div className="login-footer">
            <p>
              {t('login.noAccount')}{' '}
              <Link to="/register">{t('login.registerLink')}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
