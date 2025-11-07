import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { GRADIENT_PRESETS } from '../contexts/ThemeContext';
import './Register.css';

// Helper function to convert hex color to CSS filter
const getColorFilter = (hexColor) => {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const hue = getHueRotate(r, g, b);
  return `brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(${hue}deg)`;
};

const getHueRotate = (r, g, b) => {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === rNorm) {
      hue = 60 * (((gNorm - bNorm) / delta) % 6);
    } else if (max === gNorm) {
      hue = 60 * (((bNorm - rNorm) / delta) + 2);
    } else {
      hue = 60 * (((rNorm - gNorm) / delta) + 4);
    }
  }
  return Math.round(hue);
};

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { t, language } = useLanguage();
  const { theme } = useTheme();

  // Get current theme accent color
  const currentPreset = GRADIENT_PRESETS[theme?.gradientPreset] || GRADIENT_PRESETS.professional;

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const validateForm = () => {
    if (!formData.email.trim()) {
      setError(t('register.errorEmailRequired'));
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError(t('register.errorEmailInvalid'));
      return false;
    }
    if (!formData.password) {
      setError(t('register.errorPasswordRequired'));
      return false;
    }
    if (formData.password.length < 6) {
      setError(t('register.errorPasswordLength'));
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError(t('register.errorPasswordMismatch'));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Auto-generate username from email (part before @)
      const username = formData.email.split('@')[0];

      // Don't send workspaceId - backend will auto-create workspace
      await register(
        formData.email,
        formData.password,
        username,
        null, // Backend will auto-create workspace
        language // Pass current language for email localization
      );
      // Show success message instead of navigating
      setRegistrationSuccess(true);
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.error || t('register.errorRegistrationFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-container">
        <button className="btn-back-to-songs" onClick={() => navigate('/')}>
          ← {t('register.browseSongs')}
        </button>
        <div className="register-header">
          <img
            src="/neutral_logo.png"
            alt="SoluFlow"
            className="register-logo"
            style={{ filter: getColorFilter(currentPreset.accentColor) }}
          />
          <p>{t('register.title')}</p>
        </div>

        <div className="register-card">
          {registrationSuccess ? (
            <div className="registration-success">
              <div className="success-icon">✓</div>
              <h2>{t('register.successTitle')}</h2>
              <p>{t('register.successMessage')}</p>
              <p>{t('register.successEmailSent')} <strong>{formData.email}</strong></p>
              <p className="verification-note">
                {t('register.successNote')}
              </p>
              <button className="btn-go-to-login" onClick={() => navigate('/login')}>
                {t('register.goToLogin')}
              </button>
              <div className="resend-info">
                <p>{t('register.resendInfo')} <Link to="/login">{t('register.resendLink')}</Link> {t('register.resendInfoEnd')}</p>
              </div>
            </div>
          ) : (
            <>
              {error && <div className="register-error">{error}</div>}

              <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">{t('register.emailLabel')}</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder={t('register.emailPlaceholder')}
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">{t('register.passwordLabel')}</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={t('register.passwordPlaceholder')}
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">{t('register.confirmPasswordLabel')}</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder={t('register.confirmPasswordPlaceholder')}
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn-register"
              disabled={loading}
            >
              {loading ? t('register.creatingAccount') : t('register.registerButton')}
            </button>
          </form>

          <div className="register-footer">
            <p>
              {t('register.haveAccount')} <Link to="/login">{t('register.loginLink')}</Link>
            </p>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Register;
